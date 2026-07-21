-- ============================================================================
-- Migración 0019 · Máquina de estados de cotizaciones en la BASE (no solo en la app)
--
-- Auditoría (crítico #1 y alto #3): las políticas RLS de `cotizaciones` solo
-- validan QUIÉN es el dueño / el rol, pero NO qué transición de estado se hace.
-- Como el cliente de servidor usa la anon key con la sesión (rol authenticated),
-- un usuario podía hacer un PATCH directo a PostgREST y, p. ej., pasar su
-- cotización en 'borrador' a 'aprobada' falsificando el aprobador, o un admin
-- podía aprobar la suya propia. La única defensa vivía en el código de las
-- Server Actions. Aquí la trasladamos a la BASE con un trigger BEFORE UPDATE que
-- es la fuente de verdad de la máquina de estados, sin importar quién llame.
--
-- Transiciones legítimas (verificadas contra el código):
--   borrador  -> pendiente        (dueño o administración: enviar)
--   observada -> pendiente        (dueño o administración: reenviar)
--   observada -> borrador         (dueño o administración: volver a borrador)
--   pendiente -> aprobada         (SOLO administración; admin ≠ autor, salvo gerencia)
--   pendiente -> observada        (SOLO administración: observar)
--   aprobada  -> observada        (SOLO administración: reabrir)
--   cualquiera-> anulada          (SOLO administración: anular_proceso)
--   anulada   -> estado previo    (SOLO durante reactivar_proceso, flag app.reactivando='on')
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

  -- Aprobar: solo administración, solo desde 'pendiente', y el aprobador no
  -- puede ser el autor (control interno; gerencia queda exenta).
  if new.estado = 'aprobada' then
    if not v_admin then
      raise exception 'Solo administración puede aprobar una cotización';
    end if;
    if old.estado <> 'pendiente' then
      raise exception 'Solo se puede aprobar una cotización pendiente';
    end if;
    if v_rol = 'admin' and old.ejecutivo_id = v_yo then
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

drop trigger if exists cotizaciones_transicion on cotizaciones;
create trigger cotizaciones_transicion
  before update on cotizaciones
  for each row execute function trg_cotizacion_transicion();

-- ── Defensa en profundidad en las políticas RLS ─────────────────────────────
-- Aunque el trigger es la fuente de verdad, acotamos también el WITH CHECK para
-- que ni siquiera se acepte escribir estados prohibidos por esta vía.

-- El ejecutivo dueño solo puede dejar la fila en borrador/observada/pendiente
-- (incluye 'pendiente' para poder ENVIAR; nunca 'aprobada'/'anulada').
drop policy if exists cotizaciones_editar_propia on cotizaciones;
create policy cotizaciones_editar_propia on cotizaciones
  for update to authenticated
  using (ejecutivo_id = fn_mi_id() and estado in ('borrador', 'observada'))
  with check (
    ejecutivo_id = fn_mi_id()
    and estado in ('borrador', 'observada', 'pendiente')
  );

-- Crear directo por la API solo puede nacer en 'borrador' (el flujo real usa la
-- función crear_cotizacion, que corre como owner y no pasa por esta política).
drop policy if exists cotizaciones_crear on cotizaciones;
create policy cotizaciones_crear on cotizaciones
  for insert to authenticated
  with check (
    ejecutivo_id = fn_mi_id()
    and estado = 'borrador'
    and exists (
      select 1 from banco_codigos b
      where b.codigo = cotizaciones.codigo
        and b.estado = 'en_uso'
        and b.tomado_por = fn_mi_id()
    )
  );
