import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { PanelMonitor, type EstadoMonitor } from '@/components/automatizaciones/PanelMonitor';
import {
  ListaDestinatarios,
  type DestinatarioFila,
} from '@/components/automatizaciones/ListaDestinatarios';
import {
  ListaTerminos,
  type CuentaConTerminos,
} from '@/components/automatizaciones/ListaTerminos';

// Espacio de Automatizaciones. Vive fuera del grupo (app) para tener su propia
// navegación, no el sidebar de Cotizaciones.
//
// Quién ve qué:
//   Cualquier usuario activo → el estado de la tarea y el historial de
//     corridas. El equipo necesita poder confirmar que esto está funcionando y
//     que el correo salió, sin depender de preguntarle a nadie.
//   Solo gerencia → administrar: prender y apagar, correr a mano, y editar las
//     listas de destinatarios y de términos vigilados.
//
// Esa frontera la sostiene el RLS (migraciones 0022 y 0024). Acá los bloques de
// administración simplemente no se piden ni se dibujan.

export const dynamic = 'force-dynamic'; // el estado cambia por fuera de la app

const CLAVE = 'normas_legales';

export default async function Automatizaciones() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/'); // el selector resuelve login / rol / baja

  const puedeAdministrar = sesion.usuario.rol === 'gerencia';
  const supabase = await crearClienteServidor();

  const [{ data: automatizacion }, { data: corridas }] = await Promise.all([
    supabase
      .from('automatizaciones')
      .select('nombre, descripcion, activa, modo_prueba, ultima_corrida_en, ultimo_estado, ultimo_detalle')
      .eq('clave', CLAVE)
      .maybeSingle(),
    supabase
      .from('automatizacion_ejecuciones')
      .select('id, inicio, fin, estado, normas_encontradas, normas_relevantes, error_detalle')
      .eq('automatizacion', CLAVE)
      .order('inicio', { ascending: false })
      .limit(15),
  ]);

  // Estas dos consultas solo devuelven filas para gerencia (el RLS las bloquea
  // para el resto), así que ni se lanzan si no hace falta.
  const [destinatarios, cuentasConTerminos] = puedeAdministrar
    ? await Promise.all([leerDestinatarios(supabase), leerTerminos(supabase)])
    : [[], []];

  const estado: EstadoMonitor | null = automatizacion
    ? {
        nombre: automatizacion.nombre as string,
        descripcion: automatizacion.descripcion as string,
        activa: automatizacion.activa as boolean,
        modoPrueba: automatizacion.modo_prueba as boolean,
        ultimaCorridaEn: (automatizacion.ultima_corrida_en as string) ?? null,
        ultimoEstado: (automatizacion.ultimo_estado as string) ?? null,
        ultimoDetalle: (automatizacion.ultimo_detalle as string) ?? '',
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-[860px] px-6 py-12">
      <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Sistemas
        </Link>
      </header>

      {estado ? (
        <div className="space-y-6">
          <PanelMonitor estado={estado} puedeAdministrar={puedeAdministrar} />

          <HistorialCorridas corridas={corridas ?? []} />

          {puedeAdministrar && (
            <>
              <ListaDestinatarios
                destinatarios={destinatarios}
                cuentas={cuentasConTerminos.map((c) => ({ id: c.id, nombre: c.nombre }))}
              />
              <ListaTerminos cuentas={cuentasConTerminos} />
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-linea bg-white p-10 text-center shadow-tarjeta">
          <h1 className="text-[15px] font-bold">No hay automatizaciones configuradas</h1>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-tinta-suave">
            Falta la fila del monitor en la base de datos. Revisa que la migración 0022 se
            haya aplicado.
          </p>
        </div>
      )}

      <div className="mt-11 text-center font-mono text-[11px] tracking-wide text-tinta-tenue">
        métrica · comunicación estratégica
      </div>
    </main>
  );
}

// ── Historial ───────────────────────────────────────────────────────────────

type Corrida = {
  id: string;
  inicio: string;
  fin: string | null;
  estado: string;
  normas_encontradas: number;
  normas_relevantes: number;
  error_detalle: string;
};

function HistorialCorridas({ corridas }: { corridas: Corrida[] }) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
      <h2 className="text-[15px] font-bold tracking-tight">Historial de corridas</h2>
      <p className="mt-1 text-[12.5px] text-tinta-suave">
        Las últimas 15. Lo escribe el propio proceso automático: nadie puede editarlo
        desde el sistema, y por eso sirve como prueba de que la tarea corrió.
      </p>

      {corridas.length === 0 ? (
        <p className="mt-4 rounded-xl bg-superficie px-4 py-5 text-center text-[12.5px] text-tinta-suave">
          Todavía no hay corridas registradas.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
                <th className="pb-2 font-semibold">Cuándo</th>
                <th className="pb-2 font-semibold">Resultado</th>
                <th className="pb-2 text-right font-semibold">Revisadas</th>
                <th className="pb-2 text-right font-semibold">Relevantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {corridas.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {new Date(c.inicio).toLocaleString('es-PE', {
                      timeZone: 'America/Lima',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <EtiquetaCorrida corrida={c} />
                    {c.error_detalle && c.estado === 'error' && (
                      <div className="mt-1 max-w-md text-[11.5px] leading-relaxed text-tinta-suave">
                        {c.error_detalle}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-tinta-suave">
                    {c.normas_encontradas}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">
                    {c.normas_relevantes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EtiquetaCorrida({ corrida }: { corrida: Corrida }) {
  // `fin` en nulo con la fila ya creada significa que empezó y nunca terminó:
  // el proceso se cayó o se quedó sin tiempo. Se distingue del error normal
  // porque en ese caso ni siquiera hubo ocasión de anotar el motivo.
  if (!corrida.fin) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-fondo px-2.5 py-[3px] text-[11.5px] font-semibold text-ambar">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Interrumpida
      </span>
    );
  }

  const estilos: Record<string, { clase: string; texto: string }> = {
    ok: { clase: 'bg-verde-fondo text-verde', texto: 'Aviso enviado' },
    sin_novedades: { clase: 'bg-pizarra-fondo text-pizarra', texto: 'Sin novedades' },
    error: { clase: 'bg-rojo-fondo text-rojo', texto: 'Con error' },
  };
  const e = estilos[corrida.estado] ?? estilos.error;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${e.clase}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {e.texto}
    </span>
  );
}

// ── Lecturas de administración ──────────────────────────────────────────────

type Supa = Awaited<ReturnType<typeof crearClienteServidor>>;

async function leerDestinatarios(supabase: Supa): Promise<DestinatarioFila[]> {
  const { data } = await supabase
    .from('normas_legales_destinatarios')
    .select('id, correo, nombre, activo, normas_legales_cuentas ( nombre )')
    .order('activo', { ascending: false })
    .order('correo');

  return (data ?? []).map((d) => ({
    id: d.id as string,
    correo: d.correo as string,
    nombre: (d.nombre as string) ?? null,
    activo: d.activo as boolean,
    cuenta: (d.normas_legales_cuentas as unknown as { nombre: string } | null)?.nombre ?? null,
  }));
}

async function leerTerminos(supabase: Supa): Promise<CuentaConTerminos[]> {
  const [{ data: cuentas }, { data: terminos }] = await Promise.all([
    supabase.from('normas_legales_cuentas').select('id, nombre').eq('activa', true).order('nombre'),
    supabase
      .from('normas_legales_terminos')
      .select('id, cuenta_id, termino, sinonimos')
      .eq('activo', true)
      .order('termino'),
  ]);

  return (cuentas ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    terminos: (terminos ?? [])
      .filter((t) => t.cuenta_id === c.id)
      .map((t) => ({
        id: t.id as string,
        termino: t.termino as string,
        sinonimos: (t.sinonimos as string[] | null) ?? [],
      })),
  }));
}
