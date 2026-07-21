-- ============================================================================
-- Migración 0020 · El ejecutivo dueño puede ACTUALIZAR filas de ficha_proveedores
--
-- Auditoría (alto #4): al guardar la ficha, el servidor borraba en bloque toda
-- la tabla de proveedores y la reinsertaba. Si ya existía una ODA (o una fila de
-- control) apuntando a un proveedor, ese DELETE viola la llave foránea y el
-- guardado falla PARA SIEMPRE, dejando la ficha atascada. La corrección
-- (src/actions/fichas.ts) reconcilia fila por fila (UPDATE en su sitio + INSERT
-- de las nuevas + DELETE solo de las sobrantes no referenciadas), lo que
-- preserva los ids y las referencias de las ODA.
--
-- Para eso el ejecutivo dueño necesita permiso de UPDATE sobre ficha_proveedores
-- (hoy solo tenía INSERT y DELETE; el UPDATE existía únicamente para admin).
-- ============================================================================

create policy ficha_prov_editar on ficha_proveedores
  for update to authenticated
  using (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_proveedores.ficha_id
      and c.ejecutivo_id = fn_mi_id()
      and f.estado = 'en_proceso'
  ))
  with check (exists (
    select 1 from fichas_apertura f
    join cotizaciones c on c.id = f.cotizacion_id
    where f.id = ficha_proveedores.ficha_id
      and c.ejecutivo_id = fn_mi_id()
      and f.estado = 'en_proceso'
  ));
