import { exigirRol } from '@/lib/auth';
import { Proximamente } from '@/components/ui/Proximamente';

export default async function PaginaAprobaciones() {
  await exigirRol(['admin', 'gerencia']);

  return (
    <Proximamente
      titulo="Aprobaciones"
      detalle="La cola de aprobación (aprobar con PDF + correo, u observar) llega en el Bloque 5."
    />
  );
}
