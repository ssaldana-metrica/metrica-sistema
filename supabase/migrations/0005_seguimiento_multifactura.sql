-- ============================================================================
-- Migración 0005: seguimiento con MÚLTIPLES facturas.
-- El seguimiento del cliente y el de cada proveedor pasan de un solo registro
-- a varios (un cliente puede tener más de una factura; un proveedor también).
-- Se crean dos tablas hijas. Las columnas de seguimiento que vivían sueltas en
-- fichas_apertura y ficha_proveedores quedan en desuso (no se borran para no
-- perder historial). 'pago_fraccionado' se deja de usar.
-- ============================================================================

-- Facturas del cliente (varias por ficha).
create table ficha_facturas_cliente (
  id          uuid primary key default gen_random_uuid(),
  ficha_id    uuid not null references fichas_apertura(id),
  orden       int  not null check (orden between 1 and 40),
  num_factura text not null default '',
  oc          text not null default '',
  hes         text not null default '',
  fecha_emision date,
  total       numeric(14,2),
  created_at  timestamptz not null default now(),
  unique (ficha_id, orden)
);

-- Facturas de cada proveedor (varias por proveedor), con moneda por línea.
-- ON DELETE CASCADE: si el ejecutivo rehace su tabla de proveedores (que es
-- papel de trabajo y se reemplaza), las facturas de seguimiento de esas filas
-- se van con ellas (comportamiento esperado al reabrir y reeditar).
create table ficha_proveedor_facturas (
  id                 uuid primary key default gen_random_uuid(),
  ficha_proveedor_id uuid not null references ficha_proveedores(id) on delete cascade,
  orden              int  not null check (orden between 1 and 40),
  num_oc         text not null default '',
  num_factura    text not null default '',
  fecha_emision  date,
  total          numeric(14,2),
  moneda_total   moneda_tipo not null default 'PEN',
  importe        numeric(14,2),
  moneda_importe moneda_tipo not null default 'PEN',
  created_at     timestamptz not null default now(),
  unique (ficha_proveedor_id, orden)
);

create index idx_ffc_ficha on ficha_facturas_cliente (ficha_id);
create index idx_fpf_prov  on ficha_proveedor_facturas (ficha_proveedor_id);

alter table ficha_facturas_cliente   enable row level security;
alter table ficha_proveedor_facturas enable row level security;

-- Ver: si la ficha es visible (ejecutivo dueño o admin/gerencia).
create policy ffc_ver on ficha_facturas_cliente
  for select to authenticated
  using (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_facturas_cliente.ficha_id
      and (fn_mi_rol() in ('admin', 'gerencia') or c.ejecutivo_id = fn_mi_id())
  ));

-- Gestionar (insert/update/delete): solo admin/gerencia (es seguimiento).
create policy ffc_admin_ins on ficha_facturas_cliente
  for insert to authenticated with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy ffc_admin_upd on ficha_facturas_cliente
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy ffc_admin_del on ficha_facturas_cliente
  for delete to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));

create policy fpf_ver on ficha_proveedor_facturas
  for select to authenticated
  using (exists (
    select 1 from ficha_proveedores p
    join fichas_apertura f on f.id = p.ficha_id
    join cotizaciones c on c.id = f.cotizacion_id
    where p.id = ficha_proveedor_facturas.ficha_proveedor_id
      and (fn_mi_rol() in ('admin', 'gerencia') or c.ejecutivo_id = fn_mi_id())
  ));

create policy fpf_admin_ins on ficha_proveedor_facturas
  for insert to authenticated with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy fpf_admin_upd on ficha_proveedor_facturas
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy fpf_admin_del on ficha_proveedor_facturas
  for delete to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
