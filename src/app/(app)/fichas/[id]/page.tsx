import { notFound } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { uno } from '@/lib/util';
import { FichaEditor } from '@/components/ficha/FichaEditor';
import type { Moneda } from '@/lib/calculos';

// Detalle/edición de una ficha de apertura. El RLS decide la visibilidad:
// el ejecutivo solo ve las de sus cotizaciones; admin/gerencia, todas.
export default async function PaginaFicha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const { id } = await params;

  const supabase = await crearClienteServidor();
  const { data: ficha } = await supabase
    .from('fichas_apertura')
    .select(
      `id, codigo, estado, cliente_nombre, cliente_ruc, politica_pago,
       contacto_aprobacion, correo_contacto, inicio_acciones, fin_acciones,
       facturar_antes_del_fin, moneda, observaciones_ejecutivo,
       num_factura_cliente, oc_cliente, hes, fecha_emision_factura, total_seguimiento,
       cotizacion:cotizaciones!inner(
         id, codigo, proyecto, ejecutivo_id,
         ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(nombre)
       )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!ficha) notFound();

  const { data: provs } = await supabase
    .from('ficha_proveedores')
    .select(
      `id, orden, agencia, influencer_proveedor, ruc, descripcion, monto, banco,
       cuenta_cci, email_proveedor, num_oc, num_factura, fecha_emision,
       total, moneda_total, importe, moneda_importe, pago_fraccionado`,
    )
    .eq('ficha_id', id)
    .order('orden');

  const cot = uno(
    ficha.cotizacion as {
      id: string;
      codigo: string;
      proyecto: string;
      ejecutivo_id: string;
      ejecutivo: { nombre: string }[];
    }[] | null,
  );

  const esAdmin = ['admin', 'gerencia'].includes(sesion.usuario.rol);
  const esDueno = cot?.ejecutivo_id === sesion.usuario.id;
  const puedeEditar =
    (esDueno || esAdmin) && ficha.estado === 'en_proceso';

  return (
    <FichaEditor
      fichaId={ficha.id as string}
      codigo={ficha.codigo as string}
      estado={ficha.estado as string}
      cotizacionId={cot?.id ?? ''}
      cotizacionCodigo={cot?.codigo ?? '—'}
      proyecto={cot?.proyecto ?? ''}
      ejecutivo={uno(cot?.ejecutivo ?? null)?.nombre ?? '—'}
      puedeEditar={puedeEditar}
      esAdmin={esAdmin}
      inicial={{
        clienteNombre: (ficha.cliente_nombre as string) ?? '',
        clienteRuc: (ficha.cliente_ruc as string) ?? '',
        politicaPago: (ficha.politica_pago as string) ?? '',
        contactoAprobacion: (ficha.contacto_aprobacion as string) ?? '',
        correoContacto: (ficha.correo_contacto as string) ?? '',
        inicioAcciones: (ficha.inicio_acciones as string | null) ?? null,
        finAcciones: (ficha.fin_acciones as string | null) ?? null,
        facturarAntesDelFin: Boolean(ficha.facturar_antes_del_fin),
        moneda: ficha.moneda as Moneda,
        observacionesEjecutivo: (ficha.observaciones_ejecutivo as string) ?? '',
      }}
      proveedoresIniciales={(provs ?? []).map((p) => ({
        agencia: (p.agencia as string) ?? '',
        influencerProveedor: (p.influencer_proveedor as string) ?? '',
        ruc: (p.ruc as string) ?? '',
        descripcion: (p.descripcion as string) ?? '',
        monto: p.monto != null ? String(p.monto) : '',
        banco: (p.banco as string) ?? '',
        cuentaCci: (p.cuenta_cci as string) ?? '',
        emailProveedor: (p.email_proveedor as string) ?? '',
      }))}
      seguimientoCliente={{
        numFacturaCliente: (ficha.num_factura_cliente as string) ?? '',
        ocCliente: (ficha.oc_cliente as string) ?? '',
        hes: (ficha.hes as string) ?? '',
        fechaEmisionFactura:
          (ficha.fecha_emision_factura as string | null) ?? null,
        totalSeguimiento:
          ficha.total_seguimiento != null
            ? String(ficha.total_seguimiento)
            : '',
      }}
      seguimientoProveedores={(provs ?? []).map((p) => ({
        id: p.id as string,
        etiqueta:
          (p.agencia as string) ||
          (p.influencer_proveedor as string) ||
          (p.descripcion as string) ||
          `Proveedor ${p.orden as number}`,
        numOc: (p.num_oc as string) ?? '',
        numFactura: (p.num_factura as string) ?? '',
        fechaEmision: (p.fecha_emision as string | null) ?? null,
        total: p.total != null ? String(p.total) : '',
        monedaTotal: (p.moneda_total as Moneda) ?? 'PEN',
        importe: p.importe != null ? String(p.importe) : '',
        monedaImporte: (p.moneda_importe as Moneda) ?? 'PEN',
        pagoFraccionado: Boolean(p.pago_fraccionado),
      }))}
    />
  );
}
