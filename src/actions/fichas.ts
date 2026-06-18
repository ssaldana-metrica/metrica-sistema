'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { generarPdfFicha } from '@/lib/pdf-ficha';
import { enviarCorreoInterno, escaparHtml, plantillaCorreo } from '@/lib/correo';
import { urlSistema } from '@/config/sistema';
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

// Cada factura del cliente (puede haber varias por ficha).
export type FacturaClienteEntrada = {
  numFactura: string;
  oc: string;
  hes: string;
  fechaEmision: string | null;
  total: number | null;
};

// Cada factura de un proveedor (varias por proveedor), con moneda por línea.
export type FacturaProveedorEntrada = {
  numOc: string;
  numFactura: string;
  fechaEmision: string | null;
  total: number | null;
  monedaTotal: Moneda;
  importe: number | null;
  monedaImporte: Moneda;
};

export type SeguimientoProveedorEntrada = {
  fichaProveedorId: string;
  facturas: FacturaProveedorEntrada[];
};

type Resultado = { ok: true } | { error: string };

const MAX_PROVEEDORES = 60;
const fechaOnull = (v: string | null) => (v && v.trim() ? v.trim() : null);

type Supa = Awaited<ReturnType<typeof crearClienteServidor>>;
type Ctx =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: Supa;
      estado: string;
      usuarioId: string;
      usuarioNombre: string;
    };

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
    usuarioNombre: sesion.usuario.nombre,
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

  // Aviso a administración de que la ficha ya está lista para seguimiento.
  const ejecutivo = ctx.usuarioNombre;
  after(async () => {
    try {
      const admin = crearClienteAdmin();
      const [{ data: f }, { data: admins }] = await Promise.all([
        admin
          .from('fichas_apertura')
          .select('codigo, cliente_nombre')
          .eq('id', fichaId)
          .maybeSingle(),
        admin
          .from('usuarios')
          .select('correo')
          .in('rol', ['admin', 'gerencia'])
          .eq('activo', true),
      ]);
      const correos = (admins ?? []).map((a) => a.correo as string);
      if (correos.length === 0) return;
      const r = await enviarCorreoInterno({
        para: correos,
        asunto: `📋 ${f?.codigo ?? 'Ficha'} lista para seguimiento · ${f?.cliente_nombre ?? ''}`,
        html: plantillaCorreo(
          'Ficha de apertura lista para seguimiento',
          `<p style="font-size:13px;">${escaparHtml(ejecutivo)} completó su parte de la ficha <b>${escaparHtml((f?.codigo as string) ?? '')}</b> (${escaparHtml((f?.cliente_nombre as string) ?? '—')}).</p>
           <p style="font-size:13px;">Ya puedes registrar el <b>seguimiento</b> y cerrarla.</p>
           <p style="margin:14px 0 0;"><a href="${urlSistema()}/fichas/${fichaId}" style="display:inline-block;background:#0E7C66;color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:9px 16px;border-radius:8px;">Abrir la ficha →</a></p>`,
        ),
      });
      console.log(`[correo] ficha lista ${f?.codigo} a admin → ${r.detalle}`);
    } catch (e) {
      console.error('[correo] aviso de ficha lista falló:', e);
    }
  });

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
  facturasCliente: FacturaClienteEntrada[],
  proveedores: SeguimientoProveedorEntrada[],
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
    facturasCliente,
    proveedores,
  );
  if (errSeg) return { error: errSeg };

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}

