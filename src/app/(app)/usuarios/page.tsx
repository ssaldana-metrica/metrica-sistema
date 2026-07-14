import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import {
  TablaUsuarios,
  type UsuarioFila,
} from '@/components/usuarios/TablaUsuarios';
import type { Rol } from '@/lib/roles';

export default async function PaginaUsuarios() {
  const sesion = await exigirRol(['gerencia']);

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, correo, rol, activo')
    .order('activo', { ascending: false })
    .order('nombre');

  const usuarios: UsuarioFila[] = (data ?? []).map((u) => ({
    id: u.id as string,
    nombre: u.nombre as string,
    correo: u.correo as string,
    rol: u.rol as Rol,
    activo: u.activo as boolean,
  }));

  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight">Usuarios</h1>
        <p className="mt-0.5 text-[13px] text-tinta-tenue">
          {activos} activos de {usuarios.length} · cambia el rol o da de baja a
          cualquier colaborador. Solo gerencia ve esta sección.
        </p>
      </div>

      <TablaUsuarios usuarios={usuarios} yoId={sesion.usuario.id} />
    </div>
  );
}
