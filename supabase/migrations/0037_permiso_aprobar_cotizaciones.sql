-- ============================================================================
-- Migración 0037 · Aprobar cotizaciones pasa a ser un permiso, no parte del rol
--
-- QUÉ CAMBIA. Hasta hoy, tener rol de Administración implicaba poder aprobar
-- cotizaciones. Eran la misma cosa. A partir de acá son dos: el rol da acceso a
-- las órdenes, la tabla de control y la información comercial; **aprobar** es un
-- permiso aparte que gerencia concede persona por persona.
--
-- Por qué tiene sentido separarlos: aprobar una cotización es comprometer plata.
-- No todo el que necesita ver y emitir órdenes tiene por qué poder hacerlo, y
-- hasta ahora no había forma de distinguirlo sin quitarle el rol entero —lo que
-- también le habría quitado su trabajo diario.
--
-- ── El arranque: los que ya aprobaban siguen aprobando ──────────────────────
-- La columna nace en `false`, pero a los administradores que YA existen se les
-- enciende. Arrancar con todos en `false` habría dejado la cola de aprobación
-- sin nadie de un día para otro, y eso no es un cambio de permisos: es una
-- caída. Gerencia va quitando el permiso a quien corresponda, que es como se
-- pidió («que se les pueda denegar»).
--
-- Igual que la semilla de la 0033, el UPDATE va ANTES de que el disparador
-- exija ser gerencia para tocar esta columna.
--
-- ── Gerencia siempre puede, y no necesita el permiso ────────────────────────
-- Mismo criterio que `puede_reactivar`: el permiso existe para los roles que no
-- lo tienen por definición. A gerencia no se le enciende ni se le apaga —la
-- comprobación es `rol = 'gerencia' or puede_aprobar_cotizaciones`— para que no
-- exista el estado absurdo de una gerencia que no puede aprobar nada.
--
-- Lo que NO cambia: el control de cuatro ojos de la 0030. Tener el permiso no
-- te deja aprobar lo tuyo.
-- ============================================================================

alter table usuarios
  add column puede_aprobar_cotizaciones boolean not null default false;

comment on column usuarios.puede_aprobar_cotizaciones is
  'Permiso para aprobar u observar cotizaciones. Solo aplica a rol admin: gerencia siempre puede. Lo concede gerencia desde el módulo de Usuarios.';

-- ── Semilla, ANTES del candado ──────────────────────────────────────────────
update usuarios
   set puede_aprobar_cotizaciones = true
 where rol = 'admin';

-- ── ★ La barrera real: la máquina de estados ★ ──────────────────────────────
-- Se reescribe entera porque en Postgres no hay otra forma. Respecto de la
-- 0030 cambia UNA cosa: `v_aprueba`, que se exige para aprobar y para observar.
--
-- Por qué también para observar: devolver una cotización al ejecutivo con un
-- comentario es la otra mitad de la misma decisión. Quien no puede aprobarla
-- tampoco debería poder rechazarla — si no, bastaría con observar todo lo que a
-- uno no le convenga para bloquear el proceso sin dejar rastro de aprobación.
--
-- Anular NO se toca: sigue siendo cosa del rol. Anular es un acto
-- administrativo con motivo obligatorio y traza, no una decisión de gasto.
create or replace function trg_cotizacion_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol     rol_usuario;
  v_yo      uuid;
  v_admin   boolean;
  v_aprueba boolean;
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

  -- Gerencia siempre puede; un admin, solo si tiene el permiso encendido.
  select u.rol = 'gerencia' or coalesce(u.puede_aprobar_cotizaciones, false)
    into v_aprueba
    from usuarios u where u.id = v_yo;
  v_aprueba := coalesce(v_aprueba, false);

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

  -- Anular: solo administración, desde cualquier estado. No exige el permiso de
  -- aprobar: son dos actos distintos.
  if new.estado = 'anulada' then
    if not v_admin then
      raise exception 'Solo administración puede anular una cotización';
    end if;
    return new;
  end if;

  -- Aprobar: administración CON el permiso, solo desde 'pendiente', y el
  -- aprobador NUNCA puede ser el autor — sin excepción por rol.
  if new.estado = 'aprobada' then
    if not v_admin then
      raise exception 'Solo administración puede aprobar una cotización';
    end if;
    if not v_aprueba then
      raise exception 'No tienes el permiso de aprobar cotizaciones. Lo concede gerencia desde el módulo de Usuarios';
    end if;
    if old.estado <> 'pendiente' then
      raise exception 'Solo se puede aprobar una cotización pendiente';
    end if;
    if old.ejecutivo_id = v_yo then
      raise exception 'Control interno: no puedes aprobar tu propia cotización';
    end if;
    return new;
  end if;

  -- Observar / reabrir → 'observada': la otra mitad de la misma decisión, así
  -- que exige el mismo permiso.
  if new.estado = 'observada' then
    if not v_admin then
      raise exception 'Solo administración puede observar o reabrir una cotización';
    end if;
    if not v_aprueba then
      raise exception 'No tienes el permiso de resolver cotizaciones. Lo concede gerencia desde el módulo de Usuarios';
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

