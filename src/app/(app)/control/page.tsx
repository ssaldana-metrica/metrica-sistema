import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';

// Estado del proceso (cotización → ficha → ODA). Se DERIVA al leer, no se
// guarda. Solo de estado, nunca financiero.
//  - anulado:   la ficha está anulada (cascada).
//  - apertura:  ficha en proceso (recién creada).
//  - en_proceso: ficha lista del ejecutivo; o completa pero sin todas sus ODA
//                emitidas (o sin ninguna ODA todavía).
//  - cerrado:   ficha completa Y tiene ODA y todas están emitidas.
type EstadoProc = 'apertura' | 'en_proceso' | 'cerrado' | 'anulado';

function estadoProceso(
  estadoFicha: string,
  odas: { estado: string }[],
): EstadoProc {
  if (estadoFicha === 'anulada') return 'anulado';
  if (estadoFicha === 'en_proceso') return 'apertura';
  if (estadoFicha === 'lista_ejecutivo') return 'en_proceso';
  // completa:
  if (odas.length > 0 && odas.every((o) => o.estado === 'emitida'))
    return 'cerrado';
  return 'en_proceso';
}

const ESTILO_PROC: Record<EstadoProc, { clase: string; etiqueta: string }> = {
  apertura: { clase: 'bg-ambar-fondo text-ambar', etiqueta: 'Apertura' },
  en_proceso: { clase: 'bg-azul-fondo text-azul', etiqueta: 'En proceso' },
  cerrado: { clase: 'bg-verde-fondo text-verde', etiqueta: 'Cerrado' },
  anulado: { clase: 'bg-rojo-fondo text-rojo', etiqueta: 'Anulado' },
};

const FILTROS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'apertura', etiqueta: 'Apertura' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'cerrado', etiqueta: 'Cerrados' },
  { valor: 'anulado', etiqueta: 'Anulados' },
] as const;

const fechaCorta = (iso: string | null) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    : '—';

