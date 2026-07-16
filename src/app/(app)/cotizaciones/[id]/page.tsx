import { notFound } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import {
  FormularioCotizacion,
  type CotizacionInicial,
} from '@/components/cotizacion/FormularioCotizacion';
import {
  VistaCotizacion,
  type CotizacionDetalle,
} from '@/components/cotizacion/VistaCotizacion';
import { BotonReabrirCotizacion } from '@/components/cotizacion/BotonReabrirCotizacion';
import type { Moneda } from '@/lib/calculos';

// Detalle de una cotización: editable para su ejecutivo mientras esté en
// borrador u observada; solo lectura en cualquier otro caso.
export default async function DetalleCotizacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviada?: string; guardada?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const { id } = await params;
  const { enviada, guardada } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data: cot } = await supabase
    .from('cotizaciones')
    .select(
      `id, codigo, estado, proyecto, moneda, fee_porcentaje, fecha_envio_cliente, nota,
       cliente_id, ejecutivo_id, observacion_admin, fecha_aprobacion, motivo_anulacion, pdf_url,
       cliente:clientes(nombre_comercial),
       ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre),
       aprobador:usuarios!cotizaciones_aprobada_por_fkey(nombre),
       anulador:usuarios!cotizaciones_anulada_por_fkey(nombre),
       items:cotizacion_items(orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!cot) notFound();

  const lineas = ((cot.items as unknown[]) ?? [])
    .map((i) => i as Record<string, unknown>)
    .sort((a, b) => (a.orden as number) - (b.orden as number));

  const esAdmin = ['admin', 'gerencia'].includes(sesion.usuario.rol);
  // Administración también puede editar una cotización editable (además del
  // ejecutivo dueño), p. ej. tras reabrir una aprobada.
  const editable =
    (cot.ejecutivo_id === sesion.usuario.id || esAdmin) &&
    ['borrador', 'observada'].includes(cot.estado as string);
  const ownerNombre =
    uno(cot.ejecutivo as { nombre: string }[] | null)?.nombre ??
    sesion.usuario.nombre;

  if (editable) {
    const [{ data: clientes }, { data: proveedores }] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre_comercial')
        .order('nombre_comercial'),
      supabase
        .from('proveedores')
        .select('nombre_comercial')
        .order('nombre_comercial'),
    ]);

    const inicial: CotizacionInicial = {
      clienteId: cot.cliente_id as string,
      proyecto: cot.proyecto as string,
      moneda: cot.moneda as Moneda,
      feePorcentaje: Number(cot.fee_porcentaje),
      fechaEnvioCliente: cot.fecha_envio_cliente as string | null,
      estado: cot.estado as string,
      observacionAdmin: cot.observacion_admin as string | null,
      nota: (cot.nota as string) ?? '',
      lineas: lineas.map((l) => ({
        proveedor: l.proveedor_nombre as string,
        descripcion: l.descripcion as string,
        cantidad: Number(l.cantidad),
        precio: Number(l.precio_unitario),
      })),
    };

    return (
      <div>
        {guardada && (
          <div className="mb-5 rounded-[10px] border border-verde/30 bg-verde-fondo p-3.5 text-[12.5px] font-medium text-verde">
            Borrador guardado. Puedes seguir editando o enviar a aprobación.
          </div>
        )}
        <FormularioCotizacion
          codigo={cot.codigo as string}
          ejecutivoNombre={ownerNombre}
          clientes={(clientes ?? []).map((c) => ({
            id: c.id as string,
            nombre: c.nombre_comercial as string,
          }))}
          proveedores={(proveedores ?? []).map(
            (p) => p.nombre_comercial as string,
          )}
          inicial={inicial}
        />
      </div>
    );
  }

  const detalle: CotizacionDetalle = {
    codigo: cot.codigo as string,
    estado: cot.estado as string,
    proyecto: cot.proyecto as string,
    moneda: cot.moneda as Moneda,
    feePorcentaje: Number(cot.fee_porcentaje),
    fechaEnvioCliente: cot.fecha_envio_cliente as string | null,
    cliente:
      uno(cot.cliente as { nombre_comercial: string }[] | null)
        ?.nombre_comercial ?? '—',
    ejecutivo: uno(cot.ejecutivo as { nombre: string }[] | null)?.nombre ?? '—',
    observacionAdmin: cot.observacion_admin as string | null,
    aprobadaPor: uno(cot.aprobador as { nombre: string }[] | null)?.nombre ?? null,
    fechaAprobacion: cot.fecha_aprobacion as string | null,
    anuladaPor: uno(cot.anulador as { nombre: string }[] | null)?.nombre ?? null,
    motivoAnulacion: cot.motivo_anulacion as string | null,
    lineas: lineas.map((l) => ({
      orden: l.orden as number,
      proveedor: l.proveedor_nombre as string,
      descripcion: l.descripcion as string,
      cantidad: Number(l.cantidad),
      precio: Number(l.precio_unitario),
      subtotal: Number(l.subtotal),
    })),
  };

  // Si la cotización ya tiene ficha de apertura, enlazamos a ella.
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select('id')
    .eq('cotizacion_id', id)
    .maybeSingle();

  return (
    <div>
      {enviada && (
        <div className="mb-5 flex items-center gap-2.5 rounded-[10px] border border-verde/30 bg-verde-fondo p-3.5 text-[12.5px] font-medium text-verde">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-[17px] w-[17px]"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Cotización enviada a administración para aprobación.
        </div>
      )}
      {guardada && (
        <div className="mb-5 rounded-[10px] border border-verde/30 bg-verde-fondo p-3.5 text-[12.5px] font-medium text-verde">
          Borrador guardado.
        </div>
      )}
      {esAdmin && cot.estado === 'aprobada' && (
        <BotonReabrirCotizacion id={id} />
      )}
      <VistaCotizacion
        cot={detalle}
        pdfHref={cot.pdf_url ? `/cotizaciones/${id}/pdf` : null}
        fichaHref={ficha ? `/fichas/${ficha.id as string}` : null}
      />
    </div>
  );
}
