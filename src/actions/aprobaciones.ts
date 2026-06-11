'use server';

import { revalidatePath } from 'next/cache';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { generarPdfCotizacion, type DatosPdf } from '@/lib/pdf';
import {
  enviarCorreoInterno,
  escaparHtml,
  plantillaCorreo,
} from '@/lib/correo';
import { uno } from '@/lib/util';
import { calcularTotales, formatearMonto, type Moneda } from '@/lib/calculos';

export type ResultadoAprobar =
  | { ok: true; codigo: string; correo: string; urlDescarga: string | null }
  | { ok?: never; error: string };

export type ResultadoObservar =
  | { ok: true; codigo: string; correo: string }
  | { ok?: never; error: string };

async function cargarPendiente(id: string) {
  const supabase = await crearClienteServidor();
  const { data: cot } = await supabase
    .from('cotizaciones')
    .select(
      `id, codigo, estado, proyecto, moneda, fee_porcentaje, fecha_envio_cliente, ejecutivo_id,
       cliente:clientes(nombre_comercial, razon_social, ruc),
       ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre, correo),
       items:cotizacion_items(orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal)`,
    )
    .eq('id', id)
    .maybeSingle();
  return { supabase, cot };
}

function refrescarVistas() {
  revalidatePath('/aprobaciones');
  revalidatePath('/panel');
  revalidatePath('/cotizaciones');
  revalidatePath('/banco');
}

// APROBAR: genera el PDF con formato Métrica, lo guarda en Storage, marca la
// cotización aprobada y envía el PDF POR CORREO INTERNO AL EJECUTIVO (jamás
// al cliente). Devuelve un enlace de descarga para quien aprueba.
export async function aprobarCotizacion(id: string): Promise<ResultadoAprobar> {
  const { usuario } = await exigirRol(['admin', 'gerencia']);
  const { supabase, cot } = await cargarPendiente(id);

  if (!cot) return { error: 'No se encontró la cotización.' };
  if (cot.estado !== 'pendiente')
    return { error: `Esta cotización ya fue resuelta (estado: ${cot.estado}).` };
  // Control interno: nadie aprueba lo que él mismo cotizó.
  if (cot.ejecutivo_id === usuario.id)
    return {
      error:
        'Control interno: esta cotización la creaste tú, debe aprobarla otro administrador.',
    };

  const cliente = uno(
    cot.cliente as { nombre_comercial: string; razon_social: string; ruc: string }[] | null,
  );
  const ejecutivo = uno(
    cot.ejecutivo as { nombre: string; correo: string }[] | null,
  );
  if (!cliente || !ejecutivo) return { error: 'Datos incompletos.' };

  const lineas = ((cot.items as unknown[]) ?? [])
    .map((i) => i as Record<string, unknown>)
    .sort((a, b) => (a.orden as number) - (b.orden as number))
    .map((l) => ({
      orden: l.orden as number,
      proveedor: l.proveedor_nombre as string,
      descripcion: l.descripcion as string,
      cantidad: Number(l.cantidad),
      precio: Number(l.precio_unitario),
      subtotal: Number(l.subtotal),
    }));

  // 1. Generar el PDF
  const datosPdf: DatosPdf = {
    codigo: cot.codigo as string,
    proyecto: cot.proyecto as string,
    moneda: cot.moneda as Moneda,
    feePorcentaje: Number(cot.fee_porcentaje),
    fechaEnvioCliente: cot.fecha_envio_cliente as string | null,
    cliente: {
      nombre: cliente.nombre_comercial,
      razonSocial: cliente.razon_social,
      ruc: cliente.ruc,
    },
    ejecutivo: ejecutivo.nombre,
    lineas,
  };
  let pdf: Buffer;
  try {
    pdf = await generarPdfCotizacion(datosPdf);
  } catch {
    return { error: 'No se pudo generar el PDF. Intenta de nuevo.' };
  }

  // 2. Guardarlo en Storage (bucket privado)
  const admin = crearClienteAdmin();
  const ruta = `${new Date().getFullYear()}/${cot.codigo}.pdf`;
  const { error: errorSubida } = await admin.storage
    .from('cotizaciones')
    .upload(ruta, pdf, { contentType: 'application/pdf', upsert: true });
  if (errorSubida)
    return { error: 'No se pudo guardar el PDF en el almacén. Intenta de nuevo.' };

  // 3. Marcar aprobada (el RLS exige rol admin/gerencia)
  const { error: errorEstado } = await supabase
    .from('cotizaciones')
    .update({
      estado: 'aprobada',
      aprobada_por: usuario.id,
      fecha_aprobacion: new Date().toISOString(),
      observacion_admin: null,
      pdf_url: ruta,
    })
    .eq('id', id)
    .eq('estado', 'pendiente'); // candado: solo si sigue pendiente
  if (errorEstado) return { error: 'No se pudo actualizar el estado.' };

  // 4. Correo interno AL EJECUTIVO con el PDF adjunto
  const totales = calcularTotales(
    lineas.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precio })),
    Number(cot.fee_porcentaje),
  );
  const correo = await enviarCorreoInterno({
    para: ejecutivo.correo,
    asunto: `✓ ${cot.codigo} aprobada · ${cliente.nombre_comercial}`,
    html: plantillaCorreo(
      `Cotización ${cot.codigo} aprobada`,
      `<p style="font-size:13px;">Hola ${escaparHtml(ejecutivo.nombre.split(' ')[0])},</p>
       <p style="font-size:13px;">Tu cotización fue <b style="color:#2E7D55;">aprobada</b> por ${escaparHtml(usuario.nombre)}. El PDF oficial va adjunto.</p>
       <table style="font-size:13px;margin:14px 0;">
         <tr><td style="color:#828B83;padding-right:14px;">Cliente</td><td><b>${escaparHtml(cliente.nombre_comercial)}</b></td></tr>
         <tr><td style="color:#828B83;padding-right:14px;">Proyecto</td><td>${escaparHtml(cot.proyecto as string)}</td></tr>
         <tr><td style="color:#828B83;padding-right:14px;">Total</td><td style="font-family:monospace;"><b>${formatearMonto(totales.total, cot.moneda as Moneda)}</b></td></tr>
       </table>`,
    ),
    adjuntos: [{ nombre: `${cot.codigo}.pdf`, contenido: pdf }],
  });

  // 5. Enlace de descarga para quien aprueba (válido 1 hora)
  const { data: firmado } = await admin.storage
    .from('cotizaciones')
    .createSignedUrl(ruta, 3600);

  refrescarVistas();
  return {
    ok: true,
    codigo: cot.codigo as string,
    correo: correo.detalle,
    urlDescarga: firmado?.signedUrl ?? null,
  };
}

