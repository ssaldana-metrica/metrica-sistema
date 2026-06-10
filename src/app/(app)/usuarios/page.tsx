import { exigirRol } from '@/lib/auth';
import { Proximamente } from '@/components/ui/Proximamente';

export default async function PaginaUsuarios() {
  await exigirRol(['gerencia']);

  return (
    <Proximamente
      titulo="Gestión de usuarios"
      detalle="La administración de accesos (cambiar rol, dar de baja) llega en el Bloque 7."
    />
  );
}
