-- ============================================================================
-- Fase 3 · ajuste: la orden pasa de un solo detalle a VARIAS líneas de compra
-- (descripción + monto). El total de la orden es la suma de sus líneas. La
-- moneda y las condiciones de pago siguen a nivel de la orden.
-- ============================================================================

create table orden_detalles (
  id          uuid primary key default gen_random_uuid(),
  orden_id    uuid not null references ordenes_adquisicion(id) on delete cascade,
  posicion    int  not null check (posicion between 1 and 60),
  descripcion text not null default '',
  monto       numeric(14,2) not null default 0 check (monto >= 0),
  created_at  timestamptz not null default now(),
  unique (orden_id, posicion)
);

create index idx_orden_detalles_orden on orden_detalles (orden_id);

-- RLS: igual que la orden — admin y gerencia leen y escriben.
alter table orden_detalles enable row level security;

create policy orden_det_ver on orden_detalles
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
create policy orden_det_crear on orden_detalles
  for insert to authenticated with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy orden_det_editar on orden_detalles
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy orden_det_quitar on orden_detalles
  for delete to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
