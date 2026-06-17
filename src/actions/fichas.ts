'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { generarPdfFicha } from '@/lib/pdf-ficha';
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

export type DatosSeguimientoCliente = {
  numFacturaCliente: string;
  ocCliente: string;
  hes: string;
  fechaEmisionFactura: string | null;
  totalSeguimiento: number | null;
};

export type SeguimientoProveedor = {
  id: string; // ficha_proveedores.id
  numOc: string;
  numFactura: string;
  fechaEmision: string | null;
  total: number | null;
  monedaTotal: Moneda;
  importe: number | null;
  monedaImporte: Moneda;
  pagoFraccionado: boolean;
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

// GUARDAR SEGUIMIENTO (solo admin/gerencia): datos a nivel cliente y, por cada
// proveedor existente, su seguimiento con moneda por línea. Editable mientras
// la ficha está en 'lista_ejecutivo' (el ejecutivo ya cerró su parte y aún no
// se cierra la ficha). Actualiza las filas en su sitio, sin recrearlas.
export async function guardarSeguimientoAdmin(
  fichaId: string,
  cliente: DatosSeguimientoCliente,
  proveedores: SeguimientoProveedor[],
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede registrar el seguimiento.' };

  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('estado')
    .eq('id', fichaId)
    .maybeSingle();
  if (!ficha) return { error: 'No se encontró la ficha.' };
  if (ficha.estado !== 'lista_ejecutivo')
    return {
      error:
        'El seguimiento se edita cuando el ejecutivo marcó su parte lista y antes de cerrar la ficha.',
    };

  const errSeg = await persistirSeguimiento(
    supabase,
    fichaId,
    cliente,
    proveedores,
  );
  if (errSeg) return { error: errSeg };

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}

// Guarda el seguimiento (cliente + por proveedor) en su sitio, sin recrear.
async function persistirSeguimiento(
  supabase: Supa,
  fichaId: string,
  cliente: DatosSeguimientoCliente,
  proveedores: SeguimientoProveedor[],
): Promise<string | null> {
  const { error: errCliente } = await supabase
    .from('fichas_apertura')
    .update({
      num_factura_cliente: cliente.numFacturaCliente.trim(),
      oc_cliente: cliente.ocCliente.trim(),
      hes: cliente.hes.trim(),
      fecha_emision_factura: fechaOnull(cliente.fechaEmisionFactura),
      total_seguimiento: cliente.totalSeguimiento,
    })
    .eq('id', fichaId);
  if (errCliente) return 'No se pudo guardar el seguimiento del cliente.';

  for (const p of proveedores) {
    const { error } = await supabase
      .from('ficha_proveedores')
      .update({
        num_oc: p.numOc.trim(),
        num_factura: p.numFactura.trim(),
        fecha_emision: fechaOnull(p.fechaEmision),
        total: p.total,
        moneda_total: p.monedaTotal,
        importe: p.importe,
        moneda_importe: p.monedaImporte,
        pago_fraccionado: p.pagoFraccionado,
      })
      .eq('id', p.id)
      .eq('ficha_id', fichaId);
    if (error) return 'No se pudo guardar el seguimiento de un proveedor.';
  }
  return null;
}

// Arma los datos y genera el PDF de la ficha, lo sube al bucket privado y
// devuelve la ruta de almacenamiento. Lee con el cliente admin para tener
// todos los campos sin depender del RLS.
async function generarYGuardarPdf(
  admin: ReturnType<typeof crearClienteAdmin>,
  fichaId: string,
): Promise<{ ruta: string } | { error: string }> {
  const { data: f } = await admin
    .from('fichas_apertura')
    .select('*')
    .eq('id', fichaId)
    .maybeSingle();
  if (!f) return { error: 'No se encontró la ficha.' };

  const { data: provs } = await admin
    .from('ficha_proveedores')
    .select('*')
    .eq('ficha_id', fichaId)
    .order('orden');

  let pdf: Buffer;
  try {
    pdf = await generarPdfFicha({
      codigo: f.codigo as string,
      cliente: {
        nombre: (f.cliente_nombre as string) ?? '',
        ruc: (f.cliente_ruc as string) ?? '',
        politicaPago: (f.politica_pago as string) ?? '',
        contacto: (f.contacto_aprobacion as string) ?? '',
        correo: (f.correo_contacto as string) ?? '',
      },
      servicio: {
        inicio: (f.inicio_acciones as string | null) ?? null,
        fin: (f.fin_acciones as string | null) ?? null,
        facturarAntes: Boolean(f.facturar_antes_del_fin),
        moneda: f.moneda as Moneda,
        observaciones: (f.observaciones_ejecutivo as string) ?? '',
      },
      seguimientoCliente: {
        numFactura: (f.num_factura_cliente as string) ?? '',
        oc: (f.oc_cliente as string) ?? '',
        hes: (f.hes as string) ?? '',
        fechaEmision: (f.fecha_emision_factura as string | null) ?? null,
        total: f.total_seguimiento != null ? Number(f.total_seguimiento) : null,
      },
      proveedores: (provs ?? []).map((p) => ({
        orden: p.orden as number,
        agencia: (p.agencia as string) ?? '',
        influencer: (p.influencer_proveedor as string) ?? '',
        ruc: (p.ruc as string) ?? '',
        descripcion: (p.descripcion as string) ?? '',
        monto: Number(p.monto) || 0,
        banco: (p.banco as string) ?? '',
        cuentaCci: (p.cuenta_cci as string) ?? '',
        numOc: (p.num_oc as string) ?? '',
        numFactura: (p.num_factura as string) ?? '',
        total: p.total != null ? Number(p.total) : null,
        monedaTotal: (p.moneda_total as Moneda) ?? 'PEN',
        importe: p.importe != null ? Number(p.importe) : null,
        monedaImporte: (p.moneda_importe as Moneda) ?? 'PEN',
        pagoFraccionado: Boolean(p.pago_fraccionado),
      })),
    });
  } catch {
    return { error: 'No se pudo generar el PDF de la ficha.' };
  }

  const ruta = `${new Date().getFullYear()}/${f.codigo}.pdf`;
  const { error: errSubida } = await admin.storage
    .from('fichas')
    .upload(ruta, pdf, { contentType: 'application/pdf', upsert: true });
  if (errSubida) return { error: 'No se pudo guardar el PDF en el almacén.' };
  return { ruta };
}

export type ResultadoCerrar =
  | { ok: true; urlDescarga: string | null }
  | { error: string };

// CERRAR FICHA (solo admin/gerencia): segundo paso del cierre. Guarda el
// seguimiento, valida lo mínimo, genera el PDF y pasa a 'completa'.
export async function cerrarFicha(
  fichaId: string,
  cliente: DatosSeguimientoCliente,
  proveedores: SeguimientoProveedor[],
): Promise<ResultadoCerrar> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede cerrar la ficha.' };

  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('estado')
    .eq('id', fichaId)
    .maybeSingle();
  if (!ficha) return { error: 'No se encontró la ficha.' };
  if (ficha.estado !== 'lista_ejecutivo')
    return {
      error:
        'Solo se puede cerrar una ficha que el ejecutivo marcó como lista.',
    };

  const errSeg = await persistirSeguimiento(supabase, fichaId, cliente, proveedores);
  if (errSeg) return { error: errSeg };

  const faltan: string[] = [];
  if (!cliente.numFacturaCliente.trim()) faltan.push('N° de factura al cliente');
  if (!cliente.totalSeguimiento || cliente.totalSeguimiento <= 0)
    faltan.push('total del seguimiento mayor a cero');
  if (faltan.length > 0)
    return { error: `Antes de cerrar, completa: ${faltan.join(', ')}.` };

  // Genera y guarda el PDF (con el cliente admin, para Storage).
  const admin = crearClienteAdmin();
  const pdf = await generarYGuardarPdf(admin, fichaId);
  if ('error' in pdf) return { error: pdf.error };

  const { error: errEstado } = await supabase
    .from('fichas_apertura')
    .update({
      estado: 'completa',
      completada_por: sesion.usuario.id,
      fecha_completada: new Date().toISOString(),
      pdf_url: pdf.ruta,
    })
    .eq('id', fichaId)
    .eq('estado', 'lista_ejecutivo'); // candado
  if (errEstado) return { error: 'No se pudo cerrar la ficha.' };

  const { data: firmado } = await admin.storage
    .from('fichas')
    .createSignedUrl(pdf.ruta, 3600);

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true, urlDescarga: firmado?.signedUrl ?? null };
}

// REABRIR (solo admin/gerencia): devuelve la ficha a 'en_proceso' con traza.
// El PDF queda obsoleto (se regenera al volver a cerrarla).
export async function reabrirFicha(fichaId: string): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede reabrir la ficha.' };

  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('estado')
    .eq('id', fichaId)
    .maybeSingle();
  if (!ficha) return { error: 'No se encontró la ficha.' };
  if (!['lista_ejecutivo', 'completa'].includes(ficha.estado as string))
    return { error: 'Esta ficha ya está en proceso.' };

  const { error } = await supabase
    .from('fichas_apertura')
    .update({
      estado: 'en_proceso',
      reabierta_por: sesion.usuario.id,
      fecha_reapertura: new Date().toISOString(),
      pdf_url: null,
    })
    .eq('id', fichaId);
  if (error) return { error: 'No se pudo reabrir la ficha.' };

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}
