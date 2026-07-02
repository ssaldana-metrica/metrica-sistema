// Permisos finos que no dependen solo del rol.
//
// Reactivar una anulación (revertir la cascada) está reservado a Gerencia y a
// Erika. Se define aquí para compartir la regla entre la página (mostrar el
// botón), la acción de servidor y — por espejo — la función SQL reactivar_proceso.
export const CORREO_REACTIVAR_ANULACION = 'erika.pomacaja@metrica.pe';

export function puedeReactivarAnulacion(u: {
  rol: string;
  correo: string;
}): boolean {
  return (
    u.rol === 'gerencia' ||
    u.correo.toLowerCase() === CORREO_REACTIVAR_ANULACION
  );
}
