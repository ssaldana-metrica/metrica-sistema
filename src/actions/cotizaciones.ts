'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { redondear, type Moneda } from '@/lib/calculos';

export type LineaEntrada = {
  proveedorNombre: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

export type EntradaCotizacion = {
  codigo: string;
  clienteId: string;
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
    cliente_id: entrada.clienteId,
    proyecto: entrada.proyecto.trim(),
    moneda: entrada.moneda,
    fee_porcentaje: entrada.feePorcentaje,
    fecha_envio_cliente: entrada.fechaEnvioCliente || null,
  };

  let id: string;

  if (existente) {
    const { error } = await supabase
      .from('cotizaciones')
      .update({
        ...campos,
        // Al reenviar tras una observación pasa a 'pendiente' con el MISMO
        // código; si solo guarda, conserva su estado actual.
        estado: enviar ? 'pendiente' : existente.estado,
      })
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
        estado: enviar ? 'pendiente' : 'borrador',
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

  revalidatePath('/banco');
  revalidatePath('/panel');
  revalidatePath('/cotizaciones');

  redirect(`/cotizaciones/${id}?${enviar ? 'enviada' : 'guardada'}=1`);
}
