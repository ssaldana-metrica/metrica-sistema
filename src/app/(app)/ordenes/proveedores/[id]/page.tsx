import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { OrdenProveedorEditor } from '@/components/orden-proveedor/OrdenProveedorEditor';
import type { Moneda } from '@/lib/calculos';
import type { TipoComprobante } from '@/config/impuestos';
import type { TipoProveedorOda } from '@/config/oda-proveedores';

// Detalle de una ODA a proveedores. Solo admin y gerencia, igual que las de
// proyecto: el RLS lo sostiene y este candado da el mensaje claro.
//
// La consulta es mucho más corta que la de una ODA de proyecto porque no hay
// ficha ni cotización de las que traer datos: todo lo de esta orden vive en su
// propia fila.
export default async function PaginaOrdenProveedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirRol(['admin', 'gerencia']);
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from('ordenes_proveedores')
    .select(
      `id, codigo, estado, tipo_proveedor, razon_social, nombre_comercial, ruc,
       tipo_comprobante, moneda, banco, cuenta, cci, email_proveedor,
       condiciones_pago, pdf_url, motivo_anulacion`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!orden) notFound();

  const { data: detalles } = await supabase
    .from('orden_proveedor_detalles')
    .select('descripcion, cantidad, precio_unitario')
    .eq('orden_id', id)
    .order('posicion');

  return (
    <OrdenProveedorEditor
      ordenId={orden.id as string}
      codigo={orden.codigo as string}
      estado={orden.estado as string}
      pdfHref={orden.pdf_url ? `/ordenes/proveedores/${orden.id as string}/pdf` : null}
      motivoAnulacion={(orden.motivo_anulacion as string | null) ?? null}
      inicial={{
        tipoProveedor: (orden.tipo_proveedor as TipoProveedorOda) ?? 'otros',
        razonSocial: (orden.razon_social as string) ?? '',
        nombreComercial: (orden.nombre_comercial as string) ?? '',
        ruc: (orden.ruc as string) ?? '',
        tipoComprobante: (orden.tipo_comprobante as TipoComprobante) ?? 'factura',
        condicionesPago: (orden.condiciones_pago as string) ?? '',
        moneda: orden.moneda as Moneda,
        detalles: (detalles ?? []).map((x) => ({
          descripcion: (x.descripcion as string) ?? '',
          cantidad: Number(x.cantidad) || 0,
          precioUnitario: Number(x.precio_unitario) || 0,
        })),
        banco: (orden.banco as string) ?? '',
        cuenta: (orden.cuenta as string) ?? '',
        cci: (orden.cci as string) ?? '',
        emailProveedor: (orden.email_proveedor as string) ?? '',
      }}
    />
  );
}
