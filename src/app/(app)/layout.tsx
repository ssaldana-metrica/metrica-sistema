import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cerrarSesion } from '@/actions/auth';
import { Sidebar, type GrupoNav } from '@/components/shell/Sidebar';

// Candado de la zona protegida: sin sesión válida no se ve nada.
// Cubre también al usuario dado de baja A MITAD de sesión: su login de
// Google sigue vivo, pero su fila en `usuarios` ya no responde (activo=false).
export default async function LayoutProtegido({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesion();

  if (!sesion) {
    const supabase = await crearClienteServidor();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/acceso-denegado?motivo=inactivo');
    redirect('/login');
  }

  const { usuario } = sesion;
  const esAdmin = usuario.rol === 'admin' || usuario.rol === 'gerencia';

  // Contador de pendientes para el badge de Aprobaciones
  let pendientes = 0;
  if (esAdmin) {
    const supabase = await crearClienteServidor();
    const { count } = await supabase
      .from('cotizaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    pendientes = count ?? 0;
  }

  const grupos: GrupoNav[] = [
    {
      titulo: 'Operación',
      items: [
        { href: '/panel', etiqueta: 'Panel', icono: 'panel' },
        { href: '/banco', etiqueta: 'Banco de códigos', icono: 'banco' },
        { href: '/cotizaciones', etiqueta: 'Cotizaciones', icono: 'cotizaciones' },
        { href: '/fichas', etiqueta: 'Fichas de apertura', icono: 'fichas' },
      ],
    },
  ];
  if (esAdmin) {
    grupos.push({
      titulo: 'Administración',
      items: [
        {
          href: '/aprobaciones',
          etiqueta: 'Aprobaciones',
          icono: 'aprobaciones',
          badge: pendientes,
        },
      ],
    });
  }
  if (usuario.rol === 'gerencia') {
    grupos.push({
      titulo: 'Dirección',
      items: [{ href: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios' }],
    });
  }

  return (
    <div className="flex h-screen">
      <Sidebar grupos={grupos} />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-4 border-b border-linea bg-superficie px-8 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-petroleo to-petroleo-oscuro text-[13px] font-bold text-white">
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-semibold">{usuario.nombre}</div>
              <div className="font-mono text-[11px] text-tinta-tenue">
                {usuario.correo}
              </div>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-linea bg-white text-tinta-suave transition hover:bg-crema"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
