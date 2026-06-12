import Link from 'next/link';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { BotonPdf } from '@/components/ui/BotonPdf';
import { calcularTotales, formatearMonto, type Moneda } from '@/lib/calculos';

const ESTADOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'observada', etiqueta: 'Observadas' },
  { valor: 'anulada', etiqueta: 'Anuladas' },
] as const;

const MAX_FILAS = 100;

// Maestro de cotizaciones: el RLS acota solo — un ejecutivo ve únicamente
// las suyas; admin y gerencia ven las de toda la agencia.
export default async function PaginaCotizaciones({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; cliente?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const esAdmin = ['admin', 'gerencia'].includes(sesion.usuario.rol);

  const params = await searchParams;
  const estado = ESTADOS.some((e) => e.valor === params.estado)
    ? (params.estado ?? '')
    : '';
  const buscado = (params.cliente ?? '').trim().slice(0, 80);

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from('cotizaciones')
    .select(
      `id, codigo, proyecto, estado, moneda, fee_porcentaje, updated_at, pdf_url,
       cliente:clientes!inner(nombre_comercial),
       ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre),
       items:cotizacion_items(cantidad, precio_unitario)`,
    )
    .order('updated_at', { ascending: false })
    .limit(MAX_FILAS);
  if (estado) consulta = consulta.eq('estado', estado);
  if (buscado)
    consulta = consulta.ilike('cliente.nombre_comercial', `%${buscado}%`);
  const { data } = await consulta;

  const filas = (data ?? []).map((c) => {
    const totales = calcularTotales(
      ((c.items as unknown[]) ?? [])
        .map((i) => i as Record<string, unknown>)
        .map((l) => ({
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precio_unitario),
        })),
      Number(c.fee_porcentaje),
    );
    return {
      id: c.id as string,
      codigo: c.codigo as string,
      proyecto: (c.proyecto as string) || '—',
      estado: c.estado as string,
      cliente:
        uno(c.cliente as { nombre_comercial: string }[] | null)
          ?.nombre_comercial ?? '—',
      ejecutivo:
        uno(c.ejecutivo as { nombre: string }[] | null)?.nombre ?? '—',
      total: formatearMonto(totales.total, c.moneda as Moneda),
      pdfHref: c.pdf_url ? `/cotizaciones/${c.id as string}/pdf` : null,
      actualizada: new Date(c.updated_at as string).toLocaleDateString(
        'es-PE',
        { day: '2-digit', month: 'short', timeZone: 'America/Lima' },
      ),
    };
  });

  // Conserva el otro filtro al cambiar uno (chips mantienen la búsqueda y
  // el buscador mantiene el estado).
  const urlEstado = (valor: string) => {
    const p = new URLSearchParams();
    if (valor) p.set('estado', valor);
    if (buscado) p.set('cliente', buscado);
    const q = p.toString();
    return q ? `/cotizaciones?${q}` : '/cotizaciones';
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">Cotizaciones</h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          {esAdmin
            ? 'Todas las cotizaciones de la agencia'
            : 'Tus cotizaciones'}
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

        <form action="/cotizaciones" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input
            type="search"
            name="cliente"
            defaultValue={buscado}
            placeholder="Buscar por cliente…"
            className="w-56 rounded-lg border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo"
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
            Mostrando clientes que contienen «<b>{buscado}</b>»
          </span>
          <Link
            href={estado ? `/cotizaciones?estado=${estado}` : '/cotizaciones'}
            className="font-semibold text-petroleo-oscuro hover:underline"
          >
            Quitar búsqueda
          </Link>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-superficie text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="px-5 py-3 font-semibold">Código</th>
              <th className="px-5 py-3 font-semibold">Cliente</th>
              <th className="px-5 py-3 font-semibold">Proyecto</th>
              {esAdmin && (
                <th className="px-5 py-3 font-semibold">Ejecutivo</th>
              )}
              <th className="px-5 py-3 text-right font-semibold">Total</th>
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
                    href={`/cotizaciones/${f.id}`}
                    className="text-petroleo-oscuro hover:underline"
                  >
                    {f.codigo}
                  </Link>
                </td>
                <td className="px-5 py-3">{f.cliente}</td>
                <td className="max-w-56 truncate px-5 py-3">{f.proyecto}</td>
                {esAdmin && <td className="px-5 py-3">{f.ejecutivo}</td>}
                <td className="px-5 py-3 text-right font-mono text-[12.5px]">
                  {f.total}
                </td>
                <td className="px-5 py-3">
                  <BadgeEstado estado={f.estado} />
                </td>
                <td className="px-5 py-3">
                  <BotonPdf href={f.pdfHref} />
                </td>
                <td className="px-5 py-3 text-tinta-suave">{f.actualizada}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td
                  colSpan={esAdmin ? 8 : 7}
                  className="px-5 py-10 text-center text-[13px] text-tinta-tenue"
                >
                  {buscado || estado
                    ? 'Ninguna cotización coincide con el filtro.'
                    : 'Aún no hay cotizaciones. Toma un código del banco para empezar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filas.length === MAX_FILAS && (
        <p className="mt-3 text-[12px] text-tinta-tenue">
          Mostrando las {MAX_FILAS} más recientes — usa el buscador o los
          filtros para acotar.
        </p>
      )}
    </div>
  );
}
