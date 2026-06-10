import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';

// Aterrizaje tras tomar un código del banco. El formulario completo
// (datos generales + líneas de proveedor) llega en el Bloque 4.
export default async function NuevaCotizacion({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const { codigo } = await searchParams;
  if (!codigo) redirect('/banco');

  // El código debe existir, estar en uso y pertenecer al usuario actual.
  const supabase = await crearClienteServidor();
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

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold tracking-tight">
        Nueva cotización{' '}
        <span className="ml-2 font-mono text-[15px] text-petroleo-oscuro">
          {codigo}
        </span>
      </h1>
      <p className="mb-6 text-[13px] text-tinta-tenue">
        El código quedó reservado a tu nombre en el banco.
      </p>

      <div className="rounded-xl border border-dashed border-linea bg-white p-10 text-center shadow-tarjeta">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-verde-fondo text-verde">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-5 w-5"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-tinta-suave">
          Código <span className="font-mono font-semibold">{codigo}</span>{' '}
          tomado correctamente. El formulario de cotización (cliente,
          proyecto, líneas de proveedor y totales) llega en el Bloque 4.
        </p>
      </div>
    </div>
  );
}
