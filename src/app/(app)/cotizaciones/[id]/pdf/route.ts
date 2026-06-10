import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';

// Descarga del PDF de una cotización aprobada. El RLS decide quién puede:
// si la consulta no devuelve la cotización, tampoco hay PDF para ese usuario.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: cot } = await supabase
    .from('cotizaciones')
    .select('pdf_url')
    .eq('id', id)
    .maybeSingle();

  if (!cot?.pdf_url)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  const admin = crearClienteAdmin();
  const { data: firmado } = await admin.storage
    .from('cotizaciones')
    .createSignedUrl(cot.pdf_url as string, 3600);

  if (!firmado?.signedUrl)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  return NextResponse.redirect(firmado.signedUrl);
}
