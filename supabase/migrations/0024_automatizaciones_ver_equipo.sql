-- ============================================================================
-- Migración 0024 · Automatizaciones: separar VER de ADMINISTRAR
--
-- La 0022 dejó todo cerrado a gerencia. Gerencia pidió que el resto del equipo
-- pueda ver que la tarea está corriendo, si el correo salió con normalidad y
-- el historial de ejecuciones — pero sin poder tocar nada.
--
-- Qué se abre a cualquier usuario activo:
--   automatizaciones          → estado, interruptor, última corrida (solo leer)
--   automatizacion_ejecuciones → el historial de corridas
--
-- Qué sigue siendo solo de gerencia:
--   normas_legales_destinatarios → es una lista de distribución; quién recibe
--                                  qué no tiene por qué ser visible para todos
--   normas_legales_terminos      → configuración de la vigilancia
--   normas_legales_cuentas       → qué clientes se monitorean
--   normas_legales_hallazgos     → el contenido monitoreado en sí
--
-- Y escribir en cualquiera de las siete tablas sigue siendo solo de gerencia:
-- esta migración no crea ni un permiso de escritura nuevo.
--
-- ── Por qué `fn_mi_rol() is not null` y no `true` ───────────────────────────
-- `to authenticated` solo exige un JWT válido de Supabase. `fn_mi_rol()`
-- devuelve NULL si el correo no está en `usuarios` o está dado de baja, así
-- que esta condición significa "es un usuario activo del sistema" — que es la
-- barrera real que usa el resto del proyecto. Un usuario dado de baja que
-- conserve su sesión de Google no ve nada.
-- ============================================================================

-- ── El estado de cada automatización: lo ve todo el equipo ──────────────────
drop policy automatizaciones_ver on automatizaciones;

create policy automatizaciones_ver on automatizaciones
  for select to authenticated using (fn_mi_rol() is not null);

-- La política de edición NO se toca: prender, apagar y cambiar el modo prueba
-- sigue siendo exclusivo de gerencia.

-- ── El historial de corridas: lo ve todo el equipo ──────────────────────────
drop policy ejecuciones_ver on automatizacion_ejecuciones;

create policy ejecuciones_ver on automatizacion_ejecuciones
  for select to authenticated using (fn_mi_rol() is not null);

-- Sigue sin haber política de INSERT ni UPDATE sobre el historial: lo escribe
-- únicamente el proceso automático con la llave privilegiada (service_role),
-- que salta RLS. Nadie puede fabricar ni retocar una corrida desde el
-- navegador, y eso es justamente lo que hace que el historial sirva como
-- prueba de que la tarea corrió.
