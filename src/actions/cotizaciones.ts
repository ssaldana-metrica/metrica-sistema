'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import {
  calcularTotales,
  formatearMonto,
  redondear,
  type Moneda,
} from '@/lib/calculos';
import { NUEVO_CLIENTE } from '@/lib/util';
import {
  enviarCorreoInterno,
  escaparHtml,
  plantillaCorreo,
} from '@/lib/correo';
import { generarPdfCotizacion } from '@/lib/pdf';

export type LineaEntrada = {
  proveedorNombre: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

export type EntradaCotizacion = {
  codigo: string;
  clienteId: string; // id existente o NUEVO_CLIENTE
  clienteNuevo?: { nombre: string; razonSocial: string; ruc: string };
  proyecto: string;
  moneda: Moneda;
  feePorcentaje: number;
  fechaEnvioCliente: string | null;
  lineas: LineaEntrada[];
};

const MAX_LINEAS = 40;

// Guarda la cotización (crea o actualiza) y, si `enviar` es true, la pasa
// a estado 'pendiente' para la cola de administración. Una cotización
// observada conserva SIEMPRE su código: aquí solo cambian datos y estado.
export async function guardarCotizacion(
  entrada: EntradaCotizacion,
  enviar: boolean,
): Promise<{ error: string } | never> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/login');

  // ── Validaciones ──
  if (!entrada.clienteId) return { error: 'Selecciona un cliente.' };
  if (entrada.lineas.length === 0)
    return { error: 'Agrega al menos una línea de proveedor.' };
  if (entrada.lineas.length > MAX_LINEAS)
    return { error: `Máximo ${MAX_LINEAS} líneas por cotización.` };
  if (entrada.feePorcentaje < 0 || entrada.feePorcentaje > 100)
    return { error: 'El fee debe estar entre 0% y 100%.' };
  // Negativos jamás, ni siquiera en borrador: la base los rechazaría a mitad
  // del reemplazo de líneas y se perderían las anteriores.
  const negativa = entrada.lineas.findIndex(
    (l) => l.cantidad < 0 || l.precioUnitario < 0,
  );
  if (negativa >= 0)
    return {
      error: `La línea ${negativa + 1} tiene cantidad o precio negativo.`,
    };

  if (enviar) {
    if (!entrada.proyecto.trim())
      return { error: 'Escribe el nombre del proyecto antes de enviar.' };
    const incompleta = entrada.lineas.findIndex(
      (l) => !l.proveedorNombre.trim() || l.cantidad <= 0 || l.precioUnitario < 0,
    );
    if (incompleta >= 0)
      return {
        error: `La línea ${incompleta + 1} está incompleta (proveedor y cantidad mayor a cero).`,
      };
  }

  const supabase = await crearClienteServidor();

  // Cliente nuevo escrito a mano: lo registra (o reutiliza si ya existe
  // uno con el mismo nombre) y usa su id.
  let clienteId = entrada.clienteId;
  if (clienteId === NUEVO_CLIENTE) {
    const nombre = entrada.clienteNuevo?.nombre.trim() ?? '';
    if (!nombre) return { error: 'Escribe el nombre del cliente nuevo.' };

    const admin = crearClienteAdmin();
    const { data: yaExiste } = await admin
      .from('clientes')
      .select('id')
      .ilike('nombre_comercial', nombre)
      .maybeSingle();

    if (yaExiste) {
      clienteId = yaExiste.id as string;
    } else {
      const { data: creado, error: errorCliente } = await admin
        .from('clientes')
        .insert({
          nombre_comercial: nombre,
          razon_social: entrada.clienteNuevo?.razonSocial.trim() || nombre,
          ruc: entrada.clienteNuevo?.ruc.trim() || '',
        })
        .select('id')
        .single();
      if (errorCliente || !creado)
        return { error: 'No se pudo registrar el cliente nuevo.' };
      clienteId = creado.id as string;
    }
  }

  // Editar una existente (borrador/observada) exige su código; una nueva NO
  // trae código: el banco se lo asigna al crearla (correlativo estricto).
  const esNueva = !entrada.codigo?.trim();

  let existente: { id: string; estado: string } | null = null;
  if (!esNueva) {
    const { data } = await supabase
      .from('cotizaciones')
      .select('id, estado')
      .eq('codigo', entrada.codigo)
      .maybeSingle();
    existente = (data as { id: string; estado: string } | null) ?? null;
    if (!existente) return { error: 'No se encontró la cotización a editar.' };
    if (!['borrador', 'observada'].includes(existente.estado))
      return {
        error: `Esta cotización ya está en estado "${existente.estado}" y no se puede editar.`,
      };
  }

  const campos = {
    cliente_id: clienteId,
    proyecto: entrada.proyecto.trim(),
    moneda: entrada.moneda,
    fee_porcentaje: entrada.feePorcentaje,
    fecha_envio_cliente: entrada.fechaEnvioCliente || null,
  };

  let id: string;

  // IMPORTANTE: las líneas se guardan ANTES de pasar a 'pendiente'.
  // El candado RLS solo permite tocar líneas de una cotización en
  // borrador u observada; si cambiáramos el estado primero, el propio
  // candado bloquearía el guardado de las líneas.
  if (existente) {
    const { error } = await supabase
      .from('cotizaciones')
      .update(campos)
      .eq('id', existente.id);
    if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' };
    id = existente.id;

    const { error: errorBorrado } = await supabase
      .from('cotizacion_items')
      .delete()
      .eq('cotizacion_id', id);
    if (errorBorrado)
      return { error: 'No se pudieron actualizar las líneas. Intenta de nuevo.' };
  } else {
    // Nueva: el banco entrega el correlativo y crea la cotización en la MISMA
    // transacción → sin duplicados y sin huecos por borradores abandonados.
    const { data: creada, error } = await supabase.rpc('crear_cotizacion', {
      p_cliente_id: clienteId,
      p_proyecto: entrada.proyecto.trim(),
      p_moneda: entrada.moneda,
      p_fee_porcentaje: entrada.feePorcentaje,
      p_fecha_envio: entrada.fechaEnvioCliente || null,
    });
    if (error)
      return {
        error: error.message?.includes('disponibles')
          ? 'No hay códigos disponibles para este año. Pide a administración generar más.'
          : 'No se pudo crear la cotización. Intenta de nuevo.',
      };
    const fila = (Array.isArray(creada) ? creada[0] : creada) as
      | { cot_id: string; cot_codigo: string }
      | undefined;
    if (!fila?.cot_id)
      return { error: 'No se pudo crear la cotización. Intenta de nuevo.' };
    id = fila.cot_id;
  }

  const filas = entrada.lineas.map((l, i) => ({
    cotizacion_id: id,
    orden: i + 1,
    proveedor_nombre: l.proveedorNombre.trim(),
    descripcion: l.descripcion.trim(),
    cantidad: l.cantidad || 0,
    precio_unitario: l.precioUnitario || 0,
    subtotal: redondear((l.cantidad || 0) * (l.precioUnitario || 0)),
  }));
  const { error: errorLineas } = await supabase
    .from('cotizacion_items')
    .insert(filas);
  if (errorLineas)
    return { error: 'No se pudieron guardar las líneas. Intenta de nuevo.' };

  // Con las líneas ya guardadas, recién ahora pasa a la cola de aprobación.
  // Al reenviar tras una observación conserva el MISMO código.
  if (enviar) {
    const { error: errorEnvio } = await supabase
      .from('cotizaciones')
      .update({ estado: 'pendiente' })
      .eq('id', id);
    if (errorEnvio)
      return {
        error:
          'Se guardó el borrador, pero no se pudo enviar a aprobación. Intenta de nuevo.',
      };

    // Aviso interno a administración (después de responder, para no
    // frenar la pantalla; si el correo falla, el envío no se afecta).
    const codigo = entrada.codigo;
    const ejecutivo = sesion.usuario.nombre;
    const totales = calcularTotales(
      entrada.lineas.map((l) => ({
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
      entrada.feePorcentaje,
    );
    const moneda = entrada.moneda;
    const proyecto = entrada.proyecto.trim();
    const fechaEnvioCliente = entrada.fechaEnvioCliente;
    const feePorcentaje = entrada.feePorcentaje;
    const lineasPdf = entrada.lineas.map((l, i) => ({
      orden: i + 1,
      proveedor: l.proveedorNombre.trim(),
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad || 0,
      precio: l.precioUnitario || 0,
      subtotal: redondear((l.cantidad || 0) * (l.precioUnitario || 0)),
    }));
    after(async () => {
      try {
        const admin = crearClienteAdmin();
        const [{ data: admins }, { data: cliente }] = await Promise.all([
          admin
            .from('usuarios')
            .select('correo')
            .eq('rol', 'admin')
            .eq('activo', true),
          admin
            .from('clientes')
            .select('nombre_comercial, razon_social, ruc')
            .eq('id', clienteId)
            .maybeSingle(),
        ]);
        const correos = (admins ?? []).map((a) => a.correo as string);
        if (correos.length === 0) {
          console.warn(`[correo] ${codigo}: sin admins activos a quienes avisar`);
          return;
        }

        // PDF preliminar (con franja "pendiente de aprobación") para que
        // administración revise sin entrar al sistema. Si la generación
        // falla, el aviso sale igual, solo que sin adjunto.
        let adjuntos: { nombre: string; contenido: Buffer }[] | undefined;
        try {
          const pdf = await generarPdfCotizacion({
            codigo,
            proyecto,
            moneda,
            feePorcentaje,
            fechaEnvioCliente,
            cliente: {
              nombre: cliente?.nombre_comercial ?? '—',
              razonSocial: cliente?.razon_social ?? '—',
              ruc: cliente?.ruc ?? '',
            },
            ejecutivo,
            lineas: lineasPdf,
            preliminar: true,
          });
          adjuntos = [{ nombre: `${codigo}-preliminar.pdf`, contenido: pdf }];
        } catch (e) {
          console.error(`[correo] ${codigo}: no se pudo generar el PDF preliminar:`, e);
        }

        const resultado = await enviarCorreoInterno({
          para: correos,
          asunto: `⏳ ${codigo} pendiente de aprobación · ${cliente?.nombre_comercial ?? ''}`,
          html: plantillaCorreo(
            `Nueva cotización por aprobar`,
            `<p style="font-size:13px;">${escaparHtml(ejecutivo)} envió una cotización a la cola de aprobación:</p>
             <table style="font-size:13px;margin:14px 0;">
               <tr><td style="color:#828B83;padding-right:14px;">Código</td><td style="font-family:monospace;"><b>${codigo}</b></td></tr>
               <tr><td style="color:#828B83;padding-right:14px;">Cliente</td><td>${escaparHtml(cliente?.nombre_comercial ?? '—')}</td></tr>
               <tr><td style="color:#828B83;padding-right:14px;">Proyecto</td><td>${escaparHtml(proyecto || '—')}</td></tr>
               <tr><td style="color:#828B83;padding-right:14px;">Monto neto</td><td style="font-family:monospace;">${formatearMonto(totales.neto, moneda)}</td></tr>
               <tr><td style="color:#828B83;padding-right:14px;">Total</td><td style="font-family:monospace;"><b>${formatearMonto(totales.total, moneda)}</b></td></tr>
             </table>
             <p style="font-size:13px;">${adjuntos ? 'Va adjunta la <b>vista preliminar en PDF</b> para tu revisión. ' : ''}Para aprobarla u observarla, entra al sistema, sección <b>Aprobaciones</b>.</p>`,
          ),
          adjuntos,
        });
        // Visible en la terminal del servidor: éxito o causa exacta del fallo
        console.log(`[correo] aviso de ${codigo} a admin → ${resultado.detalle}`);
      } catch (e) {
        console.error(`[correo] aviso de ${codigo} falló:`, e);
      }
    });
  }

  revalidatePath('/banco');
  revalidatePath('/panel');
  revalidatePath('/cotizaciones');

  redirect(`/cotizaciones/${id}?${enviar ? 'enviada' : 'guardada'}=1`);
}
