'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { generarPdfOda } from '@/lib/pdf-oda';
import { redondear, type Moneda } from '@/lib/calculos';
import type { TipoComprobante } from '@/config/impuestos';
import {
  ETIQUETA_TIPO_PROVEEDOR,
  montoAlcanzaMinimo,
  textoMinimo,
  type TipoProveedorOda,
} from '@/config/oda-proveedores';

// Acciones de las ODA de Proveedores — el gasto propio de la oficina.
//
// Se parecen a las de `ordenes.ts` pero NO son las mismas, y conviene que sigan
// separadas: aquellas nacen de una ficha y arrastran agencia, influencer y
// código de cotización; estas se escriben desde cero y no tienen nada de eso.
// Compartir el archivo obligaría a que la mitad de los campos fueran opcionales
// en ambos lados.

export type DetalleOrdenProveedor = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

export type DatosOrdenProveedor = {
  tipoProveedor: TipoProveedorOda;
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  tipoComprobante: TipoComprobante;
  condicionesPago: string;
  moneda: Moneda;
  detalles: DetalleOrdenProveedor[];
  banco: string;
  cuenta: string;
  cci: string;
  emailProveedor: string;
};

const MAX_DETALLES = 60;

type Resultado = { ok: true } | { error: string };

// ── Crear ───────────────────────────────────────────────────────────────────

// El código sale del banco ODA-PROV en la misma transacción que crea la orden,
// vía crear_orden_proveedor(). Por eso no se hace un insert directo: la función
// es la que garantiza que el correlativo salga en secuencia y sin huecos aunque
// dos personas pulsen "+ Nueva ODA" a la vez.
export async function crearOrdenProveedor(): Promise<
  { ok: true; id: string } | { error: string }
> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede crear órdenes.' };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('crear_orden_proveedor');

  if (error) {
    return {
      error: error.message?.includes('disponibles')
        ? 'No hay códigos ODA-PROV disponibles para este año. Pide a administración generar más.'
        : 'No se pudo crear la orden. Intenta de nuevo.',
    };
  }
  if (!data) return { error: 'No se pudo crear la orden. Intenta de nuevo.' };

  revalidatePath('/ordenes/proveedores');
  return { ok: true, id: data as string };
}

// ── Contexto compartido ─────────────────────────────────────────────────────

