-- ============================================================================
-- Fase 3 · Bloque 2: tabla de Órdenes de Adquisición (ODA).
-- Una orden por proveedor de ficha (ficha_proveedor_id único). Hereda datos
-- editables; vínculo con la cotización SOLO interno (cotizacion_codigo, nunca
-- se imprime). RLS: admin y gerencia leen y escriben; ejecutivo sin acceso.
-- ============================================================================

create table ordenes_adquisicion (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique references banco_codigos_oda(codigo),
  ficha_id           uuid not null references fichas_apertura(id),
  ficha_proveedor_id uuid not null unique references ficha_proveedores(id),
  cotizacion_codigo  text not null default '',     -- referencia interna, no se imprime

  -- Datos heredados de la ficha, editables por admin antes de emitir.
  agencia              text not null default '',
  influencer_proveedor text not null default '',
  razon_social         text not null default '',
  nombre_comercial     text not null default '',
  ruc                  text not null default '',
  tipo_proveedor       tipo_proveedor not null default 'empresa',
  descripcion          text not null default '',
  monto                numeric(14,2) not null default 0 check (monto >= 0),
  moneda               moneda_tipo not null default 'PEN',
  banco                text not null default '',
  cuenta_cci           text not null default '',
  email_proveedor      text not null default '',
  condiciones_pago     text not null default '',

  -- Control y trazabilidad.
  estado           estado_oda not null default 'borrador',
  emitida_por      uuid references usuarios(id),
  fecha_emision    timestamptz,
  anulada_por      uuid references usuarios(id),
  motivo_anulacion text,
  pdf_url          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_ordenes_estado     on ordenes_adquisicion (estado);
create index idx_ordenes_ficha       on ordenes_adquisicion (ficha_id);
create index idx_ordenes_cot         on ordenes_adquisicion (cotizacion_codigo);

-- Trazabilidad: no se borra; updated_at automático.
create trigger no_borrar_ordenes before delete on ordenes_adquisicion
  for each row execute function trg_no_borrar();
create trigger ordenes_touch before update on ordenes_adquisicion
  for each row execute function trg_touch_updated_at();

-- ── RLS: admin y gerencia leen y escriben; el ejecutivo no accede ───────────
alter table ordenes_adquisicion enable row level security;

create policy ordenes_ver on ordenes_adquisicion
  for select to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'));

create policy ordenes_crear on ordenes_adquisicion
  for insert to authenticated
  with check (fn_mi_rol() in ('admin', 'gerencia'));

create policy ordenes_editar on ordenes_adquisicion
  for update to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- ── Almacenamiento de PDFs de órdenes (bucket privado) ──────────────────────
insert into storage.buckets (id, name, public)
values ('ordenes', 'ordenes', false)
on conflict (id) do nothing;
