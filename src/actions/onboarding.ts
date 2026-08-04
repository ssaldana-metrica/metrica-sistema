'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { dominioPermitido } from '@/config/dominios';
import { avisarSolicitudDeRol } from '@/lib/correo-usuarios';

// Alta del usuario nuevo.
//
// La persona elige entre Ejecutivo y Administración, pero el rol NO se le
// concede sin más:
//
//   · Ejecutivo      → se le da al instante. Es el rol base, no aprueba nada, y
//                      así nadie se queda sin poder trabajar el primer día.
//   · Administración → entra como EJECUTIVO y queda una solicitud pendiente
//                      para que gerencia la resuelva. Puede cotizar y llenar
//                      sus fichas mientras espera.
//
// Lo importante del segundo caso: la persona no es un administrador con el menú
// escondido. Su rol en la base ES 'ejecutivo', así que todas las barreras que ya
// existen para un ejecutivo le aplican solas. No hace falta ninguna regla nueva
// que alguien pueda olvidar más adelante.
//
// Gerencia no se puede solicitar: ese rol lo otorga a mano quien tenga el
// permiso, desde el módulo de Usuarios.
//
// Usa el correo de la sesión de Google (no un parámetro), así nadie se registra
// a nombre de otro.
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

  // Ya tiene cuenta: no puede recategorizarse a sí mismo.
  if (existente) {
    if (!existente.activo) {
      await supabase.auth.signOut();
      redirect('/acceso-denegado?motivo=inactivo');
    }
    redirect('/');
  }

  const nombre =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    correo.split('@')[0];

  // Siempre nace como ejecutivo, pida lo que pida.
  const { data: creado, error } = await admin
    .from('usuarios')
    .insert({ nombre, correo, rol: 'ejecutivo' })
    .select('id')
    .single();

  if (error || !creado) {
    return { error: 'No se pudo registrar tu cuenta. Intenta de nuevo.' };
  }

  if (rol === 'admin') {
    const { error: errSolicitud } = await admin.from('solicitudes_rol').insert({
      usuario_id: creado.id,
      rol_solicitado: 'admin',
    });

    // Si la solicitud falla, la cuenta ya existe y la persona puede trabajar
    // como ejecutivo. Se la deja entrar en vez de dejarla afuera; gerencia
    // puede cambiarle el rol a mano desde Usuarios.
    if (!errSolicitud) {
      // El aviso a gerencia no bloquea el ingreso. Si el correo falla, la
      // solicitud sigue visible en la pantalla de Usuarios, que es donde de
      // verdad se resuelve.
      await avisarSolicitudDeRol({ nombre, correo });
    }
  }

  redirect('/');
}
