import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';

// Descarga del PDF de una orden. El RLS limita la tabla a admin/gerencia: si la
// consulta no devuelve la orden, tampoco hay PDF para ese usuario.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from('ordenes_adquisicion')
    .select('pdf_url')
    .eq('id', id)
    .maybeSingle();

  if (!orden?.pdf_url)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  const admin = crearClienteAdmin();
  const { data: firmado } = await admin.storage
    .from('ordenes')
    .createSignedUrl(orden.pdf_url as string, 3600);

  if (!firmado?.signedUrl)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  return NextResponse.redirect(firmado.signedUrl);
}
