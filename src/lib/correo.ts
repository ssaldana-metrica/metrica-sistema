import 'server-only';
import { Resend } from 'resend';

// Correo INTERNO entre cuentas Métrica. NINGÚN correo va al cliente.
//
// Modo pruebas (mientras el dominio metrica.pe no esté verificado en Resend):
// - Remitente: onboarding@resend.dev (el de pruebas de Resend).
// - Resend en pruebas SOLO entrega al correo con el que te registraste en
//   Resend. Define CORREO_PRUEBAS con ese correo y todo se redirige ahí,
//   indicando en el cuerpo el destinatario real.
// Al verificar el dominio: definir CORREO_REMITENTE y quitar CORREO_PRUEBAS.

export type ResultadoCorreo = { enviado: boolean; detalle: string };

// Los marcadores del .env.local de ejemplo no cuentan como configuración
// (cualquier valor que empiece con PENDIENTE, p. ej. "PENDIENTE_pegar_llave").
const limpiar = (v?: string) =>
  v && v.trim() && !v.trim().toUpperCase().startsWith('PENDIENTE')
    ? v.trim()
    : undefined;

export async function enviarCorreoInterno({
  para,
  asunto,
  html,
  adjuntos,
}: {
  para: string | string[];
  asunto: string;
  html: string;
  adjuntos?: { nombre: string; contenido: Buffer }[];
}): Promise<ResultadoCorreo> {
  const llave = limpiar(process.env.RESEND_API_KEY);
  if (!llave) {
    return {
      enviado: false,
      detalle: 'Correo omitido: falta RESEND_API_KEY en .env.local.',
    };
  }

  const destinatarios = (Array.isArray(para) ? para : [para]).filter(Boolean);
  if (destinatarios.length === 0)
    return { enviado: false, detalle: 'Correo omitido: sin destinatario.' };

  const redireccion = limpiar(process.env.CORREO_PRUEBAS);
  const destino = redireccion ? [redireccion] : destinatarios;
  const cuerpo = redireccion
    ? `<p style="background:#F6ECD2;color:#B5821E;padding:10px 14px;border-radius:8px;font-family:monospace;font-size:12px;">
         MODO PRUEBAS · destinatario real: ${destinatarios.join(', ')}
       </p>${html}`
    : html;

  try {
    const resend = new Resend(llave);
    const { error } = await resend.emails.send({
      from:
        limpiar(process.env.CORREO_REMITENTE) ??
        'Métrica Sistema <onboarding@resend.dev>',
      to: destino,
      subject: asunto,
      html: cuerpo,
      attachments: adjuntos?.map((a) => ({
        filename: a.nombre,
        content: a.contenido,
      })),
    });
    if (error) {
      // El error más común en modo pruebas, traducido a una instrucción clara
      if (/testing emails|verify a domain|your own email/i.test(error.message)) {
        return {
          enviado: false,
          detalle:
            'Resend en modo pruebas solo entrega al correo del dueño de la cuenta Resend. Pon ese correo en CORREO_PRUEBAS dentro de .env.local y reinicia el servidor.',
        };
      }
      return { enviado: false, detalle: `Correo falló: ${error.message}` };
    }
    return {
      enviado: true,
      detalle: redireccion
        ? `Correo enviado a ${redireccion} (pruebas; destinatario real: ${destinatarios.join(', ')}).`
        : `Correo enviado a ${destinatarios.join(', ')}.`,
    };
  } catch (e) {
    return {
      enviado: false,
      detalle: `Correo falló: ${e instanceof Error ? e.message : 'error desconocido'}`,
    };
  }
}

// Plantilla mínima con la identidad de Métrica
export function plantillaCorreo(titulo: string, contenido: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#16201C;">
    <div style="background:#14201C;border-radius:12px 12px 0 0;padding:18px 24px;">
      <span style="color:#E8E5DB;font-weight:700;font-size:16px;">Métrica</span>
      <span style="color:#A8B5AE;font-size:11px;margin-left:8px;">Sistema Operativo</span>
    </div>
    <div style="border:1px solid #E3E2DA;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <h2 style="font-size:16px;margin:0 0 12px;">${titulo}</h2>
      ${contenido}
      <p style="font-size:11px;color:#828B83;margin-top:24px;border-top:1px solid #EEEDE6;padding-top:12px;">
        Correo interno del sistema · no responder · ningún correo del sistema va a clientes
      </p>
    </div>
  </div>`;
}
