'use server';

import { revalidatePath } from 'next/cache';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';

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
       banco, cuenta_cci, email_proveedor,
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
  if (ficha?.estado !== 'completa')
    return { error: 'La ficha debe estar completa para generar órdenes.' };

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
      cuenta_cci: (prov.cuenta_cci as string) ?? '',
      email_proveedor: (prov.email_proveedor as string) ?? '',
    })
    .select('id')
    .single();
  if (error || !orden)
    return { error: 'No se pudo crear la orden. Intenta de nuevo.' };

  revalidatePath(`/fichas/${prov.ficha_id as string}`);
  revalidatePath('/ordenes');
  return { ok: true, id: orden.id as string, yaExistia: false };
}
