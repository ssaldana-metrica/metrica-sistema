'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { redondear, type Moneda } from '@/lib/calculos';
import { NUEVO_CLIENTE } from '@/lib/util';

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

  // ¿Ya existe una cotización con este código? (el RLS solo muestra la propia)
  const { data: existente } = await supabase
    .from('cotizaciones')
    .select('id, estado')
    .eq('codigo', entrada.codigo)
    .maybeSingle();

  if (existente && !['borrador', 'observada'].includes(existente.estado)) {
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
    const { data, error } = await supabase
      .from('cotizaciones')
      .insert({
        codigo: entrada.codigo,
        ejecutivo_id: sesion.usuario.id,
        ...campos,
        estado: 'borrador',
      })
      .select('id')
      .single();
    if (error || !data)
      return {
        error:
          'No se pudo crear la cotización. Verifica que el código del banco sea tuyo.',
      };
    id = data.id;
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
  }

  revalidatePath('/banco');
  revalidatePath('/panel');
  revalidatePath('/cotizaciones');

  redirect(`/cotizaciones/${id}?${enviar ? 'enviada' : 'guardada'}=1`);
}
