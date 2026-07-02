'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { uno } from '@/lib/util';
import { generarPdfOda } from '@/lib/pdf-oda';
import { redondear, type Moneda } from '@/lib/calculos';
import type { TipoProveedorImp, TipoComprobante } from '@/config/impuestos';

export type TipoProveedor = 'empresa' | 'persona_natural';

// Cada línea del detalle de compra (la orden puede tener varias). El total de
// la línea es cantidad × precio unitario.
export type DetalleOrden = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

export type DatosOrden = {
  agencia: string;
  influencerProveedor: string;
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  tipoProveedor: TipoProveedor;
  tipoComprobante: TipoComprobante;
  condicionesPago: string;
  moneda: Moneda;
  detalles: DetalleOrden[];
  banco: string;
  cuenta: string;
  cci: string;
  emailProveedor: string;
};

const MAX_DETALLES = 60;

type ResultadoGenerar =
  | { ok: true; id: string; yaExistia: boolean }
  | { error: string };

// GENERAR ODA (solo admin/gerencia): desde una ficha COMPLETA, crea la orden
// de un proveedor heredando sus datos. Toma un código del banco ODA de forma
// atómica. Si el proveedor ya tiene una orden, devuelve la existente (no
// duplica: ficha_proveedor_id es único).
export async function generarOda(
  fichaProveedorId: string,
): Promise<ResultadoGenerar> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede generar órdenes.' };

  const supabase = await crearClienteServidor();

  // Proveedor + su ficha + el código de la cotización de origen.
  const { data: prov } = await supabase
    .from('ficha_proveedores')
    .select(
      `id, ficha_id, agencia, influencer_proveedor, ruc, descripcion, monto,
       banco, cuenta, cci, email_proveedor,
       ficha:fichas_apertura!inner(
         estado, moneda, cotizacion:cotizaciones!inner(codigo)
       )`,
    )
    .eq('id', fichaProveedorId)
    .maybeSingle();
  if (!prov) return { error: 'No se encontró el proveedor de la ficha.' };

  const ficha = uno(
    prov.ficha as {
      estado: string;
      moneda: string;
      cotizacion: { codigo: string }[];
    }[] | null,
  );
  // Se puede generar en cuanto el ejecutivo marca su parte lista (no hace falta
  // cerrar la ficha ni generar su PDF).
  if (!['lista_ejecutivo', 'completa'].includes(ficha?.estado ?? ''))
    return {
      error:
        'Genera la orden cuando el ejecutivo haya marcado su parte como lista.',
    };

  // ¿Ya tiene orden? No duplicar.
  const { data: existente } = await supabase
    .from('ordenes_adquisicion')
    .select('id')
    .eq('ficha_proveedor_id', fichaProveedorId)
    .maybeSingle();
  if (existente)
    return { ok: true, id: existente.id as string, yaExistia: true };

  // Toma un código ODA de forma atómica (la función valida el rol).
  const { data: cod, error: errCod } = await supabase.rpc('tomar_codigo_oda');
  if (errCod || !cod)
    return {
      error:
        errCod?.message ?? 'No se pudo asignar un código ODA. Intenta de nuevo.',
    };
  const codigo = (Array.isArray(cod) ? cod[0]?.codigo : cod?.codigo) as string;

  const cotCodigo = uno(ficha?.cotizacion ?? null)?.codigo ?? '';

  const { data: orden, error } = await supabase
    .from('ordenes_adquisicion')
    .insert({
      codigo,
      ficha_id: prov.ficha_id as string,
      ficha_proveedor_id: prov.id as string,
      cotizacion_codigo: cotCodigo,
      agencia: (prov.agencia as string) ?? '',
      influencer_proveedor: (prov.influencer_proveedor as string) ?? '',
      ruc: (prov.ruc as string) ?? '',
      descripcion: (prov.descripcion as string) ?? '',
      monto: Number(prov.monto) || 0,
      moneda: ficha?.moneda ?? 'PEN',
      banco: (prov.banco as string) ?? '',
      cuenta: (prov.cuenta as string) ?? '',
      cci: (prov.cci as string) ?? '',
      email_proveedor: (prov.email_proveedor as string) ?? '',
    })
    .select('id')
    .single();
  if (error || !orden)
    return { error: 'No se pudo crear la orden. Intenta de nuevo.' };

  // Primera línea de detalle, heredada del proveedor (editable después):
  // cantidad 1, precio unitario = monto heredado, total = ese mismo monto.
  await supabase.from('orden_detalles').insert({
    orden_id: orden.id as string,
    posicion: 1,
    descripcion: (prov.descripcion as string) ?? '',
    cantidad: 1,
    precio_unitario: Number(prov.monto) || 0,
    monto: Number(prov.monto) || 0,
  });

  revalidatePath(`/fichas/${prov.ficha_id as string}`);
  revalidatePath('/ordenes');
  return { ok: true, id: orden.id as string, yaExistia: false };
}

