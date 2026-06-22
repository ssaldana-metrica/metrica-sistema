-- ============================================================================
-- Fase 3 · ajuste: cada línea de detalle pasa a tener CANTIDAD y PRECIO
-- UNITARIO; el total de la línea es cantidad × precio_unitario (se guarda en
-- `monto`, que sigue siendo el total de la línea). Backfill: las líneas que ya
-- existían toman cantidad 1 y precio_unitario = su monto actual.
-- ============================================================================

alter table orden_detalles
  add column cantidad        numeric(12,2) not null default 1 check (cantidad >= 0),
  add column precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0);

update orden_detalles set precio_unitario = monto;
