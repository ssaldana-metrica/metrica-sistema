'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { ROLES, type Rol } from '@/lib/roles';
import { uno } from '@/lib/util';
import { avisarResolucionDeRol } from '@/lib/correo-usuarios';

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

// Activa o quita el permiso de reactivar procesos anulados. Solo gerencia.
export async function cambiarPuedeReactivar(
  usuarioId: string,
  puede: boolean,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (sesion.usuario.rol !== 'gerencia')
    return { error: 'Solo gerencia puede cambiar este permiso.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('usuarios')
    .update({ puede_reactivar: puede })
    .eq('id', usuarioId);
  if (error) return { error: 'No se pudo actualizar el permiso.' };

  revalidatePath('/usuarios');
  return { ok: true };
}

// ── Solicitudes de rol ──────────────────────────────────────────────────────
//
// Alguien que se registró pidiendo Administración entró como ejecutivo y su
// solicitud quedó esperando. Acá gerencia la resuelve.
//
// Las dos comprobaciones que importan —que solo gerencia resuelva, y que nadie
// resuelva la suya— viven también en la base (disparador de la migración 0033).
// Las de acá dan el mensaje claro; la base es la que de verdad impide.

export type SolicitudPendiente = {
  id: string;
  usuarioId: string;
  nombre: string;
  correo: string;
  rolSolicitado: Rol;
  creadaEn: string;
};

async function resolverSolicitud(
  solicitudId: string,
  aprobar: boolean,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (sesion.usuario.rol !== 'gerencia')
    return { error: 'Solo gerencia puede resolver solicitudes de rol.' };

  const supabase = await crearClienteServidor();

  const { data: solicitud } = await supabase
    .from('solicitudes_rol')
    .select('id, usuario_id, rol_solicitado, estado, usuarios(nombre, correo)')
    .eq('id', solicitudId)
    .maybeSingle();

  if (!solicitud) return { error: 'No se encontró la solicitud.' };
  if (solicitud.estado !== 'pendiente')
    return { error: 'Esa solicitud ya fue resuelta.' };
  if (solicitud.usuario_id === sesion.usuario.id)
    return { error: 'Control interno: no puedes resolver tu propia solicitud.' };

  // Aprobar concede el rol; rechazar no toca nada y la persona sigue como
  // ejecutivo. En los dos casos la solicitud queda cerrada con autor y fecha.
  if (aprobar) {
    const { error: errRol } = await supabase
      .from('usuarios')
      .update({
        rol: solicitud.rol_solicitado,
        rol_otorgado_por: sesion.usuario.id,
        rol_otorgado_en: new Date().toISOString(),
      })
      .eq('id', solicitud.usuario_id);
    if (errRol) return { error: 'No se pudo conceder el rol.' };
  }

  const { error } = await supabase
    .from('solicitudes_rol')
    .update({
      estado: aprobar ? 'aprobada' : 'rechazada',
      resuelta_por: sesion.usuario.id,
      resuelta_en: new Date().toISOString(),
    })
    .eq('id', solicitudId)
    .eq('estado', 'pendiente'); // candado por si alguien la resolvió a la vez
  if (error) return { error: 'No se pudo registrar la decisión.' };

  const persona = uno(
    solicitud.usuarios as { nombre: string; correo: string }[] | null,
  );
  if (persona) {
    // El correo no bloquea: la decisión ya está tomada y registrada.
    await avisarResolucionDeRol({
      correo: persona.correo,
      nombre: persona.nombre,
      rolSolicitado: solicitud.rol_solicitado as string,
      aprobada: aprobar,
    });
  }

  revalidatePath('/usuarios');
  return { ok: true };
}

export async function aprobarSolicitudRol(id: string): Promise<Resultado> {
  return resolverSolicitud(id, true);
}

export async function rechazarSolicitudRol(id: string): Promise<Resultado> {
  return resolverSolicitud(id, false);
}

// Cambia el permiso de otorgar el rol de gerencia. Solo lo puede conceder quien
// ya lo tiene — la base lo exige (migración 0033) y acá se comprueba para dar
// un mensaje entendible en vez de un error crudo de Postgres.
export async function cambiarPuedeOtorgarGerencia(
  usuarioId: string,
  puede: boolean,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };

  // Nadie toca su propio permiso. Si quien lo tiene se lo quitara sin habérselo
  // pasado a nadie, el permiso desaparecería del sistema y solo volvería con
  // otra migración. La barrera real es el disparador de la base (0035).
  if (usuarioId === sesion.usuario.id)
    return {
      error:
        'No puedes cambiar tu propio permiso. Pásaselo a alguien y que esa persona te lo retire.',
    };

  const supabase = await crearClienteServidor();
  const { data: yo } = await supabase
    .from('usuarios')
    .select('puede_otorgar_gerencia')
    .eq('id', sesion.usuario.id)
    .maybeSingle();

  if (!yo?.puede_otorgar_gerencia)
    return {
      error: 'Solo quien ya tiene el permiso de otorgar gerencia puede concederlo.',
    };

  const { error } = await supabase
    .from('usuarios')
    .update({ puede_otorgar_gerencia: puede })
    .eq('id', usuarioId);
  if (error) return { error: 'No se pudo actualizar el permiso.' };

  revalidatePath('/usuarios');
  return { ok: true };
}
