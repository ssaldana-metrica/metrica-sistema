-- ============================================================================
-- Migración 0013 · Reversión de la anulación en cascada (reactivar_proceso).
--   - Al anular, se guarda el estado PREVIO de cada documento (ficha,
--     cotización y cada ODA tocada) para poder restaurarlo.
--   - Un código anulado sigue siendo definitivo EN GENERAL; la única excepción
--     es durante una reactivación (flag de transacción app.reactivando = 'on'),
--     donde se permite devolverlo de 'anulado' a 'en_uso'.
--   - reactivar_proceso() revierte la cascada. Autorizado SOLO a gerencia y a
--     Erika (erika.pomacaja@metrica.pe).
-- ============================================================================

-- Estado previo a la anulación (para restaurar). Nulo salvo cuando se anuló.
alter table fichas_apertura
  add column if not exists estado_previo_anulacion estado_ficha;
alter table cotizaciones
  add column if not exists estado_previo_anulacion estado_cotizacion;
alter table ordenes_adquisicion
  add column if not exists estado_previo_anulacion estado_oda;

-- Backfill: los procesos anulados por la versión ANTERIOR de anular_proceso (que
-- no guardaba el estado previo) también deben poder reactivarse; si no,
-- reactivar_proceso omitiría sus ODAs y sus códigos ODA quedarían muertos. Se
-- infiere el estado previo por las marcas de tiempo. Solo toca documentos de
-- procesos cuya ficha está anulada (fueron parte de una anulación en cascada).
update fichas_apertura f
   set estado_previo_anulacion = case
         when f.fecha_completada is not null then 'completa'::estado_ficha
         when f.lista_ejecutivo_en is not null then 'lista_ejecutivo'::estado_ficha
         else 'en_proceso'::estado_ficha
       end
 where f.estado = 'anulada' and f.estado_previo_anulacion is null;

update cotizaciones c
   set estado_previo_anulacion = 'aprobada'::estado_cotizacion
 where c.estado = 'anulada' and c.estado_previo_anulacion is null
   and exists (
     select 1 from fichas_apertura f
      where f.cotizacion_id = c.id and f.estado = 'anulada'
   );

update ordenes_adquisicion o
   set estado_previo_anulacion = case
         when o.fecha_emision is not null then 'emitida'::estado_oda
         else 'borrador'::estado_oda
       end
 where o.estado = 'anulada' and o.estado_previo_anulacion is null
   and exists (
     select 1 from fichas_apertura f
      where f.id = o.ficha_id and f.estado = 'anulada'
   );

-- El candado "código anulado es final" gana una excepción controlada: durante
-- una reactivación (app.reactivando = 'on') sí se permite salir de 'anulado'.
-- En cualquier otro contexto, un código anulado jamás vuelve.
create or replace function trg_codigo_anulado_es_final() returns trigger
language plpgsql as $$
begin
  if old.estado = 'anulado'
     and new.estado is distinct from 'anulado'
     and coalesce(current_setting('app.reactivando', true), '') <> 'on' then
    raise exception 'El código % está anulado y nunca puede reutilizarse', old.codigo;
  end if;
  return new;
end $$;

-- Anulación en cascada: misma lógica de 0011, pero AHORA guarda el estado
-- previo de cada documento antes de anularlo (para poder revertir).
create or replace function anular_proceso(p_ficha_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_yo           uuid;
  v_rol          rol_usuario;
  v_cot_id       uuid;
  v_cot_codigo   text;
  v_estado_ficha estado_ficha;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
begin
  -- Autorización: solo administración.
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  if v_yo is null or v_rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede anular procesos';
  end if;
  if v_motivo = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  -- Ficha + su cotización de origen.
  select f.estado, f.cotizacion_id, c.codigo
    into v_estado_ficha, v_cot_id, v_cot_codigo
  from fichas_apertura f
  join cotizaciones c on c.id = f.cotizacion_id
  where f.id = p_ficha_id;
  if not found then
    raise exception 'No se encontró el proceso';
  end if;
  if v_estado_ficha = 'anulada' then
    raise exception 'Este proceso ya está anulado';
  end if;

  -- 1) Cotización (COT) — guarda estado previo
  update cotizaciones
     set estado_previo_anulacion = estado,
         estado = 'anulada', anulada_por = v_yo, motivo_anulacion = v_motivo
   where id = v_cot_id;
  -- 2) Código COT → anulado
  update banco_codigos set estado = 'anulado' where codigo = v_cot_codigo;

  -- 3) Ficha de apertura (FA-COT) — guarda estado previo
  update fichas_apertura
     set estado_previo_anulacion = estado,
         estado = 'anulada', anulada_por = v_yo,
         fecha_anulacion = now(), motivo_anulacion = v_motivo
   where id = p_ficha_id;

  -- 4) Todas las ODA del proceso que aún no estén anuladas — guarda estado
  --    previo por fila (para reactivar solo estas, no las anuladas de antes).
  update ordenes_adquisicion
     set estado_previo_anulacion = estado,
         estado = 'anulada', anulada_por = v_yo, motivo_anulacion = v_motivo
   where ficha_id = p_ficha_id and estado <> 'anulada';
  -- 5) Códigos ODA de las órdenes del proceso → anulado
  update banco_codigos_oda
     set estado = 'anulado'
   where codigo in (select codigo from ordenes_adquisicion where ficha_id = p_ficha_id);
end $$;

revoke execute on function anular_proceso(uuid, text) from public, anon;
grant  execute on function anular_proceso(uuid, text) to authenticated, service_role;

-- ── ★ Reactivación (ATÓMICA) ★ ──────────────────────────────────────────────
-- Revierte la cascada usando el estado previo guardado. Restaura la cotización,
-- la ficha y solo las ODA que ESTA anulación tocó, y devuelve sus códigos a
-- 'en_uso'. Solo gerencia y Erika pueden ejecutarla.
create or replace function reactivar_proceso(p_ficha_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_yo           uuid;
  v_rol          rol_usuario;
  v_correo       text;
  v_cot_id       uuid;
  v_cot_codigo   text;
  v_estado_ficha estado_ficha;
  v_prev_ficha   estado_ficha;
  v_prev_cot     estado_cotizacion;
begin
  -- Autorización: solo gerencia o Erika.
  v_yo     := fn_mi_id();
  v_rol    := fn_mi_rol();
  v_correo := fn_correo_actual();
  if v_yo is null
     or (v_rol <> 'gerencia' and v_correo <> 'erika.pomacaja@metrica.pe') then
    raise exception 'Solo Gerencia o Erika pueden reactivar un proceso anulado';
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

  -- 1) Cotización → estado previo (o 'aprobada' por defecto: tenía ficha)
  update cotizaciones
     set estado = coalesce(v_prev_cot, 'aprobada'),
         estado_previo_anulacion = null,
         anulada_por = null, motivo_anulacion = null
   where id = v_cot_id;
  -- 2) Código COT → en_uso
  update banco_codigos set estado = 'en_uso' where codigo = v_cot_codigo;

  -- 3) Ficha → estado previo (o 'completa' por defecto)
  update fichas_apertura
     set estado = coalesce(v_prev_ficha, 'completa'),
         estado_previo_anulacion = null,
         anulada_por = null, fecha_anulacion = null, motivo_anulacion = null
   where id = p_ficha_id;

  -- 4) Solo las ODA que ESTA cascada anuló (tienen estado_previo guardado):
  --    primero sus códigos vuelven a 'en_uso' (aún se leen por estado_previo),
  --    luego se restaura el estado de las órdenes y se limpia el previo.
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
