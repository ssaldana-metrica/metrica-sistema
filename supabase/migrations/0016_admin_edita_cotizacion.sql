-- ============================================================================
-- Migración 0016 · Administración también puede editar una cotización editable
-- (borrador/observada) — necesario para "Reabrir cotización aprobada": el
-- ejecutivo dueño la edita, pero administración tampoco pierde el acceso.
--
-- La tabla `cotizaciones` ya permite a admin/gerencia hacer UPDATE
-- (policy cotizaciones_resolver). Faltaba abrirles las LÍNEAS
-- (cotizacion_items), que hoy solo puede tocar el ejecutivo dueño.
-- ============================================================================

create policy items_admin_crear on cotizacion_items
  for insert to authenticated
  with check (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from cotizaciones c
      where c.id = cotizacion_id and c.estado in ('borrador', 'observada')
    )
  );

create policy items_admin_editar on cotizacion_items
  for update to authenticated
  using (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from cotizaciones c
      where c.id = cotizacion_id and c.estado in ('borrador', 'observada')
    )
  )
  with check (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from cotizaciones c
      where c.id = cotizacion_id and c.estado in ('borrador', 'observada')
    )
  );

create policy items_admin_quitar on cotizacion_items
  for delete to authenticated
  using (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from cotizaciones c
      where c.id = cotizacion_id and c.estado in ('borrador', 'observada')
    )
  );