async function ctx(id: string) {
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false as const, error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { ok: false as const, error: 'Solo administración puede gestionar órdenes.' };

  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from('ordenes_proveedores')
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

// ── Guardar ─────────────────────────────────────────────────────────────────

export async function guardarOrdenProveedor(
  id: string,
  datos: DatosOrdenProveedor,
): Promise<Resultado> {
  const c = await ctx(id);
  if (!c.ok) return { error: c.error };
  if (c.estado !== 'borrador')
    return { error: 'Solo se puede editar una orden en borrador.' };
  if (datos.detalles.length > MAX_DETALLES)
    return { error: `Máximo ${MAX_DETALLES} líneas de detalle.` };
  if (datos.detalles.some((d) => d.cantidad < 0 || d.precioUnitario < 0))
    return { error: 'Hay una línea con cantidad o precio negativo.' };

  const lineas = datos.detalles
    .map((d) => ({
      descripcion: d.descripcion,
      cantidad: d.cantidad || 0,
      precioUnitario: d.precioUnitario || 0,
      monto: redondear((d.cantidad || 0) * (d.precioUnitario || 0)),
    }))
    .filter((d) => d.descripcion.trim() || d.monto > 0);
  const total = redondear(lineas.reduce((a, d) => a + d.monto, 0));

  // Guardar NO valida el mínimo: se puede dejar un borrador a medias y volver
  // mañana. El mínimo se exige al emitir, que es cuando la orden se convierte
  // en un compromiso.
  const { error } = await c.supabase
    .from('ordenes_proveedores')
    .update({
      tipo_proveedor: datos.tipoProveedor,
      razon_social: datos.razonSocial.trim(),
      nombre_comercial: datos.nombreComercial.trim(),
      ruc: datos.ruc.trim(),
      tipo_comprobante: datos.tipoComprobante,
      monto: total,
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

  const { error: errDel } = await c.supabase
    .from('orden_proveedor_detalles')
    .delete()
    .eq('orden_id', id);
  if (errDel) return { error: 'No se pudo actualizar el detalle.' };

  if (lineas.length > 0) {
    const { error: errIns } = await c.supabase
      .from('orden_proveedor_detalles')
      .insert(
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

  revalidatePath(`/ordenes/proveedores/${id}`);
  revalidatePath('/ordenes/proveedores');
  return { ok: true };
}

// ── Emitir ──────────────────────────────────────────────────────────────────

export type ResultadoEmitir =
  | { ok: true; urlDescarga: string | null }
  | { error: string };

export async function emitirOrdenProveedor(id: string): Promise<ResultadoEmitir> {
  const c = await ctx(id);
  if (!c.ok) return { error: c.error };
  if (c.estado !== 'borrador')
    return { error: 'Esta orden ya fue emitida o anulada.' };

  const { data: o } = await c.supabase
    .from('ordenes_proveedores')
    .select(
      `codigo, tipo_proveedor, razon_social, nombre_comercial, ruc,
       tipo_comprobante, monto, moneda, banco, cuenta, cci, email_proveedor,
       condiciones_pago`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!o) return { error: 'No se encontró la orden.' };

  const monto = Number(o.monto) || 0;
  const moneda = (o.moneda as Moneda) ?? 'PEN';

  const faltan: string[] = [];
  if (!(o.razon_social as string)?.trim()) faltan.push('razón social');
  if (!(o.ruc as string)?.trim()) faltan.push('RUC');
  if (monto <= 0) faltan.push('al menos un detalle con monto');
  if (faltan.length > 0)
    return { error: `Antes de emitir, completa: ${faltan.join(', ')}.` };

  // El mínimo. Se comprueba acá, en el servidor, y no solo en la pantalla:
  // el aviso del formulario orienta, pero esta es la barrera de verdad.
  if (!montoAlcanzaMinimo(monto, moneda)) {
    return {
      error: `Estas órdenes se emiten desde ${textoMinimo(moneda)} (sin IGV). Esta suma ${
        moneda === 'USD' ? 'US$' : 'S/'
      } ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.`,
    };
  }

  const { data: detalles } = await c.supabase
    .from('orden_proveedor_detalles')
    .select('descripcion, cantidad, precio_unitario, monto')
    .eq('orden_id', id)
    .order('posicion');

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
        // Donde la ODA de proyecto imprime "Empresa" o "Persona natural", esta
        // imprime el tipo de gasto, que es el dato que le corresponde.
        etiquetaTipo:
          ETIQUETA_TIPO_PROVEEDOR[o.tipo_proveedor as TipoProveedorOda] ?? 'Otros',
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
      moneda,
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

  const { data: emitida, error: errEstado } = await c.supabase
    .from('ordenes_proveedores')
    .update({
      estado: 'emitida',
      emitida_por: c.usuarioId,
      fecha_emision: new Date().toISOString(),
      pdf_url: ruta,
    })
    .eq('id', id)
    .eq('estado', 'borrador') // candado
    .select('id');
  if (errEstado) return { error: 'No se pudo emitir la orden.' };
  if (!emitida || emitida.length === 0)
    return { error: 'El estado de la orden cambió. Recarga la página.' };

  const { data: firmado } = await admin.storage
    .from('ordenes')
    .createSignedUrl(ruta, 3600);

  revalidatePath(`/ordenes/proveedores/${id}`);
  revalidatePath('/ordenes/proveedores');
  return { ok: true, urlDescarga: firmado?.signedUrl ?? null };
}

// ── Reabrir ─────────────────────────────────────────────────────────────────

export async function reabrirOrdenProveedor(id: string): Promise<Resultado> {
  const c = await ctx(id);
  if (!c.ok) return { error: c.error };
  if (c.estado !== 'emitida')
    return { error: 'Solo se puede reabrir una orden emitida.' };

  const { error } = await c.supabase
    .from('ordenes_proveedores')
    .update({ estado: 'borrador', pdf_url: null, emitida_por: null, fecha_emision: null })
    .eq('id', id)
    .eq('estado', 'emitida'); // candado
  if (error) return { error: 'No se pudo reabrir la orden.' };

  revalidatePath(`/ordenes/proveedores/${id}`);
  revalidatePath('/ordenes/proveedores');
  return { ok: true };
}

// ── Anular ──────────────────────────────────────────────────────────────────

// A diferencia de las ODA de proyecto, que no se anulan sueltas porque viven
// dentro de una ficha, estas sí: no hay proceso que las contenga, así que una
// orden equivocada necesita poder cerrarse. El código queda anulado para
// siempre — nunca se reutiliza — igual que en el resto del sistema.
export async function anularOrdenProveedor(
  id: string,
  motivo: string,
): Promise<Resultado> {
  const c = await ctx(id);
  if (!c.ok) return { error: c.error };
  if (c.estado === 'anulada') return { error: 'Esta orden ya está anulada.' };

  const razon = motivo.trim();
  if (!razon) return { error: 'El motivo de anulación es obligatorio.' };

  const { data: orden } = await c.supabase
    .from('ordenes_proveedores')
    .select('codigo')
    .eq('id', id)
    .maybeSingle();
  if (!orden) return { error: 'No se encontró la orden.' };

  const { error } = await c.supabase
    .from('ordenes_proveedores')
    .update({ estado: 'anulada', anulada_por: c.usuarioId, motivo_anulacion: razon })
    .eq('id', id)
    .neq('estado', 'anulada'); // candado
  if (error) return { error: 'No se pudo anular la orden.' };

  const { error: errCodigo } = await c.supabase
    .from('banco_codigos_oda_prov')
    .update({ estado: 'anulado' })
    .eq('codigo', orden.codigo as string);
  if (errCodigo) return { error: 'La orden se anuló pero el código quedó en uso. Avisa a soporte.' };

  revalidatePath(`/ordenes/proveedores/${id}`);
  revalidatePath('/ordenes/proveedores');
  return { ok: true };
}
