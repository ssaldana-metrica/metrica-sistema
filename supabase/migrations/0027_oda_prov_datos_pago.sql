-- ============================================================================
-- Migración 0027 · Arreglo: los datos de pago van en tres campos, no en uno
--
-- La 0026 creó `ordenes_proveedores.cuenta_cci`, copiando el nombre de la
-- columna original de `ordenes_adquisicion` (migración 0007). Pero esa columna
-- quedó obsoleta: la 0012 la partió en `cuenta` y `cci`, y son esas dos las que
-- usan hoy el formulario y el PDF. `cuenta_cci` sobrevive allá solo por los
-- registros viejos.
--
-- Copiar el nombre viejo habría obligado a que el módulo nuevo tradujera un
-- campo a dos, o a mostrar un solo cuadro donde el resto del sistema muestra
-- dos. Se corrige antes de que exista un solo dato: la tabla está en cero
-- filas, así que el cambio no arrastra nada.
-- ============================================================================

alter table ordenes_proveedores rename column cuenta_cci to cuenta;
alter table ordenes_proveedores add column cci text not null default '';