-- ── ★ Quién puede mover el permiso ★ ────────────────────────────────────────
-- Se añade al disparador de la 0033/0035, que ya vigila el rol y el permiso de
-- otorgar gerencia. Solo gerencia lo concede o lo retira, y no sobre su propia
-- fila: a gerencia la columna no le sirve para nada, y dejar que se la toque
-- solo invita a confusión sobre por qué no cambia nada.
create or replace function trg_usuarios_control_de_rol()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo    uuid;
  v_rol   rol_usuario;
  v_puede boolean;
begin
  -- El servidor de confianza (service_role) no pasa por estas reglas: es el que
  -- da de alta a la persona al primer ingreso, cuando todavía no hay sesión.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  select u.puede_otorgar_gerencia into v_puede from usuarios u where u.id = v_yo;
  v_puede := coalesce(v_puede, false);

  -- ── Cambio de rol ─────────────────────────────────────────────────────────
  if new.rol is distinct from old.rol then
    if v_rol <> 'gerencia' then
      raise exception 'Solo gerencia puede cambiar el rol de un usuario';
    end if;
    if old.id = v_yo then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    -- Conceder gerencia, o quitársela a alguien, exige el permiso explícito.
    -- Lo segundo también: si no, una gerencia recién nombrada podría degradar
    -- a quien la nombró.
    if (new.rol = 'gerencia' or old.rol = 'gerencia') and not v_puede then
      raise exception 'No estás autorizado a otorgar ni retirar el rol de gerencia';
    end if;
  end if;

  -- ── Cambio del permiso de otorgar gerencia ────────────────────────────────
  if new.puede_otorgar_gerencia is distinct from old.puede_otorgar_gerencia then
    -- Solo quien ya lo tiene puede concederlo o retirarlo. Sin esta regla, una
    -- gerencia cualquiera se lo autoconcedería y el candado de arriba no
    -- serviría de nada.
    if not v_puede then
      raise exception 'Solo quien ya tiene el permiso de otorgar gerencia puede concederlo o retirarlo';
    end if;
    -- 0035: ni siquiera sobre tu propia fila. Si la única persona que lo tiene
    -- se lo quitara, el permiso desaparecería del sistema.
    if old.id = v_yo then
      raise exception 'No puedes cambiar tu propio permiso de otorgar gerencia: pásaselo a alguien y que esa persona te lo retire';
    end if;
  end if;

  -- ── ★ Nuevo en la 0037: el permiso de aprobar cotizaciones ★ ──────────────
  if new.puede_aprobar_cotizaciones is distinct from old.puede_aprobar_cotizaciones then
    if v_rol <> 'gerencia' then
      raise exception 'Solo gerencia decide quién puede aprobar cotizaciones';
    end if;
    if old.id = v_yo then
      raise exception 'Gerencia siempre puede aprobar: este permiso no aplica a tu propia fila';
    end if;
  end if;

  return new;
end $$;
