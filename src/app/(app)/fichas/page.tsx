import Link from 'next/link';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { BotonPdf } from '@/components/ui/BotonPdf';
import { EstadoVacio, IconosVacio } from '@/components/ui/EstadoVacio';

const ESTADOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'lista_ejecutivo', etiqueta: 'Lista del ejecutivo' },
  { valor: 'completa', etiqueta: 'Completas' },
] as const;

const MAX_FILAS = 100;

// Maestro de fichas de apertura: el RLS acota solo — un ejecutivo ve las de
// sus cotizaciones; admin y gerencia ven todas. Busca por cliente o código.
export default async function PaginaFichas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const esAdmin = ['admin', 'gerencia'].includes(sesion.usuario.rol);

  const params = await searchParams;
  const estado = ESTADOS.some((e) => e.valor === params.estado)
    ? (params.estado ?? '')
    : '';
  const buscado = (params.q ?? '').trim().slice(0, 80);
  // Para el filtro OR de PostgREST quitamos caracteres que rompen la sintaxis.
  const qSeguro = buscado.replace(/[,()*%]/g, ' ').trim();

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from('fichas_apertura')
    .select(
      `id, codigo, estado, cliente_nombre, pdf_url, updated_at,
       cotizacion:cotizaciones!inner(
         codigo, ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre)
       )`,
    )
    .order('updated_at', { ascending: false })
    .limit(MAX_FILAS);
  if (estado) consulta = consulta.eq('estado', estado);
  if (qSeguro)
    consulta = consulta.or(
      `cliente_nombre.ilike.*${qSeguro}*,codigo.ilike.*${qSeguro}*`,
    );
  const { data } = await consulta;

  const filas = (data ?? []).map((f) => {
    const cot = uno(
      f.cotizacion as {
        codigo: string;
        ejecutivo: { nombre: string }[];
      }[] | null,
    );
    return {
      id: f.id as string,
      codigo: f.codigo as string,
      cliente: (f.cliente_nombre as string) || '—',
      cotizacion: cot?.codigo ?? '—',
      ejecutivo: uno(cot?.ejecutivo ?? null)?.nombre ?? '—',
      estado: f.estado as string,
      pdfHref: f.pdf_url ? `/fichas/${f.id as string}/pdf` : null,
      actualizada: new Date(f.updated_at as string).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        timeZone: 'America/Lima',
      }),
    };
  });

  const urlEstado = (valor: string) => {
    const p = new URLSearchParams();
    if (valor) p.set('estado', valor);
    if (buscado) p.set('q', buscado);
    const q = p.toString();
    return q ? `/fichas?${q}` : '/fichas';
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">Fichas de apertura</h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          {esAdmin
            ? 'Todas las fichas de la agencia'
            : 'Las fichas de tus cotizaciones'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <Link
              key={e.valor}
              href={urlEstado(e.valor)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                estado === e.valor
                  ? 'bg-petroleo text-white'
                  : 'border border-linea bg-white text-tinta-suave hover:bg-superficie'
              }`}
            >
              {e.etiqueta}
            </Link>
          ))}
        </div>

        <form action="/fichas" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input
            type="search"
            name="q"
            defaultValue={buscado}
            placeholder="Buscar por cliente o código…"
            className="w-60 rounded-lg border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo"
          />
          <button
            type="submit"
            className="rounded-lg border border-linea bg-white px-3.5 py-2 text-[12.5px] font-semibold transition hover:bg-superficie"
          >
            Buscar
          </button>
        </form>
      </div>

      {buscado && (
        <div className="mb-4 flex items-center gap-2 text-[12.5px] text-tinta-suave">
          <span>
            Coincidencias con «<b>{buscado}</b>»
          </span>
          <Link
            href={estado ? `/fichas?estado=${estado}` : '/fichas'}
            className="font-semibold text-petroleo-oscuro hover:underline"
          >
            Quitar búsqueda
          </Link>
        </div>
      )}

      {filas.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-superficie text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="px-5 py-3 font-semibold">Código</th>
              <th className="px-5 py-3 font-semibold">Cliente</th>
              <th className="px-5 py-3 font-semibold">Cotización</th>
              {esAdmin && (
                <th className="px-5 py-3 font-semibold">Ejecutivo</th>
              )}
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3 font-semibold">PDF</th>
              <th className="px-5 py-3 font-semibold">Actualizada</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className="border-t border-linea-suave text-[13px] transition hover:bg-superficie"
              >
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold">
                  <Link
                    href={`/fichas/${f.id}`}
                    className="text-petroleo-oscuro hover:underline"
                  >
                    {f.codigo}
                  </Link>
                </td>
                <td className="px-5 py-3">{f.cliente}</td>
                <td className="px-5 py-3 font-mono text-[12px] text-tinta-suave">
                  {f.cotizacion}
                </td>
                {esAdmin && <td className="px-5 py-3">{f.ejecutivo}</td>}
                <td className="px-5 py-3">
                  <BadgeEstado estado={f.estado} />
                </td>
                <td className="px-5 py-3">
                  <BotonPdf href={f.pdfHref} />
                </td>
                <td className="px-5 py-3 text-tinta-suave">{f.actualizada}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
      ) : (
        <EstadoVacio
          icono={buscado || estado ? IconosVacio.busqueda : IconosVacio.documento}
          titulo={buscado || estado ? 'Sin coincidencias' : 'Aún no hay fichas'}
          descripcion={
            buscado || estado
              ? 'Ninguna ficha coincide con el filtro. Prueba con otros términos.'
              : 'Las fichas de apertura se crean automáticamente al aprobar una cotización.'
          }
        />
      )}

      {filas.length === MAX_FILAS && (
        <p className="mt-3 text-[12px] text-tinta-tenue">
          Mostrando las {MAX_FILAS} más recientes — usa el buscador o los
          filtros para acotar.
        </p>
      )}
    </div>
  );
}
