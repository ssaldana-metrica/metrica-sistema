'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { puedeReactivarAnulacion } from '@/config/permisos';
import {
  enviarCorreoInterno,
  escaparHtml,
  plantillaCorreo,
} from '@/lib/correo';
import { uno } from '@/lib/util';
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

  // Aviso por correo al ejecutivo dueño del proceso, con el motivo. (Después de
  // responder, para no frenar la pantalla; si el correo falla, no afecta.)
  const quien = sesion.usuario.nombre;
  const motivoLimpio = motivo.trim();
  after(async () => {
    try {
      const admin = crearClienteAdmin();
      const { data: info } = await admin
        .from('fichas_apertura')
        .select(
          `codigo, cliente_nombre,
           cotizacion:cotizaciones!inner(
             ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre, correo)
           )`,
        )
        .eq('id', fichaId)
        .maybeSingle();
      const cot = uno(
        info?.cotizacion as
          | { ejecutivo: { nombre: string; correo: string }[] }[]
          | null,
      );
      const eje = uno(cot?.ejecutivo ?? null);
      if (!eje?.correo) return;
      const codigo = (info?.codigo as string) ?? 'Proceso';
      const cliente = (info?.cliente_nombre as string) ?? '—';
      await enviarCorreoInterno({
        para: eje.correo as string,
        asunto: `⛔ ${codigo} anulado · ${cliente}`,
        html: plantillaCorreo(
          `Proceso ${codigo} anulado`,
          `<p style="font-size:13px;">Hola ${escaparHtml((eje.nombre as string)?.split(' ')[0] ?? '')},</p>
           <p style="font-size:13px;">${escaparHtml(quien)} anuló el proceso <b>${escaparHtml(codigo)}</b> (${escaparHtml(cliente)}): se anularon la cotización, la ficha de apertura y todas las ODA.</p>
           <p style="font-size:13px;background:#F4E2DD;color:#B23A2C;padding:12px 16px;border-radius:8px;"><b>Motivo de la anulación:</b><br/>${escaparHtml(motivoLimpio).replace(/\n/g, '<br/>')}</p>`,
        ),
      });
    } catch (e) {
      console.error('[correo] aviso de anulación falló:', e);
    }
  });

  // El estado anulado se refleja en todas las pantallas afectadas.
  revalidatePath('/control');
  revalidatePath('/cotizaciones');
  revalidatePath('/fichas');
  revalidatePath('/ordenes');
  return { ok: true };
}

// REACTIVAR PROCESO (gerencia siempre; otros usuarios si Gerencia les activó el
// permiso en Usuarios): revierte la anulación en cascada. Dispara la función
// atómica reactivar_proceso(), que restaura la cotización, la ficha y las ODA a
// su estado previo, y devuelve sus códigos a 'en_uso'.
export async function reactivarProceso(fichaId: string): Promise<Resultado> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: 'Sesión expirada. Vuelve a entrar.' };
  if (!puedeReactivarAnulacion(sesion.usuario))
    return { error: 'No tienes permiso para reactivar procesos anulados.' };

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
