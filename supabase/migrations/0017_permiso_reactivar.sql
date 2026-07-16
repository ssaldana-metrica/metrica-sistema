-- ============================================================================
-- Migración 0017 · Permiso de reactivar anulaciones configurable por gerencia.
-- Antes: reactivar_proceso estaba "quemado" a gerencia + Erika. Ahora es un
-- permiso por usuario (puede_reactivar) que gerencia activa/desactiva desde el
-- módulo de Usuarios. Gerencia siempre puede, sin importar el flag.
-- ============================================================================

alter table usuarios
  add column if not exists puede_reactivar boolean not null default false;

-- La función de reactivación ahora autoriza por rol gerencia O por el flag.
create or replace function reactivar_proceso(p_ficha_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_yo           uuid;
  v_rol          rol_usuario;
  v_puede        boolean;
  v_cot_id       uuid;
  v_cot_codigo   text;
  v_estado_ficha estado_ficha;
  v_prev_ficha   estado_ficha;
  v_prev_cot     estado_cotizacion;
begin
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  select puede_reactivar into v_puede from usuarios where id = v_yo;
  if v_yo is null or (v_rol <> 'gerencia' and coalesce(v_puede, false) = false) then
    raise exception 'No tienes permiso para reactivar procesos anulados';
  end if;

  select f.estado, f.estado_previo_anulacion, f.cotizacion_id,
         c.codigo, c.estado_previo_anulacion
    into v_estado_ficha, v_prev_ficha, v_cot_id, v_cot_codigo, v_prev_cot
  from fichas_apertura f
  join cotizaciones c on c.id = f.cotizacion_id
  where f.id = p_ficha_id;
  if not found then
    raise exception 'No se encontró el proceso';
  end if;
  if v_estado_ficha <> 'anulada' then
    raise exception 'Este proceso no está anulado';
  end if;

  -- Excepción controlada al candado de códigos, solo durante esta transacción.
  perform set_config('app.reactivando', 'on', true);

  update cotizaciones
     set estado = coalesce(v_prev_cot, 'aprobada'),
         estado_previo_anulacion = null,
         anulada_por = null, motivo_anulacion = null
   where id = v_cot_id;
  update banco_codigos set estado = 'en_uso' where codigo = v_cot_codigo;

  update fichas_apertura
     set estado = coalesce(v_prev_ficha, 'completa'),
         estado_previo_anulacion = null,
         anulada_por = null, fecha_anulacion = null, motivo_anulacion = null
   where id = p_ficha_id;

  update banco_codigos_oda
     set estado = 'en_uso'
   where codigo in (
     select codigo from ordenes_adquisicion
      where ficha_id = p_ficha_id and estado_previo_anulacion is not null
   );
  update ordenes_adquisicion
     set estado = estado_previo_anulacion,
         estado_previo_anulacion = null,
         anulada_por = null, motivo_anulacion = null
   where ficha_id = p_ficha_id and estado_previo_anulacion is not null;
end $$;

revoke execute on function reactivar_proceso(uuid) from public, anon;
grant  execute on function reactivar_proceso(uuid) to authenticated, service_role;
