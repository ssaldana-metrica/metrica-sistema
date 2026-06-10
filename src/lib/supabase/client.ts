import { createBrowserClient } from '@supabase/ssr';

// Conexión a Supabase desde el navegador (respeta RLS).
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
