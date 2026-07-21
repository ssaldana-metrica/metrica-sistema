-- ============================================================================
-- Migración 0021 · Cerrar las funciones de banco en desuso (auditoría medio #5)
--
-- tomar_codigo() y tomar_codigo_oda() quedaron obsoletas: desde 0014/0015 los
-- correlativos se asignan DENTRO de crear_cotizacion()/generar_oda() con
-- advisory lock (sin huecos ni duplicados). Pero seguían concedidas a
-- 'authenticated' y no validan rol: marcan un código como 'en_uso' SIN crear
-- ningún documento, así que un ejecutivo podía invocarlas por RPC y quemar
-- números correlativos, dejando huecos permanentes en la numeración.
--
-- Se revoca su ejecución a todos los roles expuestos por la API. La generación
-- de correlativos pasa únicamente por crear_cotizacion/generar_oda.
-- ============================================================================

revoke execute on function tomar_codigo()     from public, anon, authenticated;
revoke execute on function tomar_codigo_oda() from public, anon, authenticated;
