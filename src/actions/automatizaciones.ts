'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { correrMonitorNormas } from '@/lib/normas-monitor';
import { DOMINIOS_PERMITIDOS, dominioPermitido } from '@/config/dominios';

// Acciones de administración de Automatizaciones. Todas son de gerencia.
//
// La comprobación de rol se hace acá Y la sostiene el RLS de la base
// (migraciones 0022 y 0024). Es a propósito: la de acá da un mensaje claro, la
// de la base es la que de verdad impide el paso si alguien llama la acción por
// fuera de la pantalla.

const CLAVE = 'normas_legales';
const RUTA = '/automatizaciones';

type Resultado = { ok: true; detalle?: string } | { error: string };

async function exigirGerencia(): Promise<{ error: string } | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (sesion.usuario.rol !== 'gerencia')
    return { error: 'Solo gerencia puede administrar las automatizaciones.' };
  return null;
}

// ── El interruptor ──────────────────────────────────────────────────────────

export async function cambiarEstadoAutomatizacion(activa: boolean): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('automatizaciones')
    .update({ activa })
    .eq('clave', CLAVE);
  if (error) return { error: 'No se pudo cambiar el estado.' };

  revalidatePath(RUTA);
  return { ok: true };
}

export async function cambiarModoPrueba(modoPrueba: boolean): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('automatizaciones')
    .update({ modo_prueba: modoPrueba })
    .eq('clave', CLAVE);
  if (error) return { error: 'No se pudo cambiar el modo de prueba.' };

  revalidatePath(RUTA);
  return { ok: true };
}

// ── Correr ahora ────────────────────────────────────────────────────────────

// Se llama al monitor directamente en vez de hacer una petición HTTP al propio
// endpoint: es la misma función que ejecuta la tarea programada, sin dar la
// vuelta por la red ni necesitar el secreto.
export async function correrAhora(): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  // Quién pulsó el botón: en modo prueba el aviso le llega a esa persona, no a
  // un correo fijo. Sin esto, otra gerencia probando el monitor mandaría el
  // correo a alguien más sin enterarse.
  const sesion = await obtenerSesion();

  try {
    const r = await correrMonitorNormas(undefined, sesion?.usuario.correo);
    if (!r.corrio) return { ok: true, detalle: r.motivo ?? 'No se ejecutó.' };
    if (r.motivo) return { error: r.motivo };

    const relevantes = r.normasRelevantes ?? 0;
    return {
      ok: true,
      detalle:
        relevantes === 0
          ? `Se revisaron ${r.normasEncontradas ?? 0} normas y ninguna toca a las cuentas vigiladas.`
          : `${relevantes} de ${r.normasEncontradas ?? 0} normas coincidieron. ${r.correo ?? ''}`.trim(),
    };
  } catch (e) {
    // El detalle completo ya quedó en el historial; acá va lo justo para que
    // quien mira la pantalla sepa qué pasó.
    return {
      error: e instanceof Error ? e.message : 'La corrida falló por un error desconocido.',
    };
  } finally {
    revalidatePath(RUTA);
  }
}

// ── Destinatarios ───────────────────────────────────────────────────────────

// Que parezca un correo Y que sea de un dominio de Métrica. Lo segundo lo
// pidió gerencia: estos avisos repasan normativa que afecta a clientes, y no
// deben poder salir de la empresa ni por descuido.
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function agregarDestinatario(
  correo: string,
  nombre: string,
  cuentaId: string | null,
): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const limpio = correo.trim().toLowerCase();
  if (!CORREO_VALIDO.test(limpio)) return { error: 'Ese correo no parece válido.' };

  // Solo dominios de Métrica. La base lo impide igual (constraint
  // `destinatario_dominio_metrica` de la 0032); esto da el mensaje claro antes
  // de que el error llegue crudo desde Postgres.
  if (!dominioPermitido(limpio))
    return {
      error: `Solo se puede avisar a correos de Métrica (${DOMINIOS_PERMITIDOS.join(', ')}).`,
    };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('normas_legales_destinatarios').insert({
    correo: limpio,
    nombre: nombre.trim() || null,
    cuenta_id: cuentaId,
  });

  if (error) {
    // 23505 es la violación del índice único: el correo ya está en la lista
    // con esa misma cuenta.
    if (error.code === '23505') return { error: 'Ese correo ya está en la lista.' };
    return { error: 'No se pudo agregar el destinatario.' };
  }

  revalidatePath(RUTA);
  return { ok: true };
}

export async function alternarDestinatario(id: string, activo: boolean): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('normas_legales_destinatarios')
    .update({ activo })
    .eq('id', id);
  if (error) return { error: 'No se pudo actualizar el destinatario.' };

  revalidatePath(RUTA);
  return { ok: true };
}

export async function eliminarDestinatario(id: string): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('normas_legales_destinatarios').delete().eq('id', id);
  if (error) return { error: 'No se pudo eliminar el destinatario.' };

  revalidatePath(RUTA);
  return { ok: true };
}

// ── Términos vigilados ──────────────────────────────────────────────────────

export async function agregarTermino(cuentaId: string, termino: string): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const limpio = termino.trim().replace(/\s+/g, ' ');
  if (limpio.length < 2) return { error: 'El término es demasiado corto.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('normas_legales_terminos')
    .insert({ cuenta_id: cuentaId, termino: limpio });

  if (error) {
    if (error.code === '23505') return { error: 'Esa cuenta ya vigila ese término.' };
    return { error: 'No se pudo agregar el término.' };
  }

  revalidatePath(RUTA);
  return { ok: true };
}

export async function eliminarTermino(id: string): Promise<Resultado> {
  const no = await exigirGerencia();
  if (no) return no;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('normas_legales_terminos').delete().eq('id', id);
  if (error) return { error: 'No se pudo eliminar el término.' };

  revalidatePath(RUTA);
  return { ok: true };
}
