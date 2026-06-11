// Valor especial del selector de cliente para "registrar uno nuevo".
export const NUEVO_CLIENTE = '__nuevo__';

// Supabase tipa las relaciones a-uno como arreglo cuando no hay tipos
// generados; en tiempo de ejecución llega un objeto. Esto normaliza ambos.
export function uno<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
