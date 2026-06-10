-- ============================================================================
-- MÉTRICA · Sistema Operativo — Fase 1: Cotizaciones
-- Migración 0001: esquema completo, función atómica del banco de códigos,
-- reglas de trazabilidad y seguridad a nivel de fila (RLS).
-- ============================================================================

-- ── Tipos enumerados ────────────────────────────────────────────────────────
create type rol_usuario       as enum ('ejecutivo', 'admin', 'gerencia');
create type tipo_proveedor    as enum ('empresa', 'persona_natural');
create type estado_codigo     as enum ('disponible', 'en_uso', 'anulado');
create type estado_cotizacion as enum ('borrador', 'pendiente', 'aprobada', 'observada', 'anulada');
create type moneda_tipo       as enum ('PEN', 'USD');

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table usuarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  correo     text not null unique,
  rol        rol_usuario not null default 'ejecutivo',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table clientes (
  id               uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social     text not null,
  ruc              text not null,
  created_at       timestamptz not null default now()
);

create table proveedores (
  id               uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social     text not null,
  ruc              text not null,
  tipo             tipo_proveedor not null default 'empresa',
  created_at       timestamptz not null default now()
);

create table banco_codigos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- COT-AAAA-NNNN
  anio       int  not null,
  numero     int  not null,                 -- correlativo que reinicia cada año
  estado     estado_codigo not null default 'disponible',
  tomado_por uuid references usuarios(id),
  tomado_en  timestamptz,
  created_at timestamptz not null default now(),
  unique (anio, numero)
);

create table cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique references banco_codigos(codigo),
  cliente_id          uuid not null references clientes(id),
  ejecutivo_id        uuid not null references usuarios(id),
  proyecto            text not null default '',
  moneda              moneda_tipo not null default 'PEN',
  fee_porcentaje      numeric(5,2) not null default 0 check (fee_porcentaje >= 0),
  fecha_envio_cliente date,
  estado              estado_cotizacion not null default 'borrador',
  observacion_admin   text,
  aprobada_por        uuid references usuarios(id),
  fecha_aprobacion    timestamptz,
  pdf_url             text,
  anulada_por         uuid references usuarios(id),
  motivo_anulacion    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table cotizacion_items (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references cotizaciones(id),
  orden           int  not null check (orden between 1 and 40), -- máx. 40 líneas
  proveedor_nombre text not null default '',
  descripcion     text not null default '',
  cantidad        numeric(12,2) not null default 1 check (cantidad >= 0),
  precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0),
  subtotal        numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (cotizacion_id, orden)
);

create index idx_cotizaciones_estado    on cotizaciones (estado);
create index idx_cotizaciones_ejecutivo on cotizaciones (ejecutivo_id);
create index idx_items_cotizacion       on cotizacion_items (cotizacion_id);
create index idx_banco_estado           on banco_codigos (anio, estado, numero);

-- ── Reglas de trazabilidad (triggers) ───────────────────────────────────────

-- Nada se borra jamás en las tablas de registro (ni siquiera con la llave
-- privilegiada): anular = cambiar estado.
create or replace function trg_no_borrar() returns trigger
language plpgsql as $$
begin
  raise exception 'Prohibido borrar registros de % (regla de trazabilidad: anule, no borre)', tg_table_name;
end $$;

create trigger no_borrar_usuarios      before delete on usuarios          for each row execute function trg_no_borrar();
create trigger no_borrar_banco         before delete on banco_codigos     for each row execute function trg_no_borrar();
create trigger no_borrar_cotizaciones  before delete on cotizaciones      for each row execute function trg_no_borrar();
create trigger no_borrar_clientes      before delete on clientes          for each row execute function trg_no_borrar();
create trigger no_borrar_proveedores   before delete on proveedores       for each row execute function trg_no_borrar();

-- Un código anulado queda anulado para siempre: ninguna actualización puede
-- devolverlo a 'disponible' ni a 'en_uso'.
create or replace function trg_codigo_anulado_es_final() returns trigger
language plpgsql as $$
begin
  if old.estado = 'anulado' and new.estado is distinct from 'anulado' then
    raise exception 'El código % está anulado y nunca puede reutilizarse', old.codigo;
  end if;
  return new;
end $$;

create trigger codigo_anulado_es_final before update on banco_codigos
  for each row execute function trg_codigo_anulado_es_final();

-- updated_at automático en cotizaciones
create or replace function trg_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger cotizaciones_touch before update on cotizaciones
  for each row execute function trg_touch_updated_at();

-- ── Funciones de identidad (base del RLS) ───────────────────────────────────
-- Identifican al usuario logueado por el correo de su sesión de Google.

create or replace function fn_correo_actual() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function fn_mi_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from usuarios where correo = fn_correo_actual() and activo
$$;

create or replace function fn_mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuarios where correo = fn_correo_actual() and activo
$$;

-- ── Banco de códigos: generación y asignación atómica ──────────────────────

