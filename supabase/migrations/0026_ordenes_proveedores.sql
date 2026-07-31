-- ============================================================================
-- Migración 0026 · ODA de Proveedores (gastos recurrentes de la casa)
--
-- El módulo de Órdenes se abre en dos:
--
--   Proyectos    → las ODA de siempre. Nacen de una ficha, arrastran la
--                  cotización y alimentan la tabla de control. No se tocan.
--   Proveedores  → esto. Órdenes sueltas para el gasto propio de la oficina:
--                  suscripciones, corresponsales, servicios. No cuelgan de
--                  ninguna ficha ni cotización.
--
-- ── Por qué tabla aparte y no una columna nullable ──────────────────────────
-- En `ordenes_adquisicion`, `ficha_id` y `ficha_proveedor_id` son NOT NULL, y
-- eso no es un descuido: garantiza que toda orden de proyecto tenga de dónde
-- vino. Para meter aquí las órdenes sueltas habría que aflojar esa regla en la
-- tabla que sostiene la facturación de los proyectos — y a cambio de nada,
-- porque estas órdenes no comparten ni el ciclo de vida ni las consultas.
-- Separadas, ninguna de las dos se contamina.
--
-- ── ⚠ OJO: `tipo_proveedor` acá significa OTRA COSA ─────────────────────────
-- Las dos tablas de órdenes tienen una columna con ESTE MISMO NOMBRE y valores
-- incompatibles. No es un descuido: es como lo llama gerencia y es lo que dice
-- la pantalla, así que renombrarlo generaría más confusión de la que evita.
--
--   ordenes_adquisicion.tipo_proveedor  → enum tipo_proveedor
--                                         'empresa' | 'persona_natural'
--   ordenes_proveedores.tipo_proveedor  → enum tipo_proveedor_oda
--                                         el rubro del gasto (6 valores)
--
-- Al copiar una consulta de un módulo al otro, revisar esta columna: los tipos
-- son distintos, así que Postgres avisa — pero un `::text` la haría pasar en
-- silencio con el significado equivocado.
--
-- No hay conflicto tributario: desde la migración 0012 el IGV lo decide el TIPO
-- DE COMPROBANTE (factura lleva, recibo por honorarios no), no el tipo de
-- proveedor, que quedó como dato informativo. Por eso se puede reemplazar sin
-- tocar ningún cálculo.
--
-- ── El mínimo de S/ 700 NO se valida acá ────────────────────────────────────
-- A propósito. El monto sale de las líneas de detalle, que se llenan después de
-- crear el borrador: una restricción en la tabla impediría hasta empezar a
-- redactar la orden. La regla se aplica al EMITIR, que es el momento en que la
-- orden se vuelve un compromiso real. Vive en `src/config/oda-proveedores.ts`
-- para que cambiar el monto sea editar un número, no migrar la base.
-- ============================================================================

-- ── El tipo de proveedor: el rubro del gasto de oficina ─────────────────────
create type tipo_proveedor_oda as enum (
  'suscripciones',
  'corresponsales',
  'vinculadas',
  'servicios_oficina',
  'otros',
  'bienes'
);

-- ── Banco de códigos propio ─────────────────────────────────────────────────
-- Mismo modelo que `banco_codigos_oda`: los códigos se generan por adelantado y
-- se van tomando en orden, de modo que la numeración no tenga huecos ni saltos.
-- La serie es distinta —ODA-PROV-AAAA-NNNN— para que a simple vista se sepa que
-- una orden es de oficina y no de proyecto.
create table banco_codigos_oda_prov (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- ODA-PROV-AAAA-NNNN
  anio       int  not null,
  numero     int  not null,                 -- correlativo anual continuo
  estado     estado_codigo not null default 'disponible',
  tomado_por uuid references usuarios(id),
  tomado_en  timestamptz,
  created_at timestamptz not null default now(),
  unique (anio, numero)
);

create index idx_banco_oda_prov_estado on banco_codigos_oda_prov (anio, estado, numero);

create trigger no_borrar_banco_oda_prov before delete on banco_codigos_oda_prov
  for each row execute function trg_no_borrar();

-- Un código anulado nunca vuelve atrás, igual que en las otras series.
create trigger codigo_oda_prov_anulado_es_final before update on banco_codigos_oda_prov
  for each row execute function trg_codigo_anulado_es_final();

