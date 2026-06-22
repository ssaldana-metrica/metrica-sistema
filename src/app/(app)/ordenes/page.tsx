import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { BotonPdf } from '@/components/ui/BotonPdf';
import { formatearMonto, type Moneda } from '@/lib/calculos';

const ESTADOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitidas' },
  { valor: 'anulada', etiqueta: 'Anuladas' },
] as const;

const MAX_FILAS = 100;

// Maestro de órdenes de adquisición. Solo admin y gerencia (RLS + rol).
export default async function PaginaOrdenes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await exigirRol(['admin', 'gerencia']);

  const params = await searchParams;
  const estado = ESTADOS.some((e) => e.valor === params.estado)
    ? (params.estado ?? '')
    : '';
  const buscado = (params.q ?? '').trim().slice(0, 80);
  const qSeguro = buscado.replace(/[,()*%]/g, ' ').trim();

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from('ordenes_adquisicion')
    .select(
      `id, codigo, estado, razon_social, nombre_comercial, agencia,
       influencer_proveedor, cotizacion_codigo, monto, moneda, pdf_url, updated_at`,
    )
    .order('updated_at', { ascending: false })
    .limit(MAX_FILAS);
  if (estado) consulta = consulta.eq('estado', estado);
  if (qSeguro)
    consulta = consulta.or(
      `razon_social.ilike.*${qSeguro}*,nombre_comercial.ilike.*${qSeguro}*,` +
        `agencia.ilike.*${qSeguro}*,influencer_proveedor.ilike.*${qSeguro}*,` +
        `codigo.ilike.*${qSeguro}*,cotizacion_codigo.ilike.*${qSeguro}*`,
    );
  const { data } = await consulta;

  const filas = (data ?? []).map((o) => ({
    id: o.id as string,
    codigo: o.codigo as string,
    proveedor:
      (o.razon_social as string) ||
      (o.nombre_comercial as string) ||
      (o.agencia as string) ||
      (o.influencer_proveedor as string) ||
      '—',
    cot: (o.cotizacion_codigo as string) || '—',
    monto: formatearMonto(Number(o.monto) || 0, o.moneda as Moneda),
    estado: o.estado as string,
    pdfHref: o.pdf_url ? `/ordenes/${o.id as string}/pdf` : null,
    actualizada: new Date(o.updated_at as string).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Lima',
    }),
  }));

  const urlEstado = (valor: string) => {
    const p = new URLSearchParams();
    if (valor) p.set('estado', valor);
    if (buscado) p.set('q', buscado);
    const q = p.toString();
    return q ? `/ordenes?${q}` : '/ordenes';
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">
          Órdenes de adquisición
        </h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          Documentos de compra emitidos a proveedores
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

        <form action="/ordenes" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input
            type="search"
            name="q"
            defaultValue={buscado}
            placeholder="Buscar por proveedor, ODA o COT…"
            className="w-64 rounded-lg border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo"
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
            href={estado ? `/ordenes?estado=${estado}` : '/ordenes'}
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
              <th className="px-5 py-3 font-semibold">Código ODA</th>
              <th className="px-5 py-3 font-semibold">Proveedor</th>
              <th className="px-5 py-3 font-semibold">COT</th>
              <th className="px-5 py-3 text-right font-semibold">Monto</th>
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
                    href={`/ordenes/${f.id}`}
                    className="text-petroleo-oscuro hover:underline"
                  >
                    {f.codigo}
                  </Link>
                </td>
                <td className="px-5 py-3">{f.proveedor}</td>
                <td className="px-5 py-3 font-mono text-[12px] text-tinta-suave">
                  {f.cot}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[12.5px]">
                  {f.monto}
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
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px] text-tinta-tenue"
                >
                  {buscado || estado
                    ? 'Ninguna orden coincide con el filtro.'
                    : 'Aún no hay órdenes. Se generan desde una ficha completa.'}
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
