'use server';

import { redirect } from 'next/navigation';

// El código ya no se "toma" por adelantado: se asigna el correlativo al guardar
// la cotización (ver crear_cotizacion). Este atajo solo abre el formulario nuevo.
export async function tomarCodigo(): Promise<never> {
  redirect('/cotizaciones/nueva');
}