-- Crea los códigos de un año (COT-AAAA-0001 … COT-AAAA-NNNN). Idempotente:
-- los números que ya existen se saltan. Solo el servidor puede llamarla.
create or replace function generar_codigos(p_anio int, p_hasta int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_creados int;
begin
  insert into banco_codigos (codigo, anio, numero)
  select format('COT-%s-%s', p_anio, lpad(n::text, 4, '0')), p_anio, n
  from generate_series(1, p_hasta) as n
  on conflict (anio, numero) do nothing;
  get diagnostics v_creados = row_count;
  return v_creados;
end $$;

-- ★ LA FUNCIÓN CRÍTICA ★
-- Entrega el primer código disponible del año en curso de forma ATÓMICA.
-- FOR UPDATE SKIP LOCKED: si dos ejecutivos piden código en el mismo
-- instante, Postgres atiende a uno y el otro salta automáticamente al
-- siguiente código libre. Es imposible que reciban el mismo.
-- El usuario se deriva de la sesión (no se recibe por parámetro, para que
-- nadie pueda hacerse pasar por otro).
create or replace function tomar_codigo()
returns banco_codigos
language plpgsql security definer set search_path = public as $$
declare
  v_usuario usuarios;
  v_codigo  banco_codigos;
begin
  select * into v_usuario from usuarios
   where correo = fn_correo_actual() and activo;
  if v_usuario is null then
    raise exception 'Usuario no autorizado o inactivo';
  end if;

  select * into v_codigo
    from banco_codigos
   where estado = 'disponible'
     and anio = extract(year from now())::int
   order by numero
   limit 1
   for update skip locked;

  if v_codigo is null then
    raise exception 'No hay códigos disponibles para el año %. Pida a administración generar más.',
      extract(year from now())::int;
  end if;

  update banco_codigos
     set estado = 'en_uso', tomado_por = v_usuario.id, tomado_en = now()
   where id = v_codigo.id
   returning * into v_codigo;

  return v_codigo;
end $$;

-- Permisos de ejecución: tomar_codigo solo para sesiones logueadas;
-- generar_codigos solo para el servidor (service_role).
revoke execute on function tomar_codigo()            from public, anon;
revoke execute on function generar_codigos(int, int) from public, anon, authenticated;
grant  execute on function tomar_codigo()            to authenticated, service_role;
grant  execute on function generar_codigos(int, int) to service_role;

-- ── Seguridad a nivel de fila (RLS) ─────────────────────────────────────────
-- Doble candado: aunque la app fallara, la base de datos misma impide ver o
-- tocar lo que no corresponde al rol.

alter table usuarios         enable row level security;
alter table clientes         enable row level security;
alter table proveedores      enable row level security;
alter table banco_codigos    enable row level security;
alter table cotizaciones     enable row level security;
alter table cotizacion_items enable row level security;

-- usuarios: todo usuario activo puede ver la lista (se necesita para mostrar
-- nombres); solo gerencia modifica (cambiar rol, dar de baja).
create policy usuarios_ver on usuarios
  for select to authenticated
  using (fn_mi_id() is not null);

create policy usuarios_gestionar on usuarios
  for update to authenticated
  using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');

-- clientes y proveedores: lectura para usuarios activos (el alta/edición de
-- maestros se hace desde el servidor en esta fase).
create policy clientes_ver on clientes
  for select to authenticated using (fn_mi_id() is not null);

create policy proveedores_ver on proveedores
  for select to authenticated using (fn_mi_id() is not null);

-- banco_codigos: lectura para usuarios activos. Nadie escribe directo:
-- tomar un código pasa por tomar_codigo(); anular pasa por el servidor.
create policy banco_ver on banco_codigos
  for select to authenticated using (fn_mi_id() is not null);

-- cotizaciones: admin y gerencia ven todas; el ejecutivo solo las suyas.
create policy cotizaciones_ver on cotizaciones
  for select to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia') or ejecutivo_id = fn_mi_id());

-- crear: solo a nombre propio y con un código que el mismo usuario tomó.
create policy cotizaciones_crear on cotizaciones
  for insert to authenticated
  with check (
    ejecutivo_id = fn_mi_id()
    and exists (
      select 1 from banco_codigos b
      where b.codigo = cotizaciones.codigo
        and b.estado = 'en_uso'
        and b.tomado_por = fn_mi_id()
    )
  );

-- editar: el ejecutivo solo lo suyo y solo en borrador u observada
-- (al reenviar tras una observación se conserva el MISMO código: el código
-- es parte de la fila y aquí solo cambian los datos y el estado).
create policy cotizaciones_editar_propia on cotizaciones
  for update to authenticated
  using (ejecutivo_id = fn_mi_id() and estado in ('borrador', 'observada'))
  with check (ejecutivo_id = fn_mi_id());

-- admin y gerencia: resolver (aprobar / observar / anular).
create policy cotizaciones_resolver on cotizaciones
  for update to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- cotizacion_items: visibles si la cotización es visible; editables por su
-- ejecutivo mientras la cotización esté en borrador u observada.
create policy items_ver on cotizacion_items
  for select to authenticated
  using (exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_id
      and (fn_mi_rol() in ('admin', 'gerencia') or c.ejecutivo_id = fn_mi_id())
  ));

create policy items_crear on cotizacion_items
  for insert to authenticated
  with check (exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_id
      and c.ejecutivo_id = fn_mi_id()
      and c.estado in ('borrador', 'observada')
  ));

create policy items_editar on cotizacion_items
  for update to authenticated
  using (exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_id
      and c.ejecutivo_id = fn_mi_id()
      and c.estado in ('borrador', 'observada')
  ));

-- Quitar una línea de un borrador sí está permitido (es papel de trabajo,
-- no registro final; la regla de no-borrar protege cotizaciones y códigos).
create policy items_quitar on cotizacion_items
  for delete to authenticated
  using (exists (
    select 1 from cotizaciones c
    where c.id = cotizacion_id
      and c.ejecutivo_id = fn_mi_id()
      and c.estado in ('borrador', 'observada')
  ));

-- ── Almacenamiento de PDFs ──────────────────────────────────────────────────
-- Bucket privado; los PDFs se entregan con enlaces firmados desde el servidor.
insert into storage.buckets (id, name, public)
values ('cotizaciones', 'cotizaciones', false)
on conflict (id) do nothing;
