import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { OrdenEditor } from '@/components/orden/OrdenEditor';
import type { Moneda } from '@/lib/calculos';
import type { TipoProveedor } from '@/actions/ordenes';

// Detalle/edición de una orden de adquisición. Solo admin y gerencia (RLS y
// candado de rol); el ejecutivo no accede.
export default async function PaginaOrden({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirRol(['admin', 'gerencia']);
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from('ordenes_adquisicion')
    .select(
      `id, codigo, estado, ficha_id, agencia, influencer_proveedor, razon_social,
       nombre_comercial, ruc, tipo_proveedor, descripcion, monto, moneda, banco,
       cuenta_cci, email_proveedor, condiciones_pago, pdf_url, motivo_anulacion,
       ficha:fichas_apertura!inner(
         codigo, cotizacion:cotizaciones!inner(id, codigo)
       )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!orden) notFound();

  const { data: detalles } = await supabase
    .from('orden_detalles')
    .select('descripcion, monto')
    .eq('orden_id', id)
    .order('posicion');

  const ficha = uno(
    orden.ficha as {
      codigo: string;
      cotizacion: { id: string; codigo: string }[];
    }[] | null,
  );
  const cot = uno(ficha?.cotizacion ?? null);

  return (
    <OrdenEditor
      ordenId={orden.id as string}
      codigo={orden.codigo as string}
      estado={orden.estado as string}
      fichaId={orden.ficha_id as string}
      fichaCodigo={ficha?.codigo ?? '—'}
      cotizacionId={cot?.id ?? null}
      cotizacionCodigo={cot?.codigo ?? '—'}
      pdfHref={orden.pdf_url ? `/ordenes/${orden.id as string}/pdf` : null}
      motivoAnulacion={(orden.motivo_anulacion as string | null) ?? null}
      inicial={{
        agencia: (orden.agencia as string) ?? '',
        influencerProveedor: (orden.influencer_proveedor as string) ?? '',
        razonSocial: (orden.razon_social as string) ?? '',
        nombreComercial: (orden.nombre_comercial as string) ?? '',
        ruc: (orden.ruc as string) ?? '',
        tipoProveedor: (orden.tipo_proveedor as TipoProveedor) ?? 'empresa',
        condicionesPago: (orden.condiciones_pago as string) ?? '',
        moneda: orden.moneda as Moneda,
        detalles: (detalles ?? []).map((x) => ({
          descripcion: (x.descripcion as string) ?? '',
          monto: Number(x.monto) || 0,
        })),
        banco: (orden.banco as string) ?? '',
        cuentaCci: (orden.cuenta_cci as string) ?? '',
        emailProveedor: (orden.email_proveedor as string) ?? '',
      }}
    />
  );
}
