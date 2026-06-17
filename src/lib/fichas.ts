import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Crea la ficha de apertura de una cotización si todavía no existe (relación
// 1 a 1). Idempotente: si ya hay ficha para esa cotización, devuelve la que
// existe sin duplicar. Hereda nombre y RUC del cliente y la moneda de la
// cotización como punto de partida (editables luego en la ficha). Se usa con
// el cliente admin (service_role), que ignora el RLS.
export async function crearFichaSiFalta(
  admin: SupabaseClient,
  cot: {
    cotizacionId: string;
    codigo: string;
    clienteNombre: string;
    clienteRuc: string;
    moneda: string;
  },
): Promise<{ id: string | null; creada: boolean }> {
  const { data: existente } = await admin
    .from('fichas_apertura')
    .select('id')
    .eq('cotizacion_id', cot.cotizacionId)
    .maybeSingle();
  if (existente) return { id: existente.id as string, creada: false };

  const { data, error } = await admin
    .from('fichas_apertura')
    .insert({
      cotizacion_id: cot.cotizacionId,
      codigo: `FA-${cot.codigo}`,
      cliente_nombre: cot.clienteNombre,
      cliente_ruc: cot.clienteRuc,
      moneda: cot.moneda,
    })
    .select('id')
    .single();

  if (error) {
    // Carrera rarísima: otra ejecución la creó entremedias (cotizacion_id es
    // único). Volvemos a leerla en vez de fallar.
    const { data: ya } = await admin
      .from('fichas_apertura')
      .select('id')
      .eq('cotizacion_id', cot.cotizacionId)
      .maybeSingle();
    return { id: (ya?.id as string) ?? null, creada: false };
  }
  return { id: data.id as string, creada: true };
}
