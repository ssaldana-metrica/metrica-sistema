import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';

// Espacio de Automatizaciones (placeholder por ahora). Vive fuera del grupo
// (app) para tener su propia navegación, no el sidebar de Cotizaciones. Aquí se
// construirá el índice de automatizaciones (monitor de normas legales y las que
// se sumen), cada una con su interruptor de encendido y su correo de avisos.
export default async function Automatizaciones() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/'); // el selector resuelve login / rol / baja
  // Solo gerencia administra las automatizaciones: prende y apaga cada tarea y
  // decide quién recibe los avisos. El resto de la empresa no entra aquí —
  // únicamente recibe los correos, para lo cual no hace falta cuenta ni acceso.
  if (sesion.usuario.rol !== 'gerencia') redirect('/');

  return (
    <main className="mx-auto w-full max-w-[860px] px-6 py-12">
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
            Automatizaciones
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-linea bg-white px-3.5 py-2 text-[12.5px] font-semibold text-tinta-suave transition hover:bg-superficie"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="h-3.5 w-3.5"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Sistemas
        </Link>
      </header>

      <div className="rounded-2xl border border-linea bg-white p-10 text-center shadow-tarjeta">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-superficie text-tinta">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-7 w-7"
          >
            <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
          </svg>
        </div>
        <h1 className="text-[19px] font-bold tracking-tight">
          Estamos construyendo Automatizaciones
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-tinta-suave">
          Aquí vivirán las tareas que corren solas y avisan por correo — la
          primera será el monitor de normas legales de El Peruano. Cada una
          tendrá su interruptor para prenderla o apagarla y el correo al que
          llegan los avisos.
        </p>
        <span className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-terracota">
          Muy pronto
        </span>
      </div>

      <div className="mt-11 text-center font-mono text-[11px] tracking-wide text-tinta-tenue">
        métrica · comunicación estratégica
      </div>
    </main>
  );
}
