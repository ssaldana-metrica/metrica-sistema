import Link from 'next/link';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { RejillaCodigos, type CeldaCodigo } from '@/components/banco/RejillaCodigos';

export default async function PaginaBanco() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const supabase = await crearClienteServidor();
  const anio = new Date().getFullYear();

  const [{ data: codigos }, { data: cotizaciones }] = await Promise.all([
    supabase
      .from('banco_codigos')
      .select('codigo, numero, estado, tomado_en, duenio:usuarios(nombre)')
      .eq('anio', anio)
      .order('numero'),
    // El RLS decide qué cotizaciones puede ver cada quien: un ejecutivo
    // solo recibe detalles de las suyas; admin y gerencia, de todas.
    supabase
      .from('cotizaciones')
      .select(
        'codigo, proyecto, estado, motivo_anulacion, cliente:clientes(nombre_comercial), ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre)',
      ),
  ]);

  const porCodigo = new Map(
    (cotizaciones ?? []).map((c) => [c.codigo as string, c]),
  );

  const celdas: CeldaCodigo[] = (codigos ?? []).map((k) => {
    const cot = porCodigo.get(k.codigo as string);
    const duenio = uno(k.duenio as { nombre: string }[] | null);
    return {
      codigo: k.codigo as string,
      estado: k.estado as CeldaCodigo['estado'],
      tomadoPor: duenio?.nombre ?? null,
      tomadoEn: (k.tomado_en as string | null)
        ? new Date(k.tomado_en as string).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : null,
      cot: cot
        ? {
            proyecto: (cot.proyecto as string) || '—',
            estado: cot.estado as string,
            cliente:
              uno(cot.cliente as { nombre_comercial: string }[] | null)
                ?.nombre_comercial ?? '—',
            ejecutivo:
              uno(cot.ejecutivo as { nombre: string }[] | null)?.nombre ?? '—',
            motivo: (cot.motivo_anulacion as string | null) ?? null,
          }
        : null,
    };
  });

  const disponibles = celdas.filter((c) => c.estado === 'disponible').length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Banco de códigos</h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            Año {anio} · {disponibles} disponibles de {celdas.length}
          </p>
        </div>
        <Link
          href="/cotizaciones/nueva"
          className="flex items-center gap-1.5 rounded-lg bg-petroleo px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva cotización
        </Link>
        <div className="flex gap-4 text-xs text-tinta-suave">
          <span className="flex items-center gap-1.5">
            <span className="h-[11px] w-[11px] rounded border border-dashed border-petroleo bg-petroleo/20" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[11px] w-[11px] rounded bg-azul-fondo" />
            En uso
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[11px] w-[11px] rounded bg-rojo-fondo" />
            Anulado
          </span>
        </div>
      </div>

      <div className="mb-5 flex gap-2.5 rounded-[10px] border border-azul/25 bg-azul-fondo p-3.5 text-[12.5px] text-[#2C5378]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-px h-[17px] w-[17px] shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          El código correlativo se asigna al <b>guardar</b> la cotización (no se
          reserva antes), así el banco no deja huecos. Varios ejecutivos pueden
          cotizar a la vez sin pisarse — nunca se duplica. Un código anulado se
          queda anulado.
        </div>
      </div>

      <RejillaCodigos celdas={celdas} />
    </div>
  );
}
