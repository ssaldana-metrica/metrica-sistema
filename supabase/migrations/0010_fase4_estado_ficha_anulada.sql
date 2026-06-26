-- ============================================================================
-- MÉTRICA · Fase 4 — Tabla de Control General
-- Migración 0010: la ficha de apertura gana el estado 'anulada' (necesario
-- para la anulación en cascada). Va sola porque Postgres exige confirmar el
-- valor nuevo del enum antes de poder usarlo en una función.
-- ============================================================================

alter type estado_ficha add value if not exists 'anulada';
