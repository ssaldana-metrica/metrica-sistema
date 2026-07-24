import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { cerrarSesion } from '@/actions/auth';

// Selector de sistemas: la ventana principal tras iniciar sesión. Desde aquí se
// entra a cada sistema del ecosistema Métrica. El sistema de Cotizaciones vive
// en el grupo (app); Automatizaciones y el resto se irán sumando.
export default async function Inicio() {
  const sesion = await obtenerSesion();

  // Sin sesión válida: distingue "aún sin rol" (elige) de "dado de baja".
  if (!sesion) {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) redirect('/login');
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
  const nombre = usuario.nombre.split(' ')[0];

  return (
    <main className="mx-auto w-full max-w-[860px] px-6 py-12">
      {/* Encabezado */}
      <header className="mb-11 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Image
            src="/marca/logo-metrica.png"
            alt="Métrica"
            width={734}
            height={372}
            priority
            className="h-[34px] w-auto"
          />
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.22em] text-tinta-tenue">
            Sistema Operativo
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-petroleo text-[14px] font-bold text-white">
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{usuario.nombre}</div>
            <div className="font-mono text-[10.5px] text-tinta-tenue">
              {usuario.rol}
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              title="Cerrar sesión"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-linea bg-white text-tinta-suave transition hover:bg-superficie"
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
        </div>
      </header>

      {/* Saludo */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight">Hola, {nombre}</h1>
        <p className="mt-1 text-[14px] text-tinta-suave">
          Elige a dónde quieres entrar.
        </p>
      </div>

      {/* Rejilla de sistemas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaSistema
          href="/panel"
          etiqueta="Disponible"
          titulo="Sistema de Cotizaciones"
          descripcion="Cotizaciones, aprobaciones, órdenes de adquisición y fichas de apertura."
          icono={
            <>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </>
          }
        />
        <TarjetaSistema
          href="/automatizaciones"
          etiqueta="Nuevo"
          etiquetaAcento
          titulo="Automatizaciones"
          descripcion="Tareas que corren solas y avisan por correo. Empieza con el monitor de normas legales de El Peruano."
          icono={<path d="M13 2 3 14h9l-1 8 10-12h-9z" />}
        />
        <TarjetaProximamente
          etiqueta="Próximamente"
          titulo="Recursos Humanos"
          descripcion="Gestión del equipo y los procesos internos de Métrica."
          nota="En camino"
          icono={
            <>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </>
          }
        />
        <TarjetaProximamente
          etiqueta="En construcción"
          titulo="Nuevos sistemas"
          descripcion="El ecosistema seguirá creciendo. Aquí entrarán las próximas herramientas del equipo."
          nota="Reservado"
          icono={
            <>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <path d="M17.5 14.5v6M14.5 17.5h6" />
            </>
          }
        />
      </div>

      <div className="mt-11 text-center font-mono text-[11px] tracking-wide text-tinta-tenue">
        métrica · comunicación estratégica
      </div>
    </main>
  );
}

function IconoCaja({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

function TarjetaSistema({
  href,
  etiqueta,
  etiquetaAcento,
  titulo,
  descripcion,
  icono,
}: {
  href: string;
  etiqueta: string;
  etiquetaAcento?: boolean;
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[172px] flex-col rounded-2xl border border-linea bg-white p-6 shadow-tarjeta transition hover:-translate-y-0.5 hover:border-petroleo/25 hover:shadow-flotante"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-superficie text-tinta">
          <IconoCaja>{icono}</IconoCaja>
        </div>
        <span
          className={`pt-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
            etiquetaAcento ? 'text-terracota' : 'text-tinta-tenue'
          }`}
        >
          {etiqueta}
        </span>
      </div>
      <h2 className="mb-1.5 text-[16px] font-bold tracking-tight">{titulo}</h2>
      <p className="text-[12.5px] leading-relaxed text-tinta-suave">
        {descripcion}
      </p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[12.5px] font-semibold text-tinta">
        Entrar
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="h-3.5 w-3.5 transition group-hover:translate-x-1"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

function TarjetaProximamente({
  etiqueta,
  titulo,
  descripcion,
  nota,
  icono,
}: {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  nota: string;
  icono: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[172px] flex-col rounded-2xl border border-dashed border-linea p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-linea text-tinta-tenue">
          <IconoCaja>{icono}</IconoCaja>
        </div>
        <span className="pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-tinta-tenue">
          {etiqueta}
        </span>
      </div>
      <h2 className="mb-1.5 text-[16px] font-bold tracking-tight text-tinta-suave">
        {titulo}
      </h2>
      <p className="text-[12.5px] leading-relaxed text-tinta-tenue">
        {descripcion}
      </p>
      <span className="mt-auto pt-4 text-[12.5px] font-medium text-tinta-tenue">
        {nota}
      </span>
    </div>
  );
}