// OBSERVAR: pide el texto, devuelve la cotización al ejecutivo (estado
// 'observada', conserva su código) y le avisa por correo interno.
export async function observarCotizacion(
  id: string,
  observacion: string,
): Promise<ResultadoObservar> {
  const { usuario } = await exigirRol(['admin', 'gerencia']);
  if (!observacion.trim())
    return { error: 'Escribe la observación para el ejecutivo.' };

  const { supabase, cot } = await cargarPendiente(id);
  if (!cot) return { error: 'No se encontró la cotización.' };
  if (cot.estado !== 'pendiente')
    return { error: `Esta cotización ya fue resuelta (estado: ${cot.estado}).` };

  const cliente = uno(cot.cliente as { nombre_comercial: string }[] | null);
  const ejecutivo = uno(
    cot.ejecutivo as { nombre: string; correo: string }[] | null,
  );

  const { error } = await supabase
    .from('cotizaciones')
    .update({ estado: 'observada', observacion_admin: observacion.trim() })
    .eq('id', id)
    .eq('estado', 'pendiente');
  if (error) return { error: 'No se pudo registrar la observación.' };

  const correo = await enviarCorreoInterno({
    para: ejecutivo?.correo ?? '',
    asunto: `⚠ ${cot.codigo} observada · ${cliente?.nombre_comercial ?? ''}`,
    html: plantillaCorreo(
      `Cotización ${cot.codigo} observada`,
      `<p style="font-size:13px;">Hola ${escaparHtml(ejecutivo?.nombre.split(' ')[0] ?? '')},</p>
       <p style="font-size:13px;">${escaparHtml(usuario.nombre)} devolvió tu cotización de <b>${escaparHtml(cliente?.nombre_comercial ?? '')}</b> con esta observación:</p>
       <p style="font-size:13px;background:#F6ECD2;color:#B5821E;padding:12px 16px;border-radius:8px;">${escaparHtml(observacion.trim())}</p>
       <p style="font-size:13px;">Corrígela en el sistema y reenvíala — conserva el mismo código.</p>`,
    ),
  });

  refrescarVistas();
  return { ok: true, codigo: cot.codigo as string, correo: correo.detalle };
}
