'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { dominioPermitido } from '@/config/dominios';

// Alta del usuario nuevo con el rol que él mismo elige (Administración o
// Ejecutivo). Gerencia NO se puede autoasignar. Usa el correo de la sesión de
// Google (no un parámetro), así nadie se registra a nombre de otro.
export async function elegirRol(
  rol: 'admin' | 'ejecutivo',
): Promise<{ error: string } | never> {
  if (rol !== 'admin' && rol !== 'ejecutivo') {
    return { error: 'Rol no válido.' };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');

  const correo = user.email.toLowerCase();
  if (!dominioPermitido(correo)) redirect('/acceso-denegado?motivo=dominio');

  const admin = crearClienteAdmin();
  const { data: existente } = await admin
    .from('usuarios')
    .select('id, activo')
    .eq('correo', correo)
    .maybeSingle();

  // Ya tiene rol: no puede recategorizarse a sí mismo.
  if (existente) {
    if (!existente.activo) {
      await supabase.auth.signOut();
      redirect('/acceso-denegado?motivo=inactivo');
    }
    redirect('/panel');
  }

  const nombre =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    correo.split('@')[0];

  const { error } = await admin
    .from('usuarios')
    .insert({ nombre, correo, rol });
  if (error) {
    return { error: 'No se pudo registrar tu cuenta. Intenta de nuevo.' };
  }

  redirect('/panel');
}
