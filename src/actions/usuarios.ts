'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { ROLES, type Rol } from '@/lib/roles';

type Resultado = { ok: true } | { error: string };

// Cambia el rol de un usuario. Solo gerencia. No puedes cambiar el tuyo (para
// no dejarte a ti mismo sin acceso por error).
export async function cambiarRol(
  usuarioId: string,
  rol: Rol,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (sesion.usuario.rol !== 'gerencia')
    return { error: 'Solo gerencia puede cambiar roles.' };
  if (!ROLES.includes(rol)) return { error: 'Rol no válido.' };
  if (usuarioId === sesion.usuario.id)
    return { error: 'No puedes cambiar tu propio rol.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('usuarios')
    .update({ rol })
    .eq('id', usuarioId);
  if (error) return { error: 'No se pudo cambiar el rol.' };

  revalidatePath('/usuarios');
  return { ok: true };
}

// Da de alta o de baja a un usuario (activo). Solo gerencia. No puedes
// desactivarte a ti mismo.
export async function cambiarActivo(
  usuarioId: string,
  activo: boolean,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (sesion.usuario.rol !== 'gerencia')
    return { error: 'Solo gerencia puede activar o desactivar usuarios.' };
  if (usuarioId === sesion.usuario.id)
    return { error: 'No puedes desactivarte a ti mismo.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('usuarios')
    .update({ activo })
    .eq('id', usuarioId);
  if (error) return { error: 'No se pudo actualizar el usuario.' };

  revalidatePath('/usuarios');
  return { ok: true };
}
