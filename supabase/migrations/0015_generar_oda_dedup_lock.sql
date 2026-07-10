-- ============================================================================
-- Migración 0015 · generar_oda: mover el advisory lock ANTES del chequeo
-- anti-duplicado. Con el dedup fuera del lock, dos "Generar ODA" simultáneos
-- para el mismo proveedor podían pasar ambos el dedup y el segundo chocar con la
-- unicidad de ficha_proveedor_id (error crudo) en vez de devolver la orden ya
-- creada. Con el lock primero, el segundo espera, ve la orden ya commiteada y
-- devuelve ya_existia=true. (Integridad ya estaba a salvo; esto arregla la UX.)
-- ============================================================================

create or replace function generar_oda(p_ficha_proveedor_id uuid)
returns table (oda_id uuid, oda_ficha_id uuid, ya_existia boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_yo     uuid;
  v_rol    rol_usuario;
  v_anio   int := extract(year from now())::int;
  v_prov   ficha_proveedores;
  v_estado estado_ficha;
  v_moneda moneda_tipo;
  v_cotcod text;
  v_ex_id  uuid;
  v_ex_fic uuid;
  v_cod    text;
  v_id     uuid;
begin
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  if v_yo is null or v_rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede generar órdenes';
  end if;

  select * into v_prov from ficha_proveedores where id = p_ficha_proveedor_id;
  if not found then
    raise exception 'No se encontró el proveedor de la ficha';
  end if;

  select f.estado, f.moneda, c.codigo
    into v_estado, v_moneda, v_cotcod
  from fichas_apertura f
  join cotizaciones c on c.id = f.cotizacion_id
  where f.id = v_prov.ficha_id;
  if v_estado not in ('lista_ejecutivo', 'completa') then
    raise exception 'Genera la orden cuando el ejecutivo haya marcado su parte como lista';
  end if;

  -- Cola por año ANTES del dedup: un segundo "Generar" concurrente espera aquí
  -- y, al pasar, ya ve la orden creada por el primero.
  perform pg_advisory_xact_lock(1002, v_anio);

  -- ¿Ya tiene orden? No duplicar (una orden por proveedor de ficha).
  select o.id, o.ficha_id into v_ex_id, v_ex_fic
    from ordenes_adquisicion o
   where o.ficha_proveedor_id = p_ficha_proveedor_id;
  if v_ex_id is not null then
    oda_id := v_ex_id; oda_ficha_id := v_ex_fic; ya_existia := true;
    return next; return;
  end if;

  select b.codigo into v_cod
    from banco_codigos_oda b
   where b.estado = 'disponible' and b.anio = v_anio
   order by b.numero
   limit 1
   for update;
  if v_cod is null then
    raise exception 'No hay códigos ODA disponibles para el año %. Pide a administración generar más.', v_anio;
  end if;

  update banco_codigos_oda
     set estado = 'en_uso', tomado_por = v_yo, tomado_en = now()
   where codigo = v_cod;

  insert into ordenes_adquisicion (
    codigo, ficha_id, ficha_proveedor_id, cotizacion_codigo,
    agencia, influencer_proveedor, ruc, descripcion, monto, moneda,
    banco, cuenta, cci, email_proveedor
  ) values (
    v_cod, v_prov.ficha_id, v_prov.id, coalesce(v_cotcod, ''),
    v_prov.agencia, v_prov.influencer_proveedor, v_prov.ruc, v_prov.descripcion,
    coalesce(v_prov.monto, 0), coalesce(v_moneda, 'PEN'),
    v_prov.banco, v_prov.cuenta, v_prov.cci, v_prov.email_proveedor
  ) returning id into v_id;

  insert into orden_detalles (orden_id, posicion, descripcion, cantidad, precio_unitario, monto)
  values (v_id, 1, v_prov.descripcion, 1, coalesce(v_prov.monto, 0), coalesce(v_prov.monto, 0));

  oda_id := v_id; oda_ficha_id := v_prov.ficha_id; ya_existia := false;
  return next;
end $$;

revoke execute on function generar_oda(uuid) from public, anon;
grant  execute on function generar_oda(uuid) to authenticated, service_role;
