'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Moneda } from '@/lib/calculos';

export type FichaProveedorEntrada = {
  agencia: string;
  influencerProveedor: string;
  ruc: string;
  descripcion: string;
  monto: number;
  banco: string;
  cuentaCci: string;
  emailProveedor: string;
};

export type DatosEjecutivo = {
  clienteNombre: string;
  clienteRuc: string;
  politicaPago: string;
  contactoAprobacion: string;
  correoContacto: string;
  inicioAcciones: string | null;
  finAcciones: string | null;
  facturarAntesDelFin: boolean;
  moneda: Moneda;
  observacionesEjecutivo: string;
};

type Resultado = { ok: true } | { error: string };

const MAX_PROVEEDORES = 60;
const fechaOnull = (v: string | null) => (v && v.trim() ? v.trim() : null);

type Supa = Awaited<ReturnType<typeof crearClienteServidor>>;
type Ctx =
  | { ok: false; error: string }
  | { ok: true; supabase: Supa; estado: string; usuarioId: string };

// Carga la ficha con lo necesario para autorizar y devuelve el contexto.
async function contexto(fichaId: string): Promise<Ctx> {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' };

  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('id, estado, cotizacion:cotizaciones!inner(ejecutivo_id)')
    .eq('id', fichaId)
    .maybeSingle();
  if (!ficha) return { ok: false, error: 'No se encontró la ficha.' };

  const cot = Array.isArray(ficha.cotizacion)
    ? ficha.cotizacion[0]
    : ficha.cotizacion;
  const esDueno = cot?.ejecutivo_id === sesion.usuario.id;
  const esAdmin = ['admin', 'gerencia'].includes(sesion.usuario.rol);
  if (!esDueno && !esAdmin)
    return { ok: false, error: 'No tienes acceso a esta ficha.' };

  return {
    ok: true,
    supabase,
    estado: ficha.estado as string,
    usuarioId: sesion.usuario.id,
  };
}

// Guarda los datos del ejecutivo y reemplaza la tabla de proveedores.
async function persistir(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  fichaId: string,
  datos: DatosEjecutivo,
  proveedores: FichaProveedorEntrada[],
): Promise<string | null> {
  if (proveedores.length > MAX_PROVEEDORES)
    return `Máximo ${MAX_PROVEEDORES} proveedores por ficha.`;
  if (proveedores.some((p) => p.monto < 0))
    return 'Hay un proveedor con monto negativo.';

  const { error: errFicha } = await supabase
    .from('fichas_apertura')
    .update({
      cliente_nombre: datos.clienteNombre.trim(),
      cliente_ruc: datos.clienteRuc.trim(),
      politica_pago: datos.politicaPago.trim(),
      contacto_aprobacion: datos.contactoAprobacion.trim(),
      correo_contacto: datos.correoContacto.trim(),
      inicio_acciones: fechaOnull(datos.inicioAcciones),
      fin_acciones: fechaOnull(datos.finAcciones),
      facturar_antes_del_fin: datos.facturarAntesDelFin,
      moneda: datos.moneda,
      observaciones_ejecutivo: datos.observacionesEjecutivo.trim(),
    })
    .eq('id', fichaId)
    .eq('estado', 'en_proceso'); // candado: solo editable en proceso
  if (errFicha) return 'No se pudieron guardar los datos. Intenta de nuevo.';

  // Reemplazo de la tabla de proveedores (papel de trabajo del ejecutivo).
  const { error: errBorrar } = await supabase
    .from('ficha_proveedores')
    .delete()
    .eq('ficha_id', fichaId);
  if (errBorrar) return 'No se pudo actualizar la tabla de proveedores.';

  if (proveedores.length > 0) {
    const filas = proveedores.map((p, i) => ({
      ficha_id: fichaId,
      orden: i + 1,
      agencia: p.agencia.trim(),
      influencer_proveedor: p.influencerProveedor.trim(),
      ruc: p.ruc.trim(),
      descripcion: p.descripcion.trim(),
      monto: p.monto || 0,
      banco: p.banco.trim(),
      cuenta_cci: p.cuentaCci.trim(),
      email_proveedor: p.emailProveedor.trim(),
    }));
    const { error: errIns } = await supabase
      .from('ficha_proveedores')
      .insert(filas);
    if (errIns) return 'No se pudieron guardar los proveedores.';
  }
  return null;
}

// GUARDAR: persiste el avance del ejecutivo (sin exigir que esté completo).
export async function guardarFichaEjecutivo(
  fichaId: string,
  datos: DatosEjecutivo,
  proveedores: FichaProveedorEntrada[],
): Promise<Resultado> {
  const ctx = await contexto(fichaId);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.estado !== 'en_proceso')
    return {
      error:
        'La ficha ya no está en proceso. Pide a administración que la reabra para editarla.',
    };

  const error = await persistir(ctx.supabase, fichaId, datos, proveedores);
  if (error) return { error };

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}

// MI PARTE ESTÁ LISTA: guarda, valida lo mínimo y pasa a lista_ejecutivo.
export async function marcarListaEjecutivo(
  fichaId: string,
  datos: DatosEjecutivo,
  proveedores: FichaProveedorEntrada[],
): Promise<Resultado> {
  const ctx = await contexto(fichaId);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.estado !== 'en_proceso')
    return { error: 'Esta ficha ya fue marcada como lista.' };

  // Guarda primero para no perder lo escrito, aunque la validación falle.
  const errorGuardar = await persistir(ctx.supabase, fichaId, datos, proveedores);
  if (errorGuardar) return { error: errorGuardar };

  // Validación de "parte del ejecutivo completa".
  const faltan: string[] = [];
  if (!datos.clienteNombre.trim()) faltan.push('nombre del cliente');
  if (!datos.contactoAprobacion.trim()) faltan.push('contacto de aprobación');
  if (!datos.correoContacto.trim()) faltan.push('correo del contacto');
  if (!fechaOnull(datos.inicioAcciones)) faltan.push('inicio de acciones');
  if (!fechaOnull(datos.finAcciones)) faltan.push('fin de acciones');
  const provValidos = proveedores.filter(
    (p) =>
      (p.agencia.trim() || p.influencerProveedor.trim()) && (p.monto || 0) > 0,
  );
  if (provValidos.length === 0)
    faltan.push('al menos un proveedor con nombre y monto mayor a cero');

  if (faltan.length > 0)
    return {
      error: `Antes de marcar lista, completa: ${faltan.join(', ')}.`,
    };

  const { error: errEstado } = await ctx.supabase
    .from('fichas_apertura')
    .update({
      estado: 'lista_ejecutivo',
      lista_ejecutivo_en: new Date().toISOString(),
      lista_ejecutivo_por: ctx.usuarioId,
    })
    .eq('id', fichaId)
    .eq('estado', 'en_proceso');
  if (errEstado) return { error: 'No se pudo marcar como lista.' };

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}
