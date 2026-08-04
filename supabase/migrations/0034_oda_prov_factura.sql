-- ============================================================================
-- Migración 0034 · Seguimiento de la factura del proveedor
--
-- Dos datos que faltaban en las órdenes a proveedores: el número de la factura
-- que envía el proveedor y cuándo se recibió. Sin ellos no había forma de saber
-- desde el sistema qué órdenes ya tienen su comprobante y cuáles siguen
-- esperándolo.
--
-- ── Solo tienen sentido cuando la orden está emitida ────────────────────────
-- Una factura llega DESPUÉS de que la orden salió al proveedor: en borrador no
-- hay nada que facturar. Esa regla se aplica en el servidor y no como
-- restricción de la tabla, por la misma razón que el mínimo de S/ 700 — una
-- restricción rígida estorbaría más de lo que protege, y el dato no es
-- peligroso, solo prematuro.
--
-- Lo que sí conviene dejar claro: si una orden se anula DESPUÉS de haber
-- recibido su factura, el dato se conserva y se sigue viendo. Borrarlo
-- escondería que hubo un comprobante de por medio, que es justo lo que más
-- interesa saber al revisar una anulación.
--
-- ── Quién y cuándo ──────────────────────────────────────────────────────────
-- Se guarda aparte de `updated_at`, que cambia con cualquier edición de la
-- orden. Estos dos campos responden específicamente "quién cargó la factura",
-- que es una pregunta distinta de "quién tocó la orden por última vez".
-- ============================================================================

alter table ordenes_proveedores
  add column factura_numero          text not null default '',
  add column factura_recibida_en     date,
  add column factura_actualizada_por uuid references usuarios(id),
  add column factura_actualizada_en  timestamptz;

-- Para responder "qué órdenes emitidas siguen sin factura", que es la consulta
-- que de verdad se hace.
create index idx_ordenes_prov_sin_factura
  on ordenes_proveedores (estado)
  where factura_numero = '';
