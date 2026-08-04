-- ============================================================================
-- Migración 0033 · El rol de Administración lo concede gerencia, no uno mismo
--
-- EL HUECO QUE CIERRA. Hasta ahora, al primer ingreso la persona elegía entre
-- Ejecutivo y Administración y obtenía ese rol de inmediato. Cualquiera con un
-- correo de Métrica podía darse el rol que aprueba cotizaciones sin que nadie
-- lo autorizara — y eso dejaba cojo el control de cuatro ojos de la 0030: ese
-- candado impide aprobar LO PROPIO, pero no que alguien se dé el rol para
-- aprobar LO AJENO.
--
-- CÓMO QUEDA. La pantalla de elección se mantiene, pero:
--   · Ejecutivo    → se concede al instante. Es el rol base, sin poder de
--                    aprobación, y así nadie se queda sin poder trabajar.
--   · Administración → la persona entra como EJECUTIVO y su solicitud queda
--                    pendiente. Puede cotizar y llenar sus fichas mientras
--                    espera; no puede aprobar nada.
--
-- Conviene subrayar cómo se logra eso último, porque es lo que lo hace sólido:
-- quien espera NO es un administrador con el menú escondido. Su rol en la base
-- ES 'ejecutivo'. Todas las barreras que ya existían para un ejecutivo —RLS,
-- disparadores, comprobaciones del servidor— le aplican sin que haya que
-- escribir ninguna regla nueva. Ocultar el menú sería cosmético; esto no lo es.
--
-- ── Por qué una tabla y no columnas en `usuarios` ───────────────────────────
-- Para que quede el historial. Si a alguien le rechazan Administración y meses
-- después se la conceden, ambas decisiones constan con su fecha y su autor. Con
-- columnas, la segunda pisaría a la primera y se perdería el registro — que es
-- justo lo contrario de la regla del sistema.
--
-- ── El permiso de otorgar gerencia: dato, no lógica ─────────────────────────
-- Solo quien tenga `puede_otorgar_gerencia` puede convertir a alguien en
-- gerencia. Hoy se enciende para una sola cuenta, pero mediante un UPDATE de
-- datos, NO escribiendo el correo dentro de una función.
--
-- La diferencia importa y ya la pagamos caro: la migración 0013 tenía un correo
-- personal escrito a mano en la autorización de reactivar_proceso(), y la 0017
-- tuvo que reemplazarlo. El día que esa persona no esté, este permiso se
-- transfiere desde la pantalla y nadie toca código.
-- ============================================================================

-- ── Estado de una solicitud ─────────────────────────────────────────────────
create type estado_solicitud_rol as enum ('pendiente', 'aprobada', 'rechazada');

create table solicitudes_rol (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id),
  rol_solicitado rol_usuario not null,
  estado         estado_solicitud_rol not null default 'pendiente',
  creada_en      timestamptz not null default now(),
  resuelta_por   uuid references usuarios(id),
  resuelta_en    timestamptz,

  -- Una solicitud resuelta tiene que decir quién y cuándo. Una pendiente, no.
  constraint resolucion_completa check (
    (estado = 'pendiente' and resuelta_por is null and resuelta_en is null)
    or
    (estado <> 'pendiente' and resuelta_por is not null and resuelta_en is not null)
  )
);

-- Una sola solicitud pendiente por persona. Las resueltas se acumulan: son el
-- historial.
create unique index idx_solicitud_pendiente_unica
  on solicitudes_rol (usuario_id) where estado = 'pendiente';

create index idx_solicitudes_estado on solicitudes_rol (estado, creada_en);

-- Las solicitudes no se borran: son el registro de quién pidió qué y quién
-- decidió.
create trigger no_borrar_solicitudes before delete on solicitudes_rol
  for each row execute function trg_no_borrar();

-- ── Permisos y traza en `usuarios` ──────────────────────────────────────────
alter table usuarios
  add column puede_otorgar_gerencia boolean not null default false,
  add column rol_otorgado_por uuid references usuarios(id),
  add column rol_otorgado_en  timestamptz;

-- ── Semilla del permiso, ANTES de crear el candado ──────────────────────────
-- El orden no es casual. El disparador de abajo exige que quien concede el
-- permiso ya lo tenga, así que si se creara primero se bloquearía a sí mismo:
-- nadie tendría el permiso y nadie podría dárselo a nadie. La primera cuenta se
-- siembra mientras la regla todavía no existe.
--
-- Esto es un DATO, no una regla. De aquí en adelante el permiso se transfiere
-- desde la pantalla de Usuarios, sin tocar código ni migrar nada.
update usuarios
   set puede_otorgar_gerencia = true
 where correo = 'ssaldana@metrica.pe';

-- ── ★ El control de quién puede cambiar qué rol ★ ───────────────────────────
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
  -- Solo quien ya lo tiene puede concederlo o retirarlo. Sin esta regla, una
  -- gerencia cualquiera se lo autoconcedería y el candado de arriba no serviría
  -- de nada.
  if new.puede_otorgar_gerencia is distinct from old.puede_otorgar_gerencia then
    if not v_puede then
      raise exception 'Solo quien ya tiene el permiso de otorgar gerencia puede concederlo o retirarlo';
    end if;
  end if;

  return new;
end $$;

create trigger usuarios_control_de_rol before update on usuarios
  for each row execute function trg_usuarios_control_de_rol();

-- ── ★ Nadie resuelve su propia solicitud ★ ──────────────────────────────────
create or replace function trg_solicitud_no_propia()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Solo interesa el momento en que una pendiente se resuelve.
  if old.estado = 'pendiente' and new.estado <> 'pendiente' then
    v_yo := fn_mi_id();
    if fn_mi_rol() <> 'gerencia' then
      raise exception 'Solo gerencia puede resolver solicitudes de rol';
    end if;
    if old.usuario_id = v_yo then
      raise exception 'Control interno: no puedes resolver tu propia solicitud de rol';
    end if;
  end if;

  return new;
end $$;

create trigger solicitud_no_propia before update on solicitudes_rol
  for each row execute function trg_solicitud_no_propia();

-- ── Seguridad a nivel de fila ───────────────────────────────────────────────
alter table solicitudes_rol enable row level security;

-- Cada quien ve la suya —para que la pantalla pueda avisarle que está
-- pendiente— y gerencia las ve todas.
create policy solicitudes_ver on solicitudes_rol
  for select to authenticated
  using (usuario_id = fn_mi_id() or fn_mi_rol() = 'gerencia');

create policy solicitudes_resolver on solicitudes_rol
  for update to authenticated
  using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');

-- Sin política de INSERT: las solicitudes las crea el alta del usuario, que
-- corre con la llave privilegiada. Nadie se fabrica una solicitud a mano.

-- Los usuarios que ya existen conservan su rol tal cual: esta migración no
-- degrada a nadie ni les inventa una solicitud. Solo cambia cómo se conceden
-- los roles de aquí en adelante.
