import { crearClienteServidor } from '@/lib/supabase/server';
import { dominioPermitido } from '@/config/dominios';

export type Rol = 'ejecutivo' | 'admin' | 'gerencia';

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
};

// Devuelve el usuario logueado y su registro en la tabla `usuarios`,
// o null si no hay sesión válida (sin sesión, dominio no permitido,
// usuario inexistente o dado de baja).
export async function obtenerSesion(): Promise<{ usuario: Usuario } | null> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const correo = user.email.toLowerCase();
  if (!dominioPermitido(correo)) return null;

  // El RLS solo deja leer la fila propia si el usuario existe y está activo:
  // un usuario dado de baja recibe null aquí aunque tenga sesión de Google.
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, rol, activo')
    .eq('correo', correo)
    .eq('activo', true)
    .maybeSingle();

  return usuario ? { usuario } : null;
}