type Resultado = { ok: true } | { error: string };

// Verifica sesión + rol admin/gerencia y devuelve el cliente y el estado.
async function ctxOrden(id: string) {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false as const, error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { ok: false as const, error: 'Solo administración puede gestionar órdenes.' };
  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from('ordenes_adquisicion')
    .select('estado')
    .eq('id', id)
    .maybeSingle();
  if (!orden) return { ok: false as const, error: 'No se encontró la orden.' };
  return {
    ok: true as const,
    supabase,
    estado: orden.estado as string,
    usuarioId: sesion.usuario.id,
  };
}

// GUARDAR (solo borrador): ajusta los datos heredados antes de emitir.
export async function guardarOrden(
  id: string,
  datos: DatosOrden,
): Promise<Resultado> {
  const ctx = await ctxOrden(id);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.estado !== 'borrador')
    return { error: 'Solo se puede editar una orden en borrador.' };
  if (datos.detalles.length > MAX_DETALLES)
    return { error: `Máximo ${MAX_DETALLES} líneas de detalle.` };
  if (datos.detalles.some((d) => d.cantidad < 0 || d.precioUnitario < 0))
    return { error: 'Hay una línea con cantidad o precio negativo.' };

  // Líneas con contenido; el total de cada una es cantidad × precio unitario,
  // y el total de la orden es la suma de las líneas.
  const lineas = datos.detalles
    .map((d) => ({
      descripcion: d.descripcion,
      cantidad: d.cantidad || 0,
      precioUnitario: d.precioUnitario || 0,
      monto: redondear((d.cantidad || 0) * (d.precioUnitario || 0)),
    }))
    .filter((d) => d.descripcion.trim() || d.monto > 0);
  const total = redondear(lineas.reduce((a, d) => a + d.monto, 0));

  const { error } = await ctx.supabase
    .from('ordenes_adquisicion')
    .update({
      agencia: datos.agencia.trim(),
      influencer_proveedor: datos.influencerProveedor.trim(),
      razon_social: datos.razonSocial.trim(),
      nombre_comercial: datos.nombreComercial.trim(),
      ruc: datos.ruc.trim(),
      tipo_proveedor: datos.tipoProveedor,
      tipo_comprobante: datos.tipoComprobante,
      monto: total, // total = suma de las líneas
      moneda: datos.moneda,
      banco: datos.banco.trim(),
      cuenta: datos.cuenta.trim(),
      cci: datos.cci.trim(),
      email_proveedor: datos.emailProveedor.trim(),
      condiciones_pago: datos.condicionesPago.trim(),
    })
    .eq('id', id)
    .eq('estado', 'borrador');
  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' };

  // Reemplazo de las líneas de detalle.
  const { error: errDel } = await ctx.supabase
    .from('orden_detalles')
    .delete()
    .eq('orden_id', id);
  if (errDel) return { error: 'No se pudo actualizar el detalle.' };
  if (lineas.length > 0) {
    const { error: errIns } = await ctx.supabase.from('orden_detalles').insert(
      lineas.map((d, i) => ({
        orden_id: id,
        posicion: i + 1,
        descripcion: d.descripcion.trim(),
        cantidad: d.cantidad,
        precio_unitario: d.precioUnitario,
        monto: d.monto,
      })),
    );
    if (errIns) return { error: 'No se pudo guardar el detalle.' };
  }

  revalidatePath(`/ordenes/${id}`);
  revalidatePath('/ordenes');
  return { ok: true };
}

export type ResultadoEmitir =
  | { ok: true; urlDescarga: string | null }
  | { error: string };

