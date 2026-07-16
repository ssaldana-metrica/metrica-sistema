-- ============================================================================
-- Migración 0018 · Nota de la cotización.
-- Comentario especial solicitado por el cliente. Opcional: si está vacío, no
-- se muestra en el PDF.
-- ============================================================================

alter table cotizaciones
  add column if not exists nota text not null default '';
