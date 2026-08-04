import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { BotonPdf } from '@/components/ui/BotonPdf';
import { EstadoVacio, IconosVacio } from '@/components/ui/EstadoVacio';
import { formatearMonto, type Moneda } from '@/lib/calculos';
import { BotonNuevaOda } from '@/components/orden-proveedor/BotonNuevaOda';
import { CeldaFactura } from '@/components/orden-proveedor/CeldaFactura';
import {
  ETIQUETA_TIPO_PROVEEDOR,
  TIPOS_PROVEEDOR_ODA,
  textoMinimo,
  type TipoProveedorOda,
} from '@/config/oda-proveedores';

// Órdenes de adquisición para el gasto propio de la oficina: suscripciones,
// corresponsales, servicios. No cuelgan de ninguna ficha ni cotización.
//
// La tabla NO repite las columnas de las ODA de proyecto. Ahí hay una columna
// COT porque toda orden viene de una cotización; acá no existe tal cosa, y una
// columna con guiones en todas las filas solo ocupa espacio. En su lugar va el
// tipo de proveedor, que es el dato por el que se filtra este gasto.

const ESTADOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitidas' },
  { valor: 'anulada', etiqueta: 'Anuladas' },
] as const;

const MAX_FILAS = 100;

export default async function PaginaOrdenesProveedores({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; q?: string }>;
}) {
  await exigirRol(['admin', 'gerencia']);

  const params = await searchParams;
  const estado = ESTADOS.some((e) => e.valor === params.estado)
    ? (params.estado ?? '')
    : '';
  const tipo = (TIPOS_PROVEEDOR_ODA as readonly string[]).includes(params.tipo ?? '')
    ? (params.tipo as TipoProveedorOda)
    : '';
  const buscado = (params.q ?? '').trim().slice(0, 80);
  // Los caracteres que PostgREST usa como separadores dentro de `or(...)`
  // romperían la consulta si llegan desde el buscador.
  const qSeguro = buscado.replace(/[,()*%]/g, ' ').trim();

  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from('ordenes_proveedores')
    .select(
      `id, codigo, estado, tipo_proveedor, razon_social, nombre_comercial,
       monto, moneda, pdf_url, updated_at,
       factura_numero, factura_recibida_en`,
    )
    .order('updated_at', { ascending: false })
    .limit(MAX_FILAS);

  if (estado) consulta = consulta.eq('estado', estado);
  if (tipo) consulta = consulta.eq('tipo_proveedor', tipo);
  if (qSeguro)
    consulta = consulta.or(
      `razon_social.ilike.*${qSeguro}*,nombre_comercial.ilike.*${qSeguro}*,` +
        `codigo.ilike.*${qSeguro}*`,
    );

  const { data } = await consulta;

  const filas = (data ?? []).map((o) => ({
    id: o.id as string,
    codigo: o.codigo as string,
    proveedor:
      (o.razon_social as string) || (o.nombre_comercial as string) || '—',
    tipo: ETIQUETA_TIPO_PROVEEDOR[o.tipo_proveedor as TipoProveedorOda] ?? '—',
    monto: formatearMonto(Number(o.monto) || 0, o.moneda as Moneda),
    estado: o.estado as string,
    pdfHref: o.pdf_url ? `/ordenes/proveedores/${o.id as string}/pdf` : null,
    actualizada: new Date(o.updated_at as string).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Lima',
    }),
    facturaNumero: (o.factura_numero as string) ?? '',
    facturaRecibidaEn: (o.factura_recibida_en as string) ?? null,
  }));

  // Conserva los demás filtros al cambiar uno: quien filtró por Suscripciones y
  // luego pulsa "Emitidas" espera seguir viendo solo suscripciones.
  const url = (cambio: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { estado, tipo, q: buscado, ...cambio };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/ordenes/proveedores?${q}` : '/ordenes/proveedores';
  };

  const hayFiltro = Boolean(estado || tipo || buscado);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Órdenes a proveedores</h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            Gasto propio de la oficina · se emiten desde {textoMinimo('PEN')} o{' '}
            {textoMinimo('USD')} (sin IGV)
          </p>
        </div>
        <BotonNuevaOda />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <Link
              key={e.valor}
              href={url({ estado: e.valor })}
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

        <form action="/ordenes/proveedores" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <input
            type="search"
            name="q"
            defaultValue={buscado}
            placeholder="Buscar por proveedor u ODA…"
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

      {/* Filtro por tipo de proveedor: la razón de ser de esta pantalla es
          poder ver en qué se va el gasto de oficina, por rubro. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wide text-tinta-tenue">
          Tipo de proveedor
        </span>
        <Link
          href={url({ tipo: '' })}
          className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
            tipo === ''
              ? 'bg-tinta text-white'
              : 'border border-linea bg-white text-tinta-suave hover:bg-superficie'
          }`}
        >
          Todos
        </Link>
        {TIPOS_PROVEEDOR_ODA.map((t) => (
          <Link
            key={t}
            href={url({ tipo: t })}
            className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
              tipo === t
                ? 'bg-tinta text-white'
                : 'border border-linea bg-white text-tinta-suave hover:bg-superficie'
            }`}
          >
            {ETIQUETA_TIPO_PROVEEDOR[t]}
          </Link>
        ))}
      </div>

      {buscado && (
        <div className="mb-4 flex items-center gap-2 text-[12.5px] text-tinta-suave">
          <span>
            Coincidencias con «<b>{buscado}</b>»
          </span>
          <Link
            href={url({ q: '' })}
            className="font-semibold text-petroleo-oscuro hover:underline"
          >
            Quitar búsqueda
          </Link>
        </div>
      )}

      {filas.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="bg-superficie text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
                  <th className="px-5 py-3 font-semibold">Código ODA</th>
                  <th className="px-5 py-3 font-semibold">Proveedor</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 text-right font-semibold">Monto (sin IGV)</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">PDF</th>
                  <th className="px-5 py-3 font-semibold">Actualizada</th>
                  <th className="px-5 py-3 font-semibold">Factura del proveedor</th>
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
                        href={`/ordenes/proveedores/${f.id}`}
                        className="text-petroleo-oscuro hover:underline"
                      >
                        {f.codigo}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{f.proveedor}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-superficie px-2 py-1 text-[11.5px] font-semibold text-tinta-suave">
                        {f.tipo}
                      </span>
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
                    <td className="px-5 py-2 align-top">
                      <CeldaFactura
                        ordenId={f.id}
                        emitida={f.estado === 'emitida'}
                        numeroInicial={f.facturaNumero}
                        fechaInicial={f.facturaRecibidaEn}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EstadoVacio
          icono={hayFiltro ? IconosVacio.busqueda : IconosVacio.carrito}
          titulo={hayFiltro ? 'Sin coincidencias' : 'Aún no hay órdenes a proveedores'}
          descripcion={
            hayFiltro
              ? 'Ninguna orden coincide con el filtro. Prueba con otros términos.'
              : 'Estas órdenes se crean desde cero con «+ Nueva ODA», para el gasto propio de la oficina.'
          }
        />
      )}

      {filas.length === MAX_FILAS && (
        <p className="mt-3 text-center text-[12px] text-tinta-tenue">
          Se muestran las {MAX_FILAS} más recientes. Afina la búsqueda para ver otras.
        </p>
      )}
    </div>
  );
}
