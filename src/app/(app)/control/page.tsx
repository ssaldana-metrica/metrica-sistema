import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { estadoProceso, controlVacio, type EstadoProc } from '@/lib/control';
import {
  TablaControl,
  type ProcesoVista,
} from '@/components/control/TablaControl';

const FILTROS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'apertura', etiqueta: 'Apertura' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'cerrado', etiqueta: 'Cerrados' },
  { valor: 'anulado', etiqueta: 'Anulados' },
] as const;

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

  const odaDe = new Map<string, string>();
  const odasDeFicha = new Map<string, { estado: string }[]>();
  for (const o of ordenes ?? []) {
    odaDe.set(o.ficha_proveedor_id as string, o.codigo as string);
    const lista = odasDeFicha.get(o.ficha_id as string) ?? [];
    lista.push({ estado: o.estado as string });
    odasDeFicha.set(o.ficha_id as string, lista);
  }
  const controlDe = new Map<string, Record<string, unknown>>();
  for (const c of controles ?? [])
    controlDe.set(c.ficha_proveedor_id as string, c);

  const procesos: ProcesoVista[] = (fichas ?? []).map((f) => {
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
      filas: provs.map((p) => {
        const c = controlDe.get(p.id as string);
        return {
          provId: p.id as string,
          fichaId: f.id as string,
          agencia: (p.agencia as string) || '',
          influencer: (p.influencer_proveedor as string) || '',
          nOda: odaDe.get(p.id as string) ?? '—',
          control: c
            ? {
                nContrato: (c.n_contrato as string) ?? '',
                facturaProveedor: (c.factura_proveedor as string) ?? '',
                ocOsCliente: (c.oc_os_cliente as string) ?? '',
                facturaCliente: (c.factura_cliente as string) ?? '',
                fechaFacturacion: (c.fecha_facturacion as string | null) ?? null,
                fechaCobro: (c.fecha_cobro as string | null) ?? null,
              }
            : controlVacio(),
        };
      }),
    };
  });

  const visibles = procesos.filter((p) => {
    if (filtro && p.estado !== (filtro as EstadoProc)) return false;
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

      <TablaControl procesos={visibles} />
    </div>
  );
}
