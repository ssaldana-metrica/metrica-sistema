import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { cerrarSesion } from '@/actions/auth';
import { type GrupoNav } from '@/components/shell/Sidebar';
import { Shell } from '@/components/shell/Shell';
import { SinScrollNumerico } from '@/components/ui/SinScrollNumerico';
import { ToastProvider } from '@/components/ui/Toast';

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
    if (!user?.email) redirect('/login');
    // Distingue "aún sin rol" (elige) de "dado de baja" (denegado).
    const admin = crearClienteAdmin();
    const { data: fila } = await admin
      .from('usuarios')
      .select('activo')
      .eq('correo', user.email.toLowerCase())
      .maybeSingle();
    if (!fila) redirect('/elegir-rol');
    redirect('/acceso-denegado?motivo=inactivo');
  }

  const { usuario } = sesion;
  const esAdmin = usuario.rol === 'admin' || usuario.rol === 'gerencia';

  // ¿Esta persona pidió otro rol y todavía se lo están resolviendo? Se le avisa
  // en todas las pantallas: sin eso ve un menú incompleto y no sabe por qué,
  // y lo natural es pensar que el sistema está roto.
  //
  // El `.neq('rol_solicitado', usuario.rol)` es un seguro contra una franja que
  // miente. Si por lo que sea la solicitud quedó pendiente pero la persona YA
  // tiene el rol que pidió, decirle que espera —y peor, que mientras tanto es
  // ejecutiva— es peor que no decirle nada. Pasó el 4 de agosto y se arregló de
  // raíz en la migración 0036; esto es el cinturón además del tirante.
  const supabaseSolicitud = await crearClienteServidor();
  const { data: solicitudPendiente } = await supabaseSolicitud
    .from('solicitudes_rol')
    .select('rol_solicitado')
    .eq('usuario_id', usuario.id)
    .eq('estado', 'pendiente')
    .neq('rol_solicitado', usuario.rol)
    .maybeSingle();

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
        {
          // Desplegable: no lleva a ninguna parte por sí solo. Son dos mundos
          // distintos —las de proyecto nacen de una ficha, las de proveedores
          // se crean sueltas para el gasto de la casa— y quien entra elige a
          // cuál va, en vez de caer en una por defecto.
          href: '/ordenes',
          etiqueta: 'Órdenes (ODA)',
          icono: 'ordenes',
          sub: [
            // Proyectos se queda en /ordenes, su ruta de siempre: moverla
            // obligaría a tocar ocho referencias repartidas por acciones y
            // componentes de un módulo que funciona. La subcarpeta es de
            // navegación, no de URL.
            { href: '/ordenes', etiqueta: 'Proyectos' },
            { href: '/ordenes/proveedores', etiqueta: 'Proveedores' },
          ],
        },
        { href: '/control', etiqueta: 'Tabla de control', icono: 'control' },
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
    <ToastProvider>
      <SinScrollNumerico />
      <Shell
        aviso={
          solicitudPendiente ? (
            <div className="border-b border-ambar/30 bg-ambar-fondo px-6 py-2.5 text-[12.5px] text-ambar">
              Tu solicitud del rol{' '}
              <strong>
                {solicitudPendiente.rol_solicitado === 'admin'
                  ? 'Administración'
                  : String(solicitudPendiente.rol_solicitado)}
              </strong>{' '}
              está pendiente de aprobación. Mientras tanto puedes trabajar como
              Ejecutivo: cotizar y llenar tus fichas.
            </div>
          ) : null
        }
        grupos={grupos}
        encabezado={
          <>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-petroleo to-petroleo-oscuro text-[13px] font-bold text-white">
                {usuario.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[12.5px] font-semibold">
                  {usuario.nombre}
                </div>
                <div className="hidden font-mono text-[11px] text-tinta-tenue sm:block">
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
          </>
        }
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
