'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { puedeReactivarAnulacion } from '@/config/permisos';
import type { ControlFila } from '@/lib/control';

export type CambioControl = {
  fichaId: string;
  fichaProveedorId: string;
  datos: ControlFila;
};

type Resultado = { ok: true } | { error: string };

const limpiarFecha = (v: string | null) => (v && v.trim() ? v.trim() : null);

// Guarda en lote los campos de administración (zona derecha) de la tabla de
// control. Upsert por proveedor (ficha_proveedor_id es único). Solo admin y
// gerencia (rol + RLS).
export async function guardarControlLote(
  cambios: CambioControl[],
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede editar la tabla de control.' };
  if (cambios.length === 0) return { ok: true };

  const supabase = await crearClienteServidor();
  const filas = cambios.map((c) => ({
    ficha_id: c.fichaId,
    ficha_proveedor_id: c.fichaProveedorId,
    n_contrato: c.datos.nContrato.trim(),
    factura_proveedor: c.datos.facturaProveedor.trim(),
    oc_os_cliente: c.datos.ocOsCliente.trim(),
    factura_cliente: c.datos.facturaCliente.trim(),
    fecha_facturacion: limpiarFecha(c.datos.fechaFacturacion),
    fecha_cobro: limpiarFecha(c.datos.fechaCobro),
  }));

  const { error } = await supabase
    .from('control_proceso')
    .upsert(filas, { onConflict: 'ficha_proveedor_id' });
  if (error) return { error: 'No se pudieron guardar los cambios.' };

  revalidatePath('/control');
  return { ok: true };
}

// ANULAR PROCESO (solo admin/gerencia, motivo obligatorio): dispara la función
// atómica anular_proceso(), que anula EN BLOQUE la cotización, su código COT,
// la ficha y todas las ODA del proceso con sus códigos. O se anulan todos o
// ninguno (la función corre en una sola transacción).
export async function anularProceso(
  fichaId: string,
  motivo: string,
): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!['admin', 'gerencia'].includes(sesion.usuario.rol))
    return { error: 'Solo administración puede anular procesos.' };
  if (!motivo.trim()) return { error: 'Escribe el motivo de la anulación.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('anular_proceso', {
    p_ficha_id: fichaId,
    p_motivo: motivo.trim(),
  });
  if (error)
    return { error: error.message ?? 'No se pudo anular el proceso.' };

  // El estado anulado se refleja en todas las pantallas afectadas.
  revalidatePath('/control');
  revalidatePath('/cotizaciones');
  revalidatePath('/fichas');
  revalidatePath('/ordenes');
  return { ok: true };
}

// REACTIVAR PROCESO (solo gerencia y Erika): revierte la anulación en cascada.
// Dispara la función atómica reactivar_proceso(), que restaura la cotización,
// la ficha y las ODA a su estado previo, y devuelve sus códigos a 'en_uso'.
export async function reactivarProceso(fichaId: string): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!puedeReactivarAnulacion(sesion.usuario))
    return { error: 'Solo Gerencia o Erika pueden reactivar un proceso anulado.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('reactivar_proceso', {
    p_ficha_id: fichaId,
  });
  if (error)
    return { error: error.message ?? 'No se pudo reactivar el proceso.' };

  revalidatePath('/control');
  revalidatePath('/cotizaciones');
  revalidatePath('/fichas');
  revalidatePath('/ordenes');
  return { ok: true };
}
