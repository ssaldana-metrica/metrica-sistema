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

  const [{ data }, { data: pendientes, error: errPendientes }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(
        'id, nombre, correo, rol, activo, puede_reactivar, puede_otorgar_gerencia, puede_aprobar_cotizaciones',
      )
      .order('activo', { ascending: false })
      .order('nombre'),
    supabase
      .from('solicitudes_rol')
      // Hay que decir POR CUÁL de las dos claves foráneas se une: esta tabla
      // apunta a `usuarios` dos veces, en `usuario_id` y en `resuelta_por`.
      // Sin el nombre de la clave la consulta no es ambigua para nosotros pero
      // sí para PostgREST, que la rechaza entera.
      .select(
        'id, usuario_id, rol_solicitado, creada_en, persona:usuarios!solicitudes_rol_usuario_id_fkey(nombre, correo)',
      )
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
    puedeAprobar: Boolean(u.puede_aprobar_cotizaciones),
  }));

  const solicitudes: SolicitudPendiente[] = (pendientes ?? []).map((s) => {
    const persona = s.persona as unknown as {
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
          {activos} activos de {usuarios.length} · cambia el rol, decide quién
          aprueba cotizaciones o da de baja a cualquier colaborador. Solo
          gerencia ve esta sección.
        </p>
      </div>

      {/* Si la consulta de solicitudes falla, hay que DECIRLO. La versión
          anterior devolvía una lista vacía ante un error y la pantalla se veía
          idéntica a "no hay nada pendiente": una persona esperó su aprobación
          sin que nadie pudiera dársela, porque nadie sabía que existía. */}
      {errPendientes && (
        <div className="mb-6 rounded-xl border border-rojo/30 bg-rojo-fondo px-5 py-4 text-[13px] text-rojo">
          <strong>No se pudieron cargar las solicitudes de rol.</strong> Si
          alguien está esperando aprobación, no aparece en esta pantalla. Avisa a
          soporte con este detalle: <span className="font-mono text-[12px]">{errPendientes.message}</span>
        </div>
      )}

      <SolicitudesPendientes solicitudes={solicitudes} yoId={sesion.usuario.id} />

      <TablaUsuarios
        usuarios={usuarios}
        yoId={sesion.usuario.id}
        puedoOtorgarGerencia={yoPuedoOtorgarGerencia}
      />
    </div>
  );
}
