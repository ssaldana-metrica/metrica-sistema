import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import { FormularioCotizacion } from '@/components/cotizacion/FormularioCotizacion';

// Formulario de una cotización recién iniciada (código ya tomado del banco).
export default async function NuevaCotizacion({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const { codigo } = await searchParams;
  if (!codigo) redirect('/banco');

  const supabase = await crearClienteServidor();

  // El código debe existir, estar en uso y pertenecer al usuario actual.
  const { data: registro } = await supabase
    .from('banco_codigos')
    .select('codigo, estado, tomado_por')
    .eq('codigo', codigo)
    .maybeSingle();

  if (
    !registro ||
    registro.estado !== 'en_uso' ||
    registro.tomado_por !== sesion.usuario.id
  ) {
    redirect('/banco');
  }

  // Si ya empezó la cotización de este código, continuar donde quedó.
  const { data: existente } = await supabase
    .from('cotizaciones')
    .select('id')
    .eq('codigo', codigo)
    .maybeSingle();
  if (existente) redirect(`/cotizaciones/${existente.id}`);

  const [{ data: clientes }, { data: proveedores }] = await Promise.all([
    supabase.from('clientes').select('id, nombre_comercial').order('nombre_comercial'),
    supabase.from('proveedores').select('nombre_comercial').order('nombre_comercial'),
  ]);

  return (
    <FormularioCotizacion
      codigo={codigo}
      ejecutivoNombre={sesion.usuario.nombre}
      clientes={(clientes ?? []).map((c) => ({
        id: c.id as string,
        nombre: c.nombre_comercial as string,
      }))}
      proveedores={(proveedores ?? []).map(
        (p) => p.nombre_comercial as string,
      )}
      inicial={null}
    />
  );
}
