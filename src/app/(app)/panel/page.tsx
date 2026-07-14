import Link from 'next/link';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { BotonPdf } from '@/components/ui/BotonPdf';

export default async function Panel() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const { usuario } = sesion;
  const esAdmin = usuario.rol === 'admin' || usuario.rol === 'gerencia';

  const supabase = await crearClienteServidor();
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();

  // El RLS acota solo: un ejecutivo cuenta lo suyo; admin/gerencia, todo.
  const [mes, pendientes, disponibles, recientes] = await Promise.all([
    supabase
      .from('cotizaciones')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', inicioMes),
    supabase
      .from('cotizaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    supabase
      .from('banco_codigos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'disponible')
      .eq('anio', ahora.getFullYear()),
    supabase
      .from('cotizaciones')
      .select(
        'id, codigo, proyecto, estado, pdf_url, cliente:clientes(nombre_comercial), ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre)',
      )
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-bold tracking-tight">
          Hola, {usuario.nombre.split(' ')[0]}
        </h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          {esAdmin
            ? 'Resumen operativo de toda la agencia'
            : 'Resumen de tus cotizaciones'}
        </p>
      </div>

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          etiqueta="Cotizaciones del mes"
          valor={String(mes.count ?? 0)}
        />
        <Stat
          etiqueta="Pendientes de aprobar"
          valor={String(pendientes.count ?? 0)}
          color={pendientes.count ? 'text-ambar' : undefined}
        />
        <Stat
          etiqueta="Códigos disponibles"
          valor={String(disponibles.count ?? 0)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
        <div className="flex items-center justify-between border-b border-linea-suave px-5 py-4">
          <h2 className="text-[14.5px] font-bold">Actividad reciente</h2>
          <Link
            href="/cotizaciones/nueva"
            className="rounded-lg bg-petroleo px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro"
          >
            + Nueva cotización
          </Link>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-superficie text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="px-5 py-3 font-semibold">Código</th>
              <th className="px-5 py-3 font-semibold">Cliente</th>
              <th className="px-5 py-3 font-semibold">Proyecto</th>
              <th className="px-5 py-3 font-semibold">Ejecutivo</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3 font-semibold">PDF</th>
            </tr>
          </thead>
          <tbody>
            {(recientes.data ?? []).map((c) => (
              <tr
                key={c.id as string}
                className="border-t border-linea-suave text-[13px] transition hover:bg-superficie"
              >
                <td className="px-5 py-3 font-mono text-[12.5px] font-semibold">
                  <Link
                    href={`/cotizaciones/${c.id as string}`}
                    className="text-petroleo-oscuro hover:underline"
                  >
                    {c.codigo as string}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  {uno(c.cliente as { nombre_comercial: string }[] | null)
                    ?.nombre_comercial ?? '—'}
                </td>
                <td className="px-5 py-3">{(c.proyecto as string) || '—'}</td>
                <td className="px-5 py-3">
                  {uno(c.ejecutivo as { nombre: string }[] | null)?.nombre ??
                    '—'}
                </td>
                <td className="px-5 py-3">
                  <BadgeEstado estado={c.estado as string} />
                </td>
                <td className="px-5 py-3">
                  <BotonPdf
                    href={c.pdf_url ? `/cotizaciones/${c.id as string}/pdf` : null}
                  />
                </td>
              </tr>
            ))}
            {(recientes.data ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-[13px] text-tinta-tenue"
                >
                  Aún no hay cotizaciones. Crea la primera con “+ Nueva
                  cotización”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-linea bg-white px-5 py-4 shadow-tarjeta">
      <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-tinta-tenue">
        {etiqueta}
      </div>
      <div className={`font-mono text-[28px] font-bold tracking-tight ${color ?? ''}`}>
        {valor}
      </div>
    </div>
  );
}
