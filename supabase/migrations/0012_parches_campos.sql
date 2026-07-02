-- ============================================================================
-- Migración 0012 · Parches de campos (solo aditivo):
--   1) Razón social del cliente en la ficha de apertura.
--   2) Cuenta y CCI separados en los proveedores de la ficha y en la ODA.
--   3) Fee por cada factura del cliente (seguimiento).
--   4) Tipo de comprobante (factura / RxH) en la ODA — decide si lleva IGV.
-- La antigua columna cuenta_cci se conserva (historial) pero deja de usarse:
-- su valor se copia a la nueva columna 'cuenta'.
-- ============================================================================

-- 1) Razón social del cliente (ficha)
alter table fichas_apertura
  add column if not exists cliente_razon_social text not null default '';

-- 2) Cuenta y CCI separados — proveedores de la ficha
alter table ficha_proveedores
  add column if not exists cuenta text not null default '',
  add column if not exists cci    text not null default '';
update ficha_proveedores
   set cuenta = cuenta_cci
 where cuenta = '' and cuenta_cci <> '';

-- 2b) Cuenta y CCI separados — órdenes de adquisición (heredan estos datos)
alter table ordenes_adquisicion
  add column if not exists cuenta text not null default '',
  add column if not exists cci    text not null default '';
update ordenes_adquisicion
   set cuenta = cuenta_cci
 where cuenta = '' and cuenta_cci <> '';

-- 3) Fee por factura del cliente (nullable, como el total)
alter table ficha_facturas_cliente
  add column if not exists fee numeric(14,2);

-- 4) Tipo de comprobante en la ODA (factura lleva IGV; RxH no)
alter table ordenes_adquisicion
  add column if not exists tipo_comprobante text not null default 'factura'
    check (tipo_comprobante in ('factura', 'rxh'));
-- Coherencia con datos previos: persona natural ⇒ RxH; empresa ⇒ factura.
update ordenes_adquisicion
   set tipo_comprobante = 'rxh'
 where tipo_proveedor = 'persona_natural';
