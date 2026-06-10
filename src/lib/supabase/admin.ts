import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Conexión privilegiada (service_role): salta RLS. SOLO se usa en el servidor
// para tareas administrativas: alta automática de usuarios, PDFs, correos.
// El import de 'server-only' hace que el build falle si alguien intenta
// usar esta llave desde código del navegador.
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
