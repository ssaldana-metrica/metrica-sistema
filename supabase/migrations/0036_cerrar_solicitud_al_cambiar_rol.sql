-- ============================================================================
-- Migración 0036 · Cambiar el rol cierra la solicitud pendiente
--
-- EL FALLO QUE CIERRA. La primera persona que usó el flujo nuevo —Paola, el 4 de
-- agosto— pidió Administración y su solicitud quedó pendiente. La pantalla de
-- Usuarios no llegó a mostrarla nunca (ese era un error aparte, en la consulta),
-- así que gerencia hizo lo natural: le cambió el rol a mano desde el selector de
-- la tabla.
--
-- El rol cambió. La solicitud siguió en `pendiente`. Y como la franja de aviso
-- se dibuja mirando la solicitud y no el rol, Paola —ya administradora— seguía
-- leyendo «tu solicitud está pendiente, mientras tanto trabajas como Ejecutivo».
-- El sistema le mentía por escrito en todas las pantallas.
--
-- ── Por qué en la base y no solo en la acción del servidor ──────────────────
-- Porque son dos hechos que describen lo mismo —qué rol tiene una persona— y
-- viven en dos tablas. Si la sincronía depende de que quien escriba la próxima
-- pantalla se acuerde, va a volver a pasar. Acá el rol no puede cambiar sin que
-- la solicitud se cierre: es la misma transacción.
--
-- ── Aprobada o rechazada, según lo que pasó de verdad ───────────────────────
-- Si el rol nuevo es el que se pidió, la solicitud queda `aprobada`. Si es otro
-- —gerencia decidió dejarla en Ejecutivo, o darle algo distinto— queda
-- `rechazada`. En los dos casos con autor y fecha, que es la regla del sistema.
--
-- ── El caso sin sesión ──────────────────────────────────────────────────────
-- Si el cambio viene de la llave privilegiada no hay a quién atribuir la
-- decisión, y la restricción `resolucion_completa` exige un autor. En ese caso
-- el disparador no hace nada y la solicitud sigue pendiente: preferimos una
-- solicitud sin resolver a un registro que dice que alguien decidió cuando no
-- fue nadie. Hoy no existe ningún camino así en la aplicación.
-- ============================================================================

create or replace function trg_cerrar_solicitud_al_cambiar_rol()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid;
begin
  if new.rol is not distinct from old.rol then
    return new;
  end if;

  v_yo := fn_mi_id();
  if v_yo is null then
    return new;  -- ver la cabecera: sin autor no se cierra nada
  end if;

  update solicitudes_rol s
     set estado = case
                    when s.rol_solicitado = new.rol then 'aprobada'::estado_solicitud_rol
                    else 'rechazada'::estado_solicitud_rol
                  end,
         resuelta_por = v_yo,
         resuelta_en  = now()
   where s.usuario_id = new.id
     and s.estado = 'pendiente';

  return new;
end $$;

create trigger cerrar_solicitud_al_cambiar_rol after update of rol on usuarios
  for each row execute function trg_cerrar_solicitud_al_cambiar_rol();

-- ── El arrastre de lo que ya pasó ───────────────────────────────────────────
-- No se toca ninguna solicitud existente. La de Paola sigue pendiente a
-- propósito: así gerencia puede aprobarla desde la pantalla ya corregida, que
-- es lo que dispara el correo de «tu rol fue aprobado». Cerrarla acá a mano la
-- dejaría bien en la base y sin avisarle a ella, que es la mitad del problema.