// EMITIR (solo borrador): valida lo mínimo, genera el PDF formato Métrica
// (con IGV o retención según el tipo), lo guarda en Storage y pasa a 'emitida'.
// El código de la cotización NUNCA se imprime en el PDF.
export async function emitirOrden(id: string): Promise<ResultadoEmitir> {
  const ctx = await ctxOrden(id);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.estado !== 'borrador')
    return { error: 'Esta orden ya fue emitida o anulada.' };

  const { data: o } = await ctx.supabase
    .from('ordenes_adquisicion')
    .select(
      `codigo, razon_social, nombre_comercial, ruc, tipo_proveedor,
       tipo_comprobante, monto, moneda, banco, cuenta, cci, email_proveedor,
       condiciones_pago`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!o) return { error: 'No se encontró la orden.' };

  const { data: detalles } = await ctx.supabase
    .from('orden_detalles')
    .select('descripcion, cantidad, precio_unitario, monto')
    .eq('orden_id', id)
    .order('posicion');

  const faltan: string[] = [];
  if (!(o.razon_social as string)?.trim()) faltan.push('razón social');
  if (!(o.ruc as string)?.trim()) faltan.push('RUC');
  if (!(Number(o.monto) > 0)) faltan.push('al menos un detalle con monto');
  if (faltan.length > 0)
    return { error: `Antes de emitir, completa: ${faltan.join(', ')}.` };

  const admin = crearClienteAdmin();
  let pdf: Buffer;
  try {
    pdf = await generarPdfOda({
      codigo: o.codigo as string,
      fechaEmision: new Date().toISOString(),
      comprobante: (o.tipo_comprobante as TipoComprobante) ?? 'factura',
      proveedor: {
        razonSocial: (o.razon_social as string) ?? '',
        nombreComercial: (o.nombre_comercial as string) ?? '',
        ruc: (o.ruc as string) ?? '',
        tipo: (o.tipo_proveedor as TipoProveedorImp) ?? 'empresa',
        banco: (o.banco as string) ?? '',
        cuenta: (o.cuenta as string) ?? '',
        cci: (o.cci as string) ?? '',
        email: (o.email_proveedor as string) ?? '',
      },
      detalles: (detalles ?? []).map((x) => ({
        descripcion: (x.descripcion as string) ?? '',
        cantidad: Number(x.cantidad) || 0,
        precioUnitario: Number(x.precio_unitario) || 0,
        total: Number(x.monto) || 0,
      })),
      moneda: o.moneda as Moneda,
      condicionesPago: (o.condiciones_pago as string) ?? '',
    });
  } catch {
    return { error: 'No se pudo generar el PDF de la orden.' };
  }

  const ruta = `${new Date().getFullYear()}/${o.codigo}.pdf`;
  const { error: errSubida } = await admin.storage
    .from('ordenes')
    .upload(ruta, pdf, { contentType: 'application/pdf', upsert: true });
  if (errSubida) return { error: 'No se pudo guardar el PDF en el almacén.' };

  const { error: errEstado } = await ctx.supabase
    .from('ordenes_adquisicion')
    .update({
      estado: 'emitida',
      emitida_por: ctx.usuarioId,
      fecha_emision: new Date().toISOString(),
      pdf_url: ruta,
    })
    .eq('id', id)
    .eq('estado', 'borrador'); // candado
  if (errEstado) return { error: 'No se pudo emitir la orden.' };

  const { data: firmado } = await admin.storage
    .from('ordenes')
    .createSignedUrl(ruta, 3600);

  revalidatePath(`/ordenes/${id}`);
  revalidatePath('/ordenes');
  return { ok: true, urlDescarga: firmado?.signedUrl ?? null };
}

// REABRIR (solo admin/gerencia): una orden emitida vuelve a 'borrador' para
// corregir errores y volver a emitir. El PDF queda obsoleto y se regenera al
// emitir de nuevo. No se anula: la orden vive dentro de su ficha.
export async function reabrirOrden(id: string): Promise<Resultado> {
  const ctx = await ctxOrden(id);
  if (!ctx.ok) return { error: ctx.error };
  if (ctx.estado !== 'emitida')
    return { error: 'Solo se puede reabrir una orden emitida.' };

  const { error } = await ctx.supabase
    .from('ordenes_adquisicion')
    .update({
      estado: 'borrador',
      pdf_url: null,
      emitida_por: null,
      fecha_emision: null,
    })
    .eq('id', id)
    .eq('estado', 'emitida'); // candado
  if (error) return { error: 'No se pudo reabrir la orden.' };

  revalidatePath(`/ordenes/${id}`);
  revalidatePath('/ordenes');
  return { ok: true };
}
