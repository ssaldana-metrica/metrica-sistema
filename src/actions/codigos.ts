'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';

// Toma un código del banco de forma atómica (la función de Postgres
// usa FOR UPDATE SKIP LOCKED: dos ejecutivos jamás reciben el mismo).
export async function tomarCodigo(): Promise<{ error: string } | never> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('tomar_codigo');

  if (error || !data) {
    return {
      error:
        error?.message?.includes('disponibles')
          ? 'No hay códigos disponibles para este año. Pide a administración generar más.'
          : 'No se pudo tomar el código. Intenta de nuevo.',
    };
  }

  redirect(`/cotizaciones/nueva?codigo=${encodeURIComponent(data.codigo)}`);
}
