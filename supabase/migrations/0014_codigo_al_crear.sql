-- ============================================================================
-- Migración 0014 · Banco de códigos: asignación del correlativo AL CREAR.
--
-- Antes: el código se "reservaba" al abrir el borrador (tomar_codigo) y recién
-- después se creaba la cotización. Si el borrador se abandonaba, el código
-- quedaba en_uso para siempre → huecos en el correlativo.
--
-- Ahora: el número se consume DENTRO de la misma transacción que crea el
-- documento. Garantías:
--   · Sin duplicados aunque haya varias cuentas a la vez (advisory lock por
--     banco/año serializa a los creadores concurrentes; FOR UPDATE bloquea la
--     fila del código).
--   · Estrictamente correlativo: siempre el menor número disponible del año.
--   · Sin huecos por abandono: si la transacción se revierte, el número vuelve
--     solo al banco (no se gasta).
-- Las funciones tomar_codigo()/tomar_codigo_oda() quedan en desuso (no se borran).
-- ============================================================================

-- ── COTIZACIÓN: crea la cotización y le asigna el correlativo, atómico ───────
create or replace function crear_cotizacion(
  p_cliente_id     uuid,
  p_proyecto       text,
  p_moneda         moneda_tipo,
  p_fee_porcentaje numeric,
  p_fecha_envio    date
) returns table (cot_id uuid, cot_codigo text)
language plpgsql security definer set search_path = public as $$
declare
  v_yo   uuid;
  v_anio int := extract(year from now())::int;
  v_id   uuid;
  v_cod  text;
begin
  v_yo := fn_mi_id();
  if v_yo is null then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if p_cliente_id is null then
    raise exception 'Falta el cliente';
  end if;

  -- Cola por año: los creadores concurrentes entran de a uno.
  perform pg_advisory_xact_lock(1001, v_anio);

  select b.codigo into v_cod
    from banco_codigos b
   where b.estado = 'disponible' and b.anio = v_anio
   order by b.numero
   limit 1
   for update;
  if v_cod is null then
    raise exception 'No hay códigos COT disponibles para el año %. Pide a administración generar más.', v_anio;
  end if;

  update banco_codigos
     set estado = 'en_uso', tomado_por = v_yo, tomado_en = now()
   where codigo = v_cod;

  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda,
                            fee_porcentaje, fecha_envio_cliente, estado)
  values (v_cod, p_cliente_id, v_yo, coalesce(p_proyecto, ''), p_moneda,
          coalesce(p_fee_porcentaje, 0), p_fecha_envio, 'borrador')
  returning cotizaciones.id into v_id;

  cot_id := v_id;
  cot_codigo := v_cod;
  return next;
end $$;

revoke execute on function crear_cotizacion(uuid, text, moneda_tipo, numeric, date) from public, anon;
grant  execute on function crear_cotizacion(uuid, text, moneda_tipo, numeric, date) to authenticated, service_role;

-- ── ODA: genera la orden de un proveedor con el correlativo, atómico ─────────
-- Reemplaza el flujo tomar_codigo_oda()+insert (que dejaba fuga si el insert
-- fallaba). No duplica: una orden por proveedor de ficha.
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

  -- ¿Ya tiene orden? No duplicar.
  select o.id, o.ficha_id into v_ex_id, v_ex_fic
    from ordenes_adquisicion o
   where o.ficha_proveedor_id = p_ficha_proveedor_id;
  if v_ex_id is not null then
    oda_id := v_ex_id; oda_ficha_id := v_ex_fic; ya_existia := true;
    return next; return;
  end if;

  perform pg_advisory_xact_lock(1002, v_anio);

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
