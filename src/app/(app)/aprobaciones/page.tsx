import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import {
  ColaAprobacion,
  type PendienteAprobacion,
} from '@/components/aprobacion/ColaAprobacion';
import type { Moneda } from '@/lib/calculos';

// Cola de aprobación: una cotización a la vez, de la más antigua a la más
// nueva. Al resolver una, pasa automáticamente a la siguiente.
export default async function PaginaAprobaciones() {
  const { usuario } = await exigirRol(['admin', 'gerencia']);

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('cotizaciones')
    .select(
      `id, codigo, proyecto, moneda, fee_porcentaje, fecha_envio_cliente, ejecutivo_id,
       cliente:clientes(nombre_comercial, razon_social),
       ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre),
       items:cotizacion_items(orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal)`,
    )
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true });

  const pendientes: PendienteAprobacion[] = (data ?? []).map((c) => {
    const cliente = uno(
      c.cliente as { nombre_comercial: string; razon_social: string }[] | null,
    );
    return {
      id: c.id as string,
      codigo: c.codigo as string,
      ejecutivoId: c.ejecutivo_id as string,
      proyecto: c.proyecto as string,
      moneda: c.moneda as Moneda,
      feePorcentaje: Number(c.fee_porcentaje),
      fechaEnvioCliente: c.fecha_envio_cliente as string | null,
      cliente: cliente?.nombre_comercial ?? '—',
      clienteRazon: cliente?.razon_social ?? '—',
      ejecutivo: uno(c.ejecutivo as { nombre: string }[] | null)?.nombre ?? '—',
      lineas: ((c.items as unknown[]) ?? [])
        .map((i) => i as Record<string, unknown>)
        .sort((a, b) => (a.orden as number) - (b.orden as number))
        .map((l) => ({
          orden: l.orden as number,
          proveedor: l.proveedor_nombre as string,
          descripcion: l.descripcion as string,
          cantidad: Number(l.cantidad),
          precio: Number(l.precio_unitario),
          subtotal: Number(l.subtotal),
        })),
    };
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">
          Cotizaciones por aprobar
        </h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          Aprobar genera el PDF y avisa al ejecutivo por correo interno —
          ningún correo va al cliente.
        </p>
      </div>
      <ColaAprobacion
        pendientes={pendientes}
        usuarioId={usuario.id}
        sinRestriccion={usuario.rol === 'gerencia'}
      />
    </div>
  );
}
