import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';

// Descarga del PDF de una orden. El RLS limita la tabla a admin/gerencia: si la
// consulta no devuelve la orden, tampoco hay PDF para ese usuario.
// El archivo se transmite desde el servidor (no se redirige a una URL firmada
// portadora): el PDF de la ODA lleva datos bancarios del proveedor y ese enlace
// nunca debe quedar en el navegador ni en logs de proxy.
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
    .select('estado, pdf_url')
    .eq('id', id)
    .maybeSingle();

  if (!orden?.pdf_url)
    return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

  // Una orden anulada no se sirve como si siguiera vigente.
  if (orden.estado === 'anulada')
    return NextResponse.json(
      { error: 'Esta orden está anulada; su PDF ya no es válido.' },
      { status: 410 },
    );

  const ruta = orden.pdf_url as string;
  const admin = crearClienteAdmin();
  const { data: archivo, error } = await admin.storage
    .from('ordenes')
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
