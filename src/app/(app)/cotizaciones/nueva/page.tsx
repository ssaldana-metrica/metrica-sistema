import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { FormularioCotizacion } from '@/components/cotizacion/FormularioCotizacion';

// Formulario de una cotización nueva. El código correlativo se asigna al
// guardar (no se reserva de antemano), así el banco no deja huecos.
export default async function NuevaCotizacion() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const supabase = await crearClienteServidor();
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

  return (
    <FormularioCotizacion
      codigo=""
      ejecutivoNombre={sesion.usuario.nombre}
      clientes={(clientes ?? []).map((c) => ({
        id: c.id as string,
        nombre: c.nombre_comercial as string,
      }))}
      proveedores={(proveedores ?? []).map((p) => p.nombre_comercial as string)}
      inicial={null}
    />
  );
}
