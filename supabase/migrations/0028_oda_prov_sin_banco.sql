-- ============================================================================
-- Migración 0028 · Las ODA de proveedores dejan el banco de códigos
--
-- Gerencia pidió dos cambios sobre la 0026:
--
--   1. Que estas órdenes NO usen banco de códigos. Solo un correlativo simple.
--   2. Que se puedan BORRAR, no solo anular.
--
-- Los dos van juntos porque el banco existía justamente para lo contrario: en
-- Cotizaciones y en las ODA de proyecto los códigos se pre-generan, se reservan
-- y no se sueltan nunca, porque son documentos con valor contable donde un
-- número que aparece y desaparece es un problema de auditoría. El gasto de
-- oficina no tiene esa exigencia.
--
-- ── Qué reemplaza al banco ──────────────────────────────────────────────────
-- Una tabla de una fila por año con el último número entregado. No hay pool de
-- códigos, ni estados, ni reservas: se pide el siguiente y listo.
--
-- El contador SOLO SUBE, y eso es a propósito. Si el número saliera de
-- max(numero)+1 sobre las órdenes existentes, borrar la última haría que la
-- siguiente reutilizara su número — y si esa orden alcanzó a imprimirse o a
-- enviarse a un proveedor, habría dos documentos distintos con el mismo código.
-- Con el contador aparte, borrar deja un hueco en la numeración, que es
-- inofensivo, en vez de un duplicado, que no lo es.
--
-- ── Se puede borrar ─────────────────────────────────────────────────────────
-- Se retira `trg_no_borrar` de esta tabla. Es la excepción a la regla de "anule,
-- no borre" del resto del sistema, y se justifica: son órdenes internas que no
-- alimentan la facturación de ningún proyecto ni la tabla de control. Anular
-- sigue existiendo para lo que ya salió al proveedor; borrar es para lo que
-- nunca debió existir.
-- ============================================================================

-- ── El correlativo ──────────────────────────────────────────────────────────
create table oda_prov_correlativo (
  anio   int primary key,
  ultimo int not null default 1000   -- el primero entregado será el 1001
);

-- El código deja de apuntar al banco: pasa a ser texto propio de la orden.
alter table ordenes_proveedores
  drop constraint ordenes_proveedores_codigo_fkey;

-- Se guardan además desarmados, para poder ordenar y numerar sin parsear texto.
alter table ordenes_proveedores
  add column anio   int,
  add column numero int;

create unique index idx_ordenes_prov_correlativo
  on ordenes_proveedores (anio, numero);

-- ── Se puede borrar ─────────────────────────────────────────────────────────
drop trigger no_borrar_ordenes_prov on ordenes_proveedores;

create policy ordenes_prov_borrar on ordenes_proveedores
  for delete to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));

-- Las líneas de detalle ya se iban solas con la orden (on delete cascade).

-- ── Crear: pedir el siguiente número y armar el código ──────────────────────
create or replace function crear_orden_proveedor()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_yo     uuid;
  v_rol    rol_usuario;
  v_anio   int := extract(year from now())::int;
  v_numero int;
  v_id     uuid;
begin
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  if v_yo is null or v_rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede crear órdenes de proveedores';
  end if;

  -- Reserva el número y devuelve el nuevo valor en una sola sentencia. El
  -- `on conflict` cubre el primer uso del año. Dos clics simultáneos en
  -- "+ Nueva ODA" se serializan acá: el segundo espera a que el primero
  -- confirme y recibe el número siguiente, nunca el mismo.
  insert into oda_prov_correlativo (anio, ultimo)
  values (v_anio, 1001)
  on conflict (anio) do update set ultimo = oda_prov_correlativo.ultimo + 1
  returning ultimo into v_numero;

  insert into ordenes_proveedores (codigo, anio, numero, creada_por)
  values (
    format('ODA-PROV-%s-%s', v_anio, lpad(v_numero::text, 4, '0')),
    v_anio,
    v_numero,
    v_yo
  )
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function crear_orden_proveedor() from public, anon;
grant  execute on function crear_orden_proveedor() to authenticated, service_role;

-- ── Fuera el banco ──────────────────────────────────────────────────────────
-- Su trigger de "no borrar" impide vaciarlo, así que se retira antes.
drop trigger if exists no_borrar_banco_oda_prov on banco_codigos_oda_prov;
drop function if exists generar_codigos_oda_prov(int, int, int);
drop table banco_codigos_oda_prov;
