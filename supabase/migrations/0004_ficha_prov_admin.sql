-- ============================================================================
-- Migración 0004: admin y gerencia también pueden llenar la tabla de
-- proveedores de la ficha (agregar/quitar filas) mientras está en proceso.
-- Necesario para que administración ayude a completar la parte del ejecutivo
-- y para que gerencia pruebe el flujo completo de punta a punta.
-- (El UPDATE de admin ya estaba cubierto por ficha_prov_admin.)
-- ============================================================================

create policy ficha_prov_crear_admin on ficha_proveedores
  for insert to authenticated
  with check (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from fichas_apertura f
      where f.id = ficha_proveedores.ficha_id and f.estado = 'en_proceso'
    )
  );

create policy ficha_prov_quitar_admin on ficha_proveedores
  for delete to authenticated
  using (
    fn_mi_rol() in ('admin', 'gerencia')
    and exists (
      select 1 from fichas_apertura f
      where f.id = ficha_proveedores.ficha_id and f.estado = 'en_proceso'
    )
  );
