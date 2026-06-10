import { obtenerSesion } from '@/lib/auth';
import { Proximamente } from '@/components/ui/Proximamente';

export default async function PaginaCotizaciones() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  return (
    <Proximamente
      titulo="Maestro de cotizaciones"
      detalle="La tabla filtrable por estado llega en el Bloque 6. Mientras tanto, el panel muestra la actividad reciente."
    />
  );
}
