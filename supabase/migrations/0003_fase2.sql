-- ============================================================================
-- MÉTRICA · Sistema Operativo — Fase 2: Ficha de Apertura
-- Migración 0003: tablas de la ficha (1 a 1 con la cotización aprobada) y su
-- tabla de proveedores (se llena de cero), con trazabilidad y RLS al estilo
-- de la Fase 1. Reutiliza moneda_tipo, fn_mi_id/fn_mi_rol y trg_no_borrar.
-- ============================================================================

-- ── Tipo enumerado ───────────────────────────────────────────────────────────
-- Cierre en DOS pasos: el ejecutivo marca su parte → lista_ejecutivo;
-- el admin cierra → completa. Reversible (admin reabre a en_proceso).
create type estado_ficha as enum ('en_proceso', 'lista_ejecutivo', 'completa');

-- ── Ficha de apertura (1 a 1 con la cotización) ─────────────────────────────
create table fichas_apertura (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null unique references cotizaciones(id),
  codigo        text not null unique,            -- derivado: FA-COT-AAAA-NNNN
  estado        estado_ficha not null default 'en_proceso',

  -- Datos del cliente: cliente_nombre y cliente_ruc se HEREDAN de la
  -- cotización; los otros tres arrancan vacíos y los llena el ejecutivo
  -- (la política de pago es variable por servicio, no fija por cliente).
  cliente_nombre      text not null default '',
  cliente_ruc         text not null default '',
  politica_pago       text not null default '',
  contacto_aprobacion text not null default '',
  correo_contacto     text not null default '',

  -- Datos del servicio (los llena el ejecutivo).
  inicio_acciones        date,
  fin_acciones           date,
  facturar_antes_del_fin boolean not null default false,
  moneda                 moneda_tipo not null default 'PEN', -- moneda general
  observaciones_ejecutivo text not null default '',

  -- Seguimiento de administración a nivel cliente.
  num_factura_cliente   text not null default '',
  oc_cliente            text not null default '',
  hes                   text not null default '',
  fecha_emision_factura date,
  total_seguimiento     numeric(14,2),

  -- Control del cierre en dos pasos (con trazabilidad de quién y cuándo).
  lista_ejecutivo_en  timestamptz,
  lista_ejecutivo_por uuid references usuarios(id),
  completada_por      uuid references usuarios(id),
  fecha_completada    timestamptz,
  reabierta_por       uuid references usuarios(id),
  fecha_reapertura    timestamptz,

  pdf_url    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Proveedores de la ficha (se llena DE CERO; no hereda de la cotización) ──
-- Quien cobra no siempre es quien se cotizó. SIN columna moneda en la parte
-- del ejecutivo: usa la moneda general de la ficha. El seguimiento del admin
-- SÍ lleva moneda por línea (el monto real puede diferir de la moneda general).
create table ficha_proveedores (
  id       uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references fichas_apertura(id),
  orden    int  not null check (orden between 1 and 60),

  -- Lo que llena el ejecutivo (sin moneda por línea).
  agencia              text not null default '',
  influencer_proveedor text not null default '',
  ruc                  text not null default '',
  descripcion          text not null default '',
  monto                numeric(14,2) not null default 0 check (monto >= 0),
  banco                text not null default '',
  cuenta_cci           text not null default '',
  email_proveedor      text not null default '',

  -- Seguimiento del admin para este proveedor (moneda por línea).
  num_oc           text not null default '',
  num_factura      text not null default '',
  fecha_emision    date,
  total            numeric(14,2),
  moneda_total     moneda_tipo not null default 'PEN',
  importe          numeric(14,2),
  moneda_importe   moneda_tipo not null default 'PEN',
  pago_fraccionado boolean not null default false,

  created_at timestamptz not null default now(),
  unique (ficha_id, orden)
);

create index idx_fichas_estado     on fichas_apertura (estado);
create index idx_fichas_cotizacion on fichas_apertura (cotizacion_id);
create index idx_ficha_prov_ficha  on ficha_proveedores (ficha_id);

-- ── Trazabilidad ─────────────────────────────────────────────────────────────
-- La ficha es un registro: nunca se borra (igual que las cotizaciones).
-- Las filas de proveedores son papel de trabajo del ejecutivo: SÍ se pueden
-- quitar mientras la ficha está en proceso (igual que cotizacion_items).
create trigger no_borrar_fichas before delete on fichas_apertura
  for each row execute function trg_no_borrar();

create trigger fichas_touch before update on fichas_apertura
  for each row execute function trg_touch_updated_at();

-- ── Seguridad a nivel de fila (RLS) ─────────────────────────────────────────
alter table fichas_apertura  enable row level security;
alter table ficha_proveedores enable row level security;

-- Ver: admin y gerencia ven todas; el ejecutivo solo las de SUS cotizaciones.
create policy fichas_ver on fichas_apertura
  for select to authenticated
  using (
    fn_mi_rol() in ('admin', 'gerencia')
    or exists (
      select 1 from cotizaciones c
      where c.id = fichas_apertura.cotizacion_id
        and c.ejecutivo_id = fn_mi_id()
    )
  );

-- Crear: nadie por la API. La ficha nace SOLO desde el servidor (service_role,
-- que ignora el RLS) al aprobarse la cotización. No hay política de insert.

-- Editar (ejecutivo dueño, solo mientras en_proceso): puede guardar sus datos
-- y, a lo sumo, mover el estado a lista_ejecutivo. Jamás a completa.
create policy fichas_editar_ejecutivo on fichas_apertura
  for update to authenticated
  using (
    estado = 'en_proceso'
    and exists (
      select 1 from cotizaciones c
      where c.id = fichas_apertura.cotizacion_id
        and c.ejecutivo_id = fn_mi_id()
    )
  )
  with check (
    estado in ('en_proceso', 'lista_ejecutivo')
    and exists (
      select 1 from cotizaciones c
      where c.id = fichas_apertura.cotizacion_id
        and c.ejecutivo_id = fn_mi_id()
    )
  );

-- Admin y gerencia: seguimiento, cierre y reapertura (cualquier estado).
create policy fichas_admin on fichas_apertura
  for update to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- Proveedores de la ficha: visibles si la ficha es visible.
create policy ficha_prov_ver on ficha_proveedores
  for select to authenticated
  using (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_proveedores.ficha_id
      and (fn_mi_rol() in ('admin', 'gerencia') or c.ejecutivo_id = fn_mi_id())
  ));

-- El ejecutivo dueño llena/quita filas mientras la ficha está en proceso.
create policy ficha_prov_crear on ficha_proveedores
  for insert to authenticated
  with check (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_proveedores.ficha_id
      and c.ejecutivo_id = fn_mi_id()
      and f.estado = 'en_proceso'
  ));

create policy ficha_prov_quitar on ficha_proveedores
  for delete to authenticated
  using (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_proveedores.ficha_id
      and c.ejecutivo_id = fn_mi_id()
      and f.estado = 'en_proceso'
  ));

-- Admin y gerencia actualizan el seguimiento por proveedor (en su sitio,
-- sin recrear filas) en cualquier estado.
create policy ficha_prov_admin on ficha_proveedores
  for update to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- ── Almacenamiento de PDFs de fichas ────────────────────────────────────────
-- Bucket privado; se entregan con enlaces firmados desde el servidor.
insert into storage.buckets (id, name, public)
values ('fichas', 'fichas', false)
on conflict (id) do nothing;
