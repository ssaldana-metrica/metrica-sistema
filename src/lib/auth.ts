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
};

// Devuelve el usuario logueado y su registro en la tabla `usuarios`,
// o null si no hay sesión válida (sin sesión, dominio no permitido,
// usuario inexistente o dado de baja).
// cache(): el layout y la página comparten una sola consulta por petición.
export const obtenerSesion = cache(async (): Promise<{
  usuario: Usuario;
} | null> => {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const correo = user.email.toLowerCase();
  if (!dominioPermitido(correo)) return null;

  // El RLS solo deja leer la fila propia si el usuario existe y está activo:
  // un usuario dado de baja recibe null aquí aunque tenga sesión de Google.
  const { data: fila } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, rol, activo, puede_reactivar')
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
