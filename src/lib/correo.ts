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

// Para texto escrito por usuarios (nombres, proyectos, observaciones) que va
// dentro del HTML del correo: un "<" o un "&" literal no deben romperlo ni
// permitir colar etiquetas.
export const escaparHtml = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Los marcadores del .env.local de ejemplo no cuentan como configuración
// (cualquier valor que empiece con PENDIENTE, p. ej. "PENDIENTE_pegar_llave").
const limpiar = (v?: string) =>
  v && v.trim() && !v.trim().toUpperCase().startsWith('PENDIENTE')
    ? v.trim()
    : undefined;

// Arma el remitente tolerando errores típicos al escribir CORREO_REMITENTE:
// comillas de más ("Métrica <x@y>"), sin los <>, o solo el correo. Extrae el
// correo dentro del texto y usa lo anterior como nombre. Si no hay correo
// válido, cae al remitente de pruebas para no romper el envío.
function remitenteValido(): string {
  const fallback = 'Metrica Sistema <onboarding@resend.dev>';
  const raw = limpiar(process.env.CORREO_REMITENTE);
  if (!raw) return fallback;
  const limpio = raw.replace(/^["']([\s\S]*)["']$/, '$1').trim();
  const email = limpio.match(/[^\s<>@]+@[^\s<>]+/)?.[0];
  if (!email) return fallback;
  const nombre = limpio
    .slice(0, limpio.indexOf(email))
    .replace(/[<>"']/g, '')
    .trim();
  return nombre ? `${nombre} <${email}>` : email;
}

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
      from: remitenteValido(),
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

// ── Plantilla con la identidad de Métrica ───────────────────────────────────
//
// La usan TODOS los correos del sistema: cotizaciones, aprobaciones, fichas,
// control y el monitor de normas legales. Cambiar algo acá los cambia todos, y
// eso es lo que se busca — que se vean como un mismo sistema.
//
// Los colores son los de `globals.css`, no una aproximación. La versión
// anterior usaba un encabezado verde oscuro (#14201C) y grises verdosos que no
// existen en la paleta: el sistema es navy (#001830) con grises azulados, así
// que los correos se veían de otra marca.
//
// ── Sobre el logo ───────────────────────────────────────────────────────────
// Va como imagen remota porque un correo no puede leer archivos del proyecto.
// Casi todos los clientes bloquean las imágenes externas hasta que el
// destinatario acepta, así que el `alt` está escrito para que se lea bien
// cuando no cargue: dice "Métrica" en claro sobre el fondo oscuro, que es
// exactamente lo que decía la versión anterior en texto. No se pierde nada.
//
// Si URL_SISTEMA no está definida, se omite la imagen y queda el texto: más
// vale sin logo que con un enlace roto.
const COLOR = {
  navy: '#001830',
  tinta: '#001830',
  tintaSuave: '#3E4D63',
  tintaTenue: '#7C8898',
  linea: '#E6E8EA',
  superficie: '#ECF0F4',
  blancoTenue: '#B9C4D2',
} as const;

export function plantillaCorreo(
  titulo: string,
  contenido: string,
  // Texto de vista previa: lo que el gestor de correo muestra junto al asunto
  // en la bandeja, antes de abrir. Sin esto muestra la primera línea del
  // cuerpo, que suele ser un aviso o una etiqueta y no dice nada útil.
  vistaPrevia?: string,
): string {
  const base = limpiar(process.env.URL_SISTEMA)?.replace(/\/+$/, '');

  const marca = base
    ? `<img src="${base}/marca/logo-metrica-blanco.png" alt="Métrica"
           width="104" height="53"
           style="display:block;border:0;height:53px;width:104px;color:${COLOR.blancoTenue};font-size:16px;font-weight:700;" />`
    : `<span style="color:#FFFFFF;font-weight:700;font-size:16px;">Métrica</span>`;

  const preheader = vistaPrevia
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">
         ${escaparHtml(vistaPrevia)}
       </div>`
    : '';

  return `
  ${preheader}
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:${COLOR.tinta};">
    <div style="background:${COLOR.navy};border-radius:12px 12px 0 0;padding:20px 24px 16px;">
      ${marca}
      <div style="color:${COLOR.blancoTenue};font-size:10px;letter-spacing:.16em;text-transform:uppercase;margin-top:8px;">
        Sistema Operativo
      </div>
    </div>
    <div style="border:1px solid ${COLOR.linea};border-top:none;border-radius:0 0 12px 12px;padding:24px;background:#FFFFFF;">
      <h2 style="font-size:16px;margin:0 0 12px;color:${COLOR.tinta};">${titulo}</h2>
      ${contenido}
      <p style="font-size:11px;line-height:1.6;color:${COLOR.tintaTenue};margin:24px 0 0;border-top:1px solid ${COLOR.linea};padding-top:12px;">
        Correo interno del sistema · no responder · ningún correo del sistema va a clientes
      </p>
    </div>
  </div>`;
}
