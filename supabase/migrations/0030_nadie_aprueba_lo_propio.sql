-- ============================================================================
-- Migración 0030 · Nadie aprueba su propia cotización, gerencia incluida
--
-- Hasta ahora la regla tenía una excepción: gerencia sí podía aprobar lo que
-- ella misma cotizaba. La 0019 lo dejó escrito así —`if v_rol = 'admin' and
-- old.ejecutivo_id = v_yo`— con el argumento de que gerencia supervisa el
-- sistema y necesita probar el flujo completo.
--
-- La dueña del proceso lo revisó y decidió lo contrario: el control de cuatro
-- ojos no admite excepciones por rango. Una cotización creada por gerencia la
-- aprueba otra persona con rol admin o gerencia; nunca la misma.
--
-- El cambio es una sola línea de la máquina de estados: se quita el
-- `v_rol = 'admin' and`, de modo que la comprobación se aplique a quienquiera
-- que sea el autor.
--
-- ── Por qué acá y no en una política RLS ────────────────────────────────────
-- La política de UPDATE de `cotizaciones` (`cotizaciones_resolver`) cubre TODA
-- edición administrativa, no solo la aprobación: desde la 0016 un admin puede
-- corregir una cotización ajena o propia. Meter ahí "no puedes tocar la tuya"
-- rompería esa edición legítima. La máquina de estados, en cambio, ya
-- distingue transición por transición, así que la regla vive justo donde
-- corresponde: en el paso pendiente → aprobada.
--
-- Sigue siendo una barrera de base de datos, no de pantalla: aunque alguien
-- llamara la API directamente, el trigger la rechaza.
--
-- Se mantiene intacto todo lo demás, incluidos los dos escapes de arriba:
-- service_role (el servidor de confianza) y la reactivación controlada.
-- ============================================================================

create or replace function trg_cotizacion_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol   rol_usuario;
  v_yo    uuid;
  v_admin boolean;
begin
  -- El cliente service_role (servidor de confianza, jamás expuesto al usuario)
  -- no pasa por estas reglas.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Reactivación controlada (reactivar_proceso fija este flag de transacción):
  -- es el único camino por el que una cotización 'anulada' vuelve a la vida.
  if coalesce(current_setting('app.reactivando', true), '') = 'on' then
    return new;
  end if;

  v_rol   := fn_mi_rol();
  v_yo    := fn_mi_id();
  v_admin := v_rol in ('admin', 'gerencia');

  -- Los campos de aprobación/anulación solo los toca administración.
  if not v_admin then
    if new.aprobada_por     is distinct from old.aprobada_por
       or new.fecha_aprobacion is distinct from old.fecha_aprobacion
       or new.anulada_por      is distinct from old.anulada_por
       or new.motivo_anulacion is distinct from old.motivo_anulacion then
      raise exception 'No estás autorizado a modificar los datos de aprobación o anulación';
    end if;
  end if;

  -- Sin cambio de estado: es edición de datos (ya validamos los campos sensibles).
  if new.estado = old.estado then
    return new;
  end if;

  -- 'anulada' es un estado final (la única salida es reactivar_proceso, ya cubierto).
  if old.estado = 'anulada' then
    raise exception 'Una cotización anulada no puede cambiar de estado';
  end if;

  -- Anular: solo administración, desde cualquier estado.
  if new.estado = 'anulada' then
    if not v_admin then
      raise exception 'Solo administración puede anular una cotización';
    end if;
    return new;
  end if;

  -- Aprobar: solo administración, solo desde 'pendiente', y el aprobador NUNCA
  -- puede ser el autor — sin excepción por rol. Gerencia también necesita que
  -- otra persona apruebe lo suyo.
  if new.estado = 'aprobada' then
    if not v_admin then
      raise exception 'Solo administración puede aprobar una cotización';
    end if;
    if old.estado <> 'pendiente' then
      raise exception 'Solo se puede aprobar una cotización pendiente';
    end if;
    if old.ejecutivo_id = v_yo then
      raise exception 'Control interno: no puedes aprobar tu propia cotización';
    end if;
    return new;
  end if;

  -- Observar / reabrir → 'observada': solo administración, desde pendiente o aprobada.
  if new.estado = 'observada' then
    if not v_admin then
      raise exception 'Solo administración puede observar o reabrir una cotización';
    end if;
    if old.estado not in ('pendiente', 'aprobada') then
      raise exception 'Transición no permitida hacia observada';
    end if;
    return new;
  end if;

  -- Enviar a 'pendiente': el dueño o administración, desde borrador u observada.
  if new.estado = 'pendiente' then
    if old.estado not in ('borrador', 'observada') then
      raise exception 'Transición no permitida hacia pendiente';
    end if;
    if not (v_admin or old.ejecutivo_id = v_yo) then
      raise exception 'No estás autorizado a enviar esta cotización';
    end if;
    return new;
  end if;

  -- Volver a 'borrador': el dueño o administración, solo desde observada.
  if new.estado = 'borrador' then
    if old.estado <> 'observada' then
      raise exception 'Transición no permitida hacia borrador';
    end if;
    if not (v_admin or old.ejecutivo_id = v_yo) then
      raise exception 'No estás autorizado';
    end if;
    return new;
  end if;

  raise exception 'Transición de estado no permitida (% -> %)', old.estado, new.estado;
end $$;
