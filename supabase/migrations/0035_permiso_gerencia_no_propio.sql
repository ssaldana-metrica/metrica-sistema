-- ============================================================================
-- Migración 0035 · El permiso de otorgar gerencia no se toca a uno mismo
--
-- La 0033 dejó una puerta que se cierra desde adentro. Quien tiene
-- `puede_otorgar_gerencia` cumple la condición del disparador —«solo quien ya lo
-- tiene puede concederlo o retirarlo»— también sobre su propia fila. Si esa
-- persona se lo quita a sí misma y no se lo había pasado a nadie, el permiso
-- desaparece del sistema: nadie lo tiene, y por lo tanto nadie puede
-- concedérselo a nadie. Recuperarlo exigiría otra migración.
--
-- Con esta regla la transferencia necesita dos personas, que es como debería ser
-- para un permiso de este peso: A se lo concede a B, y B se lo retira a A. En
-- ningún momento el sistema se queda sin nadie que pueda otorgarlo.
--
-- Se agrega al disparador de la 0033 en vez de reemplazarlo: el resto de sus
-- reglas queda igual, la función se reescribe entera porque en Postgres no hay
-- otra forma.
-- ============================================================================

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
    -- ★ Nuevo en la 0035: ni siquiera sobre tu propia fila. Ver la cabecera.
    if old.id = v_yo then
      raise exception 'No puedes cambiar tu propio permiso de otorgar gerencia: pásaselo a alguien y que esa persona te lo retire';
    end if;
  end if;

  return new;
end $$;
