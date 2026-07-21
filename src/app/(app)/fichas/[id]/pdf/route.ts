import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';

// Descarga del PDF de una ficha completa. El RLS decide quién puede verla:
// si la consulta no devuelve la ficha, tampoco hay PDF para ese usuario.
// El archivo se transmite desde el servidor (no se redirige a una URL firmada
// portadora), así el enlace con datos internos nunca llega al navegador.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'Sin acceso' }, { status: 401 });

  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('estado, pdf_url')
    .eq('id', id)
    .maybeSingle();

  if (!ficha?.pdf_url)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  // Una ficha anulada no se sirve como si siguiera vigente.
  if (ficha.estado === 'anulada')
    return NextResponse.json(
      { error: 'Esta ficha está anulada; su PDF ya no es válido.' },
      { status: 410 },
    );

  const ruta = ficha.pdf_url as string;
  const admin = crearClienteAdmin();
  const { data: archivo, error } = await admin.storage
    .from('fichas')
    .download(ruta);
  if (error || !archivo)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  return new NextResponse(await archivo.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ruta.split('/').pop()}"`,
    },
  });
}
