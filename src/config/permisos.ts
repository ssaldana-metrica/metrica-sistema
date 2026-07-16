// Permisos finos que no dependen solo del rol.
//
// Reactivar una anulación (revertir la cascada) lo puede hacer Gerencia siempre,
// y cualquier usuario a quien Gerencia le active el permiso `puedeReactivar`
// desde el módulo de Usuarios.
export function puedeReactivarAnulacion(u: {
  rol: string;
  puedeReactivar?: boolean;
}): boolean {
  return u.rol === 'gerencia' || u.puedeReactivar === true;
}