create or replace function generar_codigos_oda_prov(p_anio int, p_desde int, p_hasta int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_creados int;
begin
  if fn_mi_rol() not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede generar códigos';
  end if;
  insert into banco_codigos_oda_prov (codigo, anio, numero)
  select format('ODA-PROV-%s-%s', p_anio, lpad(n::text, 4, '0')), p_anio, n
  from generate_series(p_desde, p_hasta) as n
  on conflict (anio, numero) do nothing;
  get diagnostics v_creados = row_count;
  return v_creados;
end $$;

-- ── La orden ────────────────────────────────────────────────────────────────
create table ordenes_proveedores (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique references banco_codigos_oda_prov(codigo),

  -- Proveedor. Sin ficha detrás, todo se escribe a mano en esta pantalla.
  tipo_proveedor   tipo_proveedor_oda not null default 'otros',
  razon_social     text not null default '',
  nombre_comercial text not null default '',
  ruc              text not null default '',

  -- Compra.
  descripcion      text not null default '',
  monto            numeric(14,2) not null default 0 check (monto >= 0), -- SIN IGV
  moneda           moneda_tipo not null default 'PEN',
  tipo_comprobante text not null default 'factura',                     -- decide el IGV

  -- Pago.
  banco            text not null default '',
  cuenta_cci       text not null default '',
  email_proveedor  text not null default '',
  condiciones_pago text not null default '',

  -- Control y trazabilidad, igual que en las ODA de proyecto.
  estado           estado_oda not null default 'borrador',
  creada_por       uuid references usuarios(id),
  emitida_por      uuid references usuarios(id),
  fecha_emision    timestamptz,
  anulada_por      uuid references usuarios(id),
  motivo_anulacion text,
  pdf_url          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint comprobante_valido check (tipo_comprobante in ('factura', 'rxh'))
);

-- El filtro por tipo de proveedor es la consulta principal de esta pantalla.
create index idx_ordenes_prov_tipo   on ordenes_proveedores (tipo_proveedor);
create index idx_ordenes_prov_estado on ordenes_proveedores (estado);

-- Búsqueda por proveedor: el buscador de la pantalla escribe nombres sueltos,
-- así que se indexa sin distinguir mayúsculas.
create index idx_ordenes_prov_busqueda
  on ordenes_proveedores (lower(razon_social), lower(nombre_comercial));

create trigger no_borrar_ordenes_prov before delete on ordenes_proveedores
  for each row execute function trg_no_borrar();
create trigger ordenes_prov_touch before update on ordenes_proveedores
  for each row execute function trg_touch_updated_at();

-- ── Líneas de la compra ─────────────────────────────────────────────────────
-- Mismo modelo que orden_detalles: cantidad × precio unitario, con el total de
-- la línea guardado para no recalcularlo en cada lectura.
create table orden_proveedor_detalles (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references ordenes_proveedores(id) on delete cascade,
  posicion        int  not null check (posicion between 1 and 60),
  descripcion     text not null default '',
  cantidad        numeric(12,2) not null default 1 check (cantidad >= 0),
  precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0),
  monto           numeric(14,2) not null default 0 check (monto >= 0),
  created_at      timestamptz not null default now(),
  unique (orden_id, posicion)
);

create index idx_detalles_orden_prov on orden_proveedor_detalles (orden_id);

-- ── ★ Crear una orden tomando el siguiente código (ATÓMICO) ★ ───────────────
-- Mismo patrón que generar_oda: el candado por año hace que dos clics
-- simultáneos en "+ Nueva ODA" no se lleven el mismo correlativo. Sin él, dos
-- órdenes podrían pelearse un número y una fallaría dejando un hueco.
create or replace function crear_orden_proveedor()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_yo   uuid;
  v_rol  rol_usuario;
  v_anio int := extract(year from now())::int;
  v_cod  text;
  v_id   uuid;
begin
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  if v_yo is null or v_rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede crear órdenes de proveedores';
  end if;

  -- 1003 identifica a esta serie; las ODA de proyecto usan 1002.
  perform pg_advisory_xact_lock(1003, v_anio);

  select b.codigo into v_cod
    from banco_codigos_oda_prov b
   where b.estado = 'disponible' and b.anio = v_anio
   order by b.numero
   limit 1
   for update;

  if v_cod is null then
    raise exception 'No hay códigos ODA-PROV disponibles para el año %. Pide a administración generar más.', v_anio;
  end if;

  update banco_codigos_oda_prov
     set estado = 'en_uso', tomado_por = v_yo, tomado_en = now()
   where codigo = v_cod;

  insert into ordenes_proveedores (codigo, creada_por)
  values (v_cod, v_yo)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function crear_orden_proveedor()                 from public, anon;
grant  execute on function crear_orden_proveedor()                 to authenticated, service_role;
revoke execute on function generar_codigos_oda_prov(int, int, int) from public, anon;
grant  execute on function generar_codigos_oda_prov(int, int, int) to authenticated, service_role;

-- ── Seguridad a nivel de fila ───────────────────────────────────────────────
-- Mismos permisos que las ODA de proyecto: administración y gerencia. Un
-- ejecutivo no tiene por qué ver en qué gasta la oficina.
alter table banco_codigos_oda_prov   enable row level security;
alter table ordenes_proveedores      enable row level security;
alter table orden_proveedor_detalles enable row level security;

create policy banco_oda_prov_ver on banco_codigos_oda_prov
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));

create policy ordenes_prov_ver on ordenes_proveedores
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
create policy ordenes_prov_editar on ordenes_proveedores
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- No hay política de INSERT a propósito: la orden se crea únicamente por
-- crear_orden_proveedor(), que es lo que garantiza que el código salga del
-- banco y en secuencia. Un insert directo se saltaría el correlativo.

create policy detalles_prov_ver on orden_proveedor_detalles
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
create policy detalles_prov_crear on orden_proveedor_detalles
  for insert to authenticated with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy detalles_prov_editar on orden_proveedor_detalles
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy detalles_prov_borrar on orden_proveedor_detalles
  for delete to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));

-- ── Semilla de códigos ──────────────────────────────────────────────────────
-- Empieza en 1001 igual que la serie de proyectos, para que la numeración se
-- lea parecida. Mil códigos alcanzan de sobra para el gasto de oficina de un
-- año; cuando se acaben, generar_codigos_oda_prov crea más.
insert into banco_codigos_oda_prov (codigo, anio, numero)
select format('ODA-PROV-%s-%s', 2026, lpad(n::text, 4, '0')), 2026, n
from generate_series(1001, 2000) as n
on conflict (anio, numero) do nothing;