export default async function PaginaControl({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await exigirRol(['admin', 'gerencia']);

  const params = await searchParams;
  const filtro = FILTROS.some((f) => f.valor === params.estado)
    ? (params.estado ?? '')
    : '';
  const buscado = (params.q ?? '').trim().slice(0, 80).toLowerCase();

  const supabase = await crearClienteServidor();
  const [{ data: fichas }, { data: ordenes }, { data: controles }] =
    await Promise.all([
      supabase
        .from('fichas_apertura')
        .select(
          `id, codigo, estado, cliente_nombre, politica_pago, inicio_acciones,
           fin_acciones,
           cotizacion:cotizaciones!inner(codigo, proyecto),
           proveedores:ficha_proveedores(id, orden, agencia, influencer_proveedor)`,
        )
        .order('codigo', { ascending: false }),
      supabase
        .from('ordenes_adquisicion')
        .select('ficha_id, ficha_proveedor_id, codigo, estado'),
      supabase
        .from('control_proceso')
        .select(
          'ficha_proveedor_id, n_contrato, factura_proveedor, oc_os_cliente, factura_cliente, fecha_facturacion, fecha_cobro',
        ),
    ]);

  // Índices por proveedor.
  const odaDe = new Map<string, { codigo: string; estado: string }>();
  const odasDeFicha = new Map<string, { estado: string }[]>();
  for (const o of ordenes ?? []) {
    odaDe.set(o.ficha_proveedor_id as string, {
      codigo: o.codigo as string,
      estado: o.estado as string,
    });
    const lista = odasDeFicha.get(o.ficha_id as string) ?? [];
    lista.push({ estado: o.estado as string });
    odasDeFicha.set(o.ficha_id as string, lista);
  }
  const controlDe = new Map<string, Record<string, unknown>>();
  for (const c of controles ?? [])
    controlDe.set(c.ficha_proveedor_id as string, c);

  // Procesos (uno por ficha), con sus filas (una por proveedor).
  type Proceso = {
    fichaId: string;
    estado: EstadoProc;
    codigoFA: string;
    codigoCOT: string;
    cliente: string;
    politica: string;
    proyecto: string;
    inicio: string | null;
    fin: string | null;
    filas: {
      provId: string;
      agencia: string;
      influencer: string;
      nOda: string;
      ctrl: Record<string, unknown> | undefined;
    }[];
  };

  const procesos: Proceso[] = (fichas ?? []).map((f) => {
    const cot = uno(
      f.cotizacion as { codigo: string; proyecto: string }[] | null,
    );
    const provs = ((f.proveedores as unknown[]) ?? [])
      .map((p) => p as Record<string, unknown>)
      .sort((a, b) => (a.orden as number) - (b.orden as number));
    return {
      fichaId: f.id as string,
      estado: estadoProceso(
        f.estado as string,
        odasDeFicha.get(f.id as string) ?? [],
      ),
      codigoFA: f.codigo as string,
      codigoCOT: cot?.codigo ?? '—',
      cliente: (f.cliente_nombre as string) || '—',
      politica: (f.politica_pago as string) || '—',
      proyecto: cot?.proyecto || '—',
      inicio: (f.inicio_acciones as string | null) ?? null,
      fin: (f.fin_acciones as string | null) ?? null,
      filas: provs.map((p) => ({
        provId: p.id as string,
        agencia: (p.agencia as string) || '',
        influencer: (p.influencer_proveedor as string) || '',
        nOda: odaDe.get(p.id as string)?.codigo ?? '—',
        ctrl: controlDe.get(p.id as string),
      })),
    };
  });

  // Filtros: por estado del proceso y búsqueda por cliente/proyecto/código.
  const visibles = procesos.filter((p) => {
    if (filtro && p.estado !== filtro) return false;
    if (buscado) {
      const heno = `${p.cliente} ${p.proyecto} ${p.codigoFA} ${p.codigoCOT}`.toLowerCase();
      if (!heno.includes(buscado)) return false;
    }
    return true;
  });

  const urlFiltro = (valor: string) => {
    const sp = new URLSearchParams();
    if (valor) sp.set('estado', valor);
    if (params.q) sp.set('q', params.q);
    const q = sp.toString();
    return q ? `/control?${q}` : '/control';
  };

  const thIzq = 'px-3 py-2.5 font-semibold whitespace-nowrap';
  const thDer = 'px-3 py-2.5 font-semibold whitespace-nowrap';
  const td = 'px-3 py-2.5 align-top';
  const bordeZona = 'border-l-2 border-linea';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">Tabla de control</h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          Estado de cada proceso (cotización → ficha → ODA) y control de
          administración. Una fila por proveedor.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={urlFiltro(f.valor)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                filtro === f.valor
                  ? 'bg-petroleo text-white'
                  : 'border border-linea bg-white text-tinta-suave hover:bg-superficie'
              }`}
            >
              {f.etiqueta}
            </Link>
          ))}
        </div>
        <form action="/control" className="ml-auto flex items-center gap-2">
          {filtro && <input type="hidden" name="estado" value={filtro} />}
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Buscar por cliente, proyecto o código…"
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

      <div className="overflow-x-auto rounded-xl border border-linea bg-white shadow-tarjeta">
        <table className="w-full min-w-[1400px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-superficie text-left uppercase tracking-wide text-tinta-tenue text-[10.5px]">
              {/* Zona izquierda: ficha (solo lectura) */}
              <th className={thIzq}>Estado</th>
              <th className={thIzq}>N° Ficha</th>
              <th className={thIzq}>Cliente</th>
              <th className={thIzq}>Política de pago</th>
              <th className={thIzq}>Proyecto</th>
              <th className={thIzq}>Agencia</th>
              <th className={thIzq}>Influencer</th>
              <th className={thIzq}>Inicio</th>
              <th className={thIzq}>Término</th>
              {/* Zona derecha: administración */}
              <th className={`${thDer} ${bordeZona}`}>N° Contrato</th>
              <th className={thDer}>N° ODA</th>
              <th className={thDer}>Factura prov.</th>
              <th className={thDer}>OC/OS cliente</th>
              <th className={thDer}>Factura cliente</th>
              <th className={thDer}>F. facturación</th>
              <th className={thDer}>F. cobro</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const e = ESTILO_PROC[p.estado];
              const filas = p.filas.length
                ? p.filas
                : [
                    {
                      provId: `${p.fichaId}-vacio`,
                      agencia: '',
                      influencer: '',
                      nOda: '—',
                      ctrl: undefined,
                    },
                  ];
              return filas.map((fila, i) => {
                const primero = i === 0;
                const c = fila.ctrl;
                return (
                  <tr
                    key={fila.provId}
                    className={`text-tinta-suave ${primero ? 'border-t-2 border-linea' : 'border-t border-linea-suave'}`}
                  >
                    {primero ? (
                      <>
                        <td className={td}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${e.clase}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {e.etiqueta}
                          </span>
                        </td>
                        <td className={`${td} font-mono text-[11.5px] font-semibold text-tinta`}>
                          {p.codigoFA}
                        </td>
                        <td className={`${td} text-tinta`}>{p.cliente}</td>
                        <td className={td}>{p.politica}</td>
                        <td className={td}>{p.proyecto}</td>
                      </>
                    ) : (
                      <>
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                        <td className={td} />
                      </>
                    )}
                    <td className={td}>{fila.agencia || '—'}</td>
                    <td className={td}>{fila.influencer || '—'}</td>
                    <td className={td}>{primero ? fechaCorta(p.inicio) : ''}</td>
                    <td className={td}>{primero ? fechaCorta(p.fin) : ''}</td>
                    {/* Zona derecha (Bloque 3 la vuelve editable) */}
                    <td className={`${td} ${bordeZona}`}>
                      {(c?.n_contrato as string) || '—'}
                    </td>
                    <td className={`${td} font-mono text-[11.5px]`}>
                      {fila.nOda}
                    </td>
                    <td className={td}>{(c?.factura_proveedor as string) || '—'}</td>
                    <td className={td}>{(c?.oc_os_cliente as string) || '—'}</td>
                    <td className={td}>{(c?.factura_cliente as string) || '—'}</td>
                    <td className={td}>
                      {fechaCorta((c?.fecha_facturacion as string) ?? null)}
                    </td>
                    <td className={td}>
                      {fechaCorta((c?.fecha_cobro as string) ?? null)}
                    </td>
                  </tr>
                );
              });
            })}
            {visibles.length === 0 && (
              <tr>
                <td
                  colSpan={16}
                  className="px-5 py-10 text-center text-[13px] text-tinta-tenue"
                >
                  {buscado || filtro
                    ? 'Ningún proceso coincide con el filtro.'
                    : 'Aún no hay procesos. Se generan al aprobar una cotización (nace su ficha).'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