// Guarda el seguimiento reemplazando las facturas: las del cliente (por ficha)
// y las de cada proveedor (por proveedor). Solo opera sobre proveedores que
// realmente pertenecen a la ficha.
async function persistirSeguimiento(
  supabase: Supa,
  fichaId: string,
  facturasCliente: FacturaClienteEntrada[],
  proveedores: SeguimientoProveedorEntrada[],
): Promise<string | null> {
  // Facturas del cliente (reemplazo completo).
  const { error: errDelC } = await supabase
    .from('ficha_facturas_cliente')
    .delete()
    .eq('ficha_id', fichaId);
  if (errDelC) return 'No se pudo actualizar las facturas del cliente.';

  const filasC = facturasCliente
    .filter(
      (f) =>
        f.numFactura.trim() ||
        f.oc.trim() ||
        f.hes.trim() ||
        f.fechaEmision ||
        f.total != null,
    )
    .map((f, i) => ({
      ficha_id: fichaId,
      orden: i + 1,
      num_factura: f.numFactura.trim(),
      oc: f.oc.trim(),
      hes: f.hes.trim(),
      fecha_emision: fechaOnull(f.fechaEmision),
      total: f.total,
    }));
  if (filasC.length > 0) {
    const { error } = await supabase
      .from('ficha_facturas_cliente')
      .insert(filasC);
    if (error) return 'No se pudieron guardar las facturas del cliente.';
  }

  // Proveedores válidos de esta ficha (evita tocar filas de otras fichas).
  const { data: provRows } = await supabase
    .from('ficha_proveedores')
    .select('id')
    .eq('ficha_id', fichaId);
  const idsValidos = new Set((provRows ?? []).map((r) => r.id as string));

  for (const p of proveedores) {
    if (!idsValidos.has(p.fichaProveedorId)) continue;

    const { error: errDelP } = await supabase
      .from('ficha_proveedor_facturas')
      .delete()
      .eq('ficha_proveedor_id', p.fichaProveedorId);
    if (errDelP) return 'No se pudo actualizar las facturas de un proveedor.';

    const filasP = p.facturas
      .filter(
        (f) =>
          f.numOc.trim() ||
          f.numFactura.trim() ||
          f.fechaEmision ||
          f.total != null ||
          f.importe != null,
      )
      .map((f, i) => ({
        ficha_proveedor_id: p.fichaProveedorId,
        orden: i + 1,
        num_oc: f.numOc.trim(),
        num_factura: f.numFactura.trim(),
        fecha_emision: fechaOnull(f.fechaEmision),
        total: f.total,
        moneda_total: f.monedaTotal,
        importe: f.importe,
        moneda_importe: f.monedaImporte,
      }));
    if (filasP.length > 0) {
      const { error } = await supabase
        .from('ficha_proveedor_facturas')
        .insert(filasP);
      if (error) return 'No se pudieron guardar las facturas de un proveedor.';
    }
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
  const provIds = (provs ?? []).map((p) => p.id as string);

  const [{ data: facCliente }, { data: facProv }] = await Promise.all([
    admin
      .from('ficha_facturas_cliente')
      .select('*')
      .eq('ficha_id', fichaId)
      .order('orden'),
    provIds.length
      ? admin
          .from('ficha_proveedor_facturas')
          .select('*')
          .in('ficha_proveedor_id', provIds)
          .order('orden')
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const facturasDe = (provId: string) =>
    (facProv ?? [])
      .filter((x) => (x.ficha_proveedor_id as string) === provId)
      .map((x) => ({
        numOc: (x.num_oc as string) ?? '',
        numFactura: (x.num_factura as string) ?? '',
        fechaEmision: (x.fecha_emision as string | null) ?? null,
        total: x.total != null ? Number(x.total) : null,
        monedaTotal: (x.moneda_total as Moneda) ?? 'PEN',
        importe: x.importe != null ? Number(x.importe) : null,
        monedaImporte: (x.moneda_importe as Moneda) ?? 'PEN',
      }));

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
      facturasCliente: (facCliente ?? []).map((x) => ({
        numFactura: (x.num_factura as string) ?? '',
        oc: (x.oc as string) ?? '',
        hes: (x.hes as string) ?? '',
        fechaEmision: (x.fecha_emision as string | null) ?? null,
        total: x.total != null ? Number(x.total) : null,
      })),
      proveedores: (provs ?? []).map((p) => ({
        orden: p.orden as number,
        agencia: (p.agencia as string) ?? '',
        influencer: (p.influencer_proveedor as string) ?? '',
        ruc: (p.ruc as string) ?? '',
        descripcion: (p.descripcion as string) ?? '',
        monto: Number(p.monto) || 0,
        banco: (p.banco as string) ?? '',
        cuentaCci: (p.cuenta_cci as string) ?? '',
        facturas: facturasDe(p.id as string),
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
  facturasCliente: FacturaClienteEntrada[],
  proveedores: SeguimientoProveedorEntrada[],
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

  const errSeg = await persistirSeguimiento(
    supabase,
    fichaId,
    facturasCliente,
    proveedores,
  );
  if (errSeg) return { error: errSeg };

  // Mínimo para cerrar: al menos una factura del cliente con N° y total > 0.
  const algunaValida = facturasCliente.some(
    (f) => f.numFactura.trim() && (f.total ?? 0) > 0,
  );
  if (!algunaValida)
    return {
      error:
        'Antes de cerrar, registra al menos una factura del cliente con N° y total mayor a cero.',
    };

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
    .select(
      `estado, codigo, cliente_nombre,
       cotizacion:cotizaciones!inner(
         ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre, correo)
       )`,
    )
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

  // Aviso al ejecutivo de que su ficha fue reabierta.
  const cot = Array.isArray(ficha.cotizacion)
    ? ficha.cotizacion[0]
    : ficha.cotizacion;
  const eje = cot
    ? Array.isArray(cot.ejecutivo)
      ? cot.ejecutivo[0]
      : cot.ejecutivo
    : null;
  const quienReabre = sesion.usuario.nombre;
  if (eje?.correo) {
    after(async () => {
      try {
        const r = await enviarCorreoInterno({
          para: eje.correo as string,
          asunto: `↩ ${ficha.codigo} reabierta · ${ficha.cliente_nombre ?? ''}`,
          html: plantillaCorreo(
            'Tu ficha de apertura fue reabierta',
            `<p style="font-size:13px;">Hola ${escaparHtml((eje.nombre as string)?.split(' ')[0] ?? '')},</p>
             <p style="font-size:13px;">${escaparHtml(quienReabre)} reabrió la ficha <b>${escaparHtml(ficha.codigo as string)}</b> (${escaparHtml((ficha.cliente_nombre as string) ?? '—')}). Actualiza lo necesario y vuelve a marcar tu parte como lista.</p>
             <p style="margin:14px 0 0;"><a href="${urlSistema()}/fichas/${fichaId}" style="display:inline-block;background:#0E7C66;color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:9px 16px;border-radius:8px;">Abrir la ficha →</a></p>`,
          ),
        });
        console.log(`[correo] ficha reabierta ${ficha.codigo} a ejecutivo → ${r.detalle}`);
      } catch (e) {
        console.error('[correo] aviso de reapertura falló:', e);
      }
    });
  }

  revalidatePath(`/fichas/${fichaId}`);
  revalidatePath('/fichas');
  return { ok: true };
}
