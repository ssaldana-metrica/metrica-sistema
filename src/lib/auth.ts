import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { dominioPermitido } from '@/config/dominios';

export type Rol = 'ejecutivo' | 'admin' | 'gerencia';

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  puedeReactivar: boolean;
  /**
   * Puede aprobar u observar cotizaciones.
   *
   * Es un permiso aparte del rol (migración 0037): tener Administración da
   * acceso a las órdenes y a la tabla de control, pero aprobar —que es
   * comprometer plata— lo concede gerencia persona por persona.
   *
   * Ya viene resuelto: gerencia siempre puede, sin necesitar la columna.
   */
  puedeAprobar: boolean;
};

// Devuelve el usuario logueado y su registro en la tabla `usuarios`,
// o null si no hay sesión válida (sin sesión, dominio no permitido,
// usuario inexistente o dado de baja).
// cache(): el layout y la página comparten una sola consulta por petición.
export const obtenerSesion = cache(async (): Promise<{
  usuario: Usuario;
} | null> => {
  const supabase = await crearClienteServidor();
  // getSession() lee la sesión de la cookie SIN viaje de red. Es seguro aquí
  // porque el middleware (proxy.ts) ya revalidó el token con getUser() en ESTA
  // misma petición (y redirige a /login si no es válido); repetir esa
  // validación por red en cada render/acción era un ida y vuelta de más a
  // Supabase por cada clic. La barrera real de datos sigue siendo el RLS: la
  // consulta a `usuarios` de abajo solo devuelve la fila si el JWT valida y el
  // usuario está activo, así que un usuario dado de baja igual recibe null.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user?.email) return null;

  const correo = user.email.toLowerCase();
  if (!dominioPermitido(correo)) return null;

  // El RLS solo deja leer la fila propia si el usuario existe y está activo:
  // un usuario dado de baja recibe null aquí aunque tenga sesión de Google.
  const { data: fila } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, rol, activo, puede_reactivar, puede_aprobar_cotizaciones')
    .eq('correo', correo)
    .eq('activo', true)
    .maybeSingle();

  if (!fila) return null;
  return {
    usuario: {
      id: fila.id as string,
      nombre: fila.nombre as string,
      correo: fila.correo as string,
      rol: fila.rol as Rol,
      activo: fila.activo as boolean,
      puedeReactivar: Boolean(fila.puede_reactivar),
      puedeAprobar:
        fila.rol === 'gerencia' || Boolean(fila.puede_aprobar_cotizaciones),
    },
  };
});

// Para páginas restringidas por rol: devuelve la sesión o redirige.
export async function exigirRol(roles: Rol[]): Promise<{ usuario: Usuario }> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');
  if (!roles.includes(sesion.usuario.rol)) redirect('/panel');
  return sesion;
}
