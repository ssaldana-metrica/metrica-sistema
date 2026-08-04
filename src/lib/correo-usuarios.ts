import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { enviarCorreoInterno, plantillaCorreo, escaparHtml } from '@/lib/correo';
import { urlSistema } from '@/config/sistema';

// Correos del alta de usuarios y las solicitudes de rol.
//
// Van a cuentas de Métrica y a nadie más, como todos los del sistema. Ninguno
// llega a un cliente ni a un proveedor.
//
// Se usa la llave privilegiada para leer quién es gerencia: en el momento del
// alta la persona todavía no tiene permiso para consultar esa lista, y aun así
// hay que avisarle a quien corresponde.

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administración',
  ejecutivo: 'Ejecutivo',
  gerencia: 'Gerencia',
};

async function correosDeGerencia(): Promise<string[]> {
  const { data } = await crearClienteAdmin()
    .from('usuarios')
    .select('correo')
    .eq('rol', 'gerencia')
    .eq('activo', true);
  return (data ?? []).map((u) => u.correo as string);
}

/** Avisa a gerencia que alguien nuevo pidió el rol de Administración. */
export async function avisarSolicitudDeRol({
  nombre,
  correo,
}: {
  nombre: string;
  correo: string;
}): Promise<void> {
  const destinatarios = await correosDeGerencia();
  if (destinatarios.length === 0) return;

  const enlace = `${urlSistema()}/usuarios`;

  const cuerpo = `
    <p style="font-size:13px;color:#001830;margin:0 0 14px;">
      <strong>${escaparHtml(nombre)}</strong> acaba de registrarse y solicitó el
      rol de <strong>Administración</strong>.
    </p>
    <div style="border:1px solid #E6E8EA;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
      <div style="font-size:11px;color:#7C8898;text-transform:uppercase;letter-spacing:.06em;">Correo</div>
      <div style="font-size:13px;font-weight:600;color:#001830;margin-top:2px;">${escaparHtml(correo)}</div>
      <div style="font-size:11px;color:#7C8898;text-transform:uppercase;letter-spacing:.06em;margin-top:10px;">Rol solicitado</div>
      <div style="font-size:13px;font-weight:600;color:#001830;margin-top:2px;">Administración</div>
    </div>
    <p style="font-size:12.5px;line-height:1.6;color:#3E4D63;margin:0 0 16px;">
      Mientras tanto entró como <strong>Ejecutivo</strong>: puede cotizar y
      llenar sus fichas, pero <strong>no puede aprobar cotizaciones</strong>
      hasta que alguien resuelva la solicitud.
    </p>
    <a href="${escaparHtml(enlace)}"
       style="display:inline-block;background:#001830;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">
      Revisar la solicitud →
    </a>`;

  await enviarCorreoInterno({
    para: destinatarios,
    asunto: `Solicitud de rol · ${nombre} pide Administración`,
    html: plantillaCorreo('Nueva solicitud de rol', cuerpo,
      `${nombre} (${correo}) solicitó el rol de Administración. Entró como Ejecutivo mientras se resuelve.`),
  });
}

/** Le avisa a la persona que su solicitud se resolvió. */
export async function avisarResolucionDeRol({
  correo,
  nombre,
  rolSolicitado,
  aprobada,
}: {
  correo: string;
  nombre: string;
  rolSolicitado: string;
  aprobada: boolean;
}): Promise<void> {
  const etiqueta = ETIQUETA_ROL[rolSolicitado] ?? rolSolicitado;

  const cuerpo = aprobada
    ? `<p style="font-size:13px;line-height:1.6;color:#001830;margin:0 0 14px;">
         Hola ${escaparHtml(nombre)}, tu solicitud del rol
         <strong>${escaparHtml(etiqueta)}</strong> fue aprobada.
       </p>
       <p style="font-size:12.5px;line-height:1.6;color:#3E4D63;margin:0 0 16px;">
         Ya puedes entrar y vas a ver las secciones de ese rol. Si tenías el
         sistema abierto, recarga la página.
       </p>`
    // El rechazo se redacta sin dramatismo: la persona sigue trabajando igual,
    // solo que con el rol base. Decirle "denegada" sin más suena a sanción.
    : `<p style="font-size:13px;line-height:1.6;color:#001830;margin:0 0 14px;">
         Hola ${escaparHtml(nombre)}, tu solicitud del rol
         <strong>${escaparHtml(etiqueta)}</strong> no fue aprobada.
       </p>
       <p style="font-size:12.5px;line-height:1.6;color:#3E4D63;margin:0 0 16px;">
         Sigues con el rol <strong>Ejecutivo</strong>, con el que puedes cotizar
         y llenar tus fichas con normalidad. Si crees que necesitas el otro rol
         para tu trabajo, conversa con gerencia.
       </p>`;

  await enviarCorreoInterno({
    para: correo,
    asunto: aprobada
      ? `Tu rol ${etiqueta} fue aprobado`
      : `Sobre tu solicitud de rol ${etiqueta}`,
    html: plantillaCorreo(
      aprobada ? 'Solicitud aprobada' : 'Solicitud resuelta',
      cuerpo,
      aprobada
        ? `Ya tienes el rol ${etiqueta}.`
        : `Sigues con el rol Ejecutivo.`,
    ),
  });
}
