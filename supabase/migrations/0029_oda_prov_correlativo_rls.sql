-- ============================================================================
-- Migración 0029 · SEGURIDAD: proteger el contador de ODA-PROV
--
-- La migración 0028 creó `oda_prov_correlativo` y olvidó activarle RLS. Era la
-- única de las 24 tablas del sistema sin protección: cualquiera con la clave
-- pública (`anon`), que viaja en el navegador y por lo tanto es visible para
-- todo el mundo, podía leerla y escribirla.
--
-- ── Por qué importaba de verdad ─────────────────────────────────────────────
-- Esa tabla guarda el último número de orden entregado. Con acceso de
-- escritura, alguien podía bajar el contador y hacer que la siguiente orden
-- reutilizara un número ya usado — dos documentos distintos con el mismo
-- código, que es exactamente lo que toda la numeración del sistema existe para
-- evitar. Y como el contador es lo único que decide el correlativo, no había
-- ninguna otra barrera detrás.
--
-- ── El patrón que se replica ────────────────────────────────────────────────
-- El mismo de `banco_codigos` y `banco_codigos_oda`, que ya estaban bien:
--
--   1. RLS activado.
--   2. UNA política, y solo de SELECT.
--   3. CERO políticas de INSERT, UPDATE o DELETE.
--
-- El punto es el 3. Sin política de escritura, RLS bloquea toda escritura
-- directa desde el navegador — no hay nada que "burlar", simplemente no existe
-- permiso. La única forma de mover el contador es `crear_orden_proveedor()`,
-- que al ser SECURITY DEFINER corre con los privilegios de su dueño y no pasa
-- por RLS. Esa función ya valida rol admin/gerencia antes de tocar nada.
--
-- El SELECT se concede a admin y gerencia, igual que en `banco_codigos_oda`
-- (que es la serie equivalente). Poder leer el contador no permite alterarlo.
-- ============================================================================

alter table oda_prov_correlativo enable row level security;

create policy oda_prov_correlativo_ver on oda_prov_correlativo
  for select to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'));

-- Intencionalmente NO se crean políticas de insert, update ni delete.
-- Escribir el contador es exclusivo de crear_orden_proveedor().
