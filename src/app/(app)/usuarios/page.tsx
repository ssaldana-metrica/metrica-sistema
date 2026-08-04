import { exigirRol } from '@/lib/auth';
import { crearClienteServidor } from '@/lib/supabase/server';
import {
  TablaUsuarios,
  type UsuarioFila,
} from '@/components/usuarios/TablaUsuarios';
import { SolicitudesPendientes } from '@/components/usuarios/SolicitudesPendientes';
import type { SolicitudPendiente } from '@/actions/usuarios';
import type { Rol } from '@/lib/roles';

export default async function PaginaUsuarios() {
  const sesion = await exigirRol(['gerencia']);

  const supabase = await crearClienteServidor();

  const [{ data }, { data: pendientes }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(
        'id, nombre, correo, rol, activo, puede_reactivar, puede_otorgar_gerencia',
      )
      .order('activo', { ascending: false })
      .order('nombre'),
    supabase
      .from('solicitudes_rol')
      .select('id, usuario_id, rol_solicitado, creada_en, usuarios(nombre, correo)')
      .eq('estado', 'pendiente')
      .order('creada_en'),
  ]);

  const usuarios: UsuarioFila[] = (data ?? []).map((u) => ({
    id: u.id as string,
    nombre: u.nombre as string,
    correo: u.correo as string,
    rol: u.rol as Rol,
    activo: u.activo as boolean,
    puedeReactivar: Boolean(u.puede_reactivar),
    puedeOtorgarGerencia: Boolean(u.puede_otorgar_gerencia),
  }));

  const solicitudes: SolicitudPendiente[] = (pendientes ?? []).map((s) => {
    const persona = s.usuarios as unknown as {
      nombre: string;
      correo: string;
    } | null;
    return {
      id: s.id as string,
      usuarioId: s.usuario_id as string,
      nombre: persona?.nombre ?? '—',
      correo: persona?.correo ?? '—',
      rolSolicitado: s.rol_solicitado as Rol,
      creadaEn: s.creada_en as string,
    };
  });

  // Quién puede convertir a alguien en gerencia. Es un permiso aparte del rol:
  // toda gerencia resuelve solicitudes de Administración, pero solo quien lo
  // tenga puede crear más gerencias.
  const yoPuedoOtorgarGerencia =
    usuarios.find((u) => u.id === sesion.usuario.id)?.puedeOtorgarGerencia ?? false;

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

      <SolicitudesPendientes solicitudes={solicitudes} yoId={sesion.usuario.id} />

      <TablaUsuarios
        usuarios={usuarios}
        yoId={sesion.usuario.id}
        puedoOtorgarGerencia={yoPuedoOtorgarGerencia}
      />
    </div>
  );
}
