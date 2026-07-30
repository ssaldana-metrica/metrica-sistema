import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { correrMonitorNormas } from '@/lib/normas-monitor';

// ── Disparador del monitor de normas legales ─────────────────────────────────
//
// Quién puede dispararlo, dos caminos:
//
//   1. La tarea programada, con la cabecera `Authorization: Bearer <secreto>`.
//      El secreto vive en la variable de entorno CRON_SECRET, la misma en
//      Vercel y en los secretos del repositorio de GitHub.
//
//   2. Gerencia desde el navegador, para el botón de "correr ahora" y para
//      probar sin esperar a la hora programada.
//
// ── Por qué GitHub Actions y no Vercel Cron ─────────────────────────────────
// El proyecto está en el plan Hobby de Vercel, que no permite dos corridas
// diarias. La Action solo DISPARA: hace el POST y se va. Todo el trabajo —leer
// El Peruano, clasificar, enviar el correo— ocurre acá, en Vercel. Eso importa
// porque la lectura de El Peruano se verificó desde Vercel, no desde los
// runners de GitHub, que salen por otra red.
//
// ── Por qué POST y no GET ───────────────────────────────────────────────────
// Esto tiene efectos: guarda hallazgos y manda correos. Un GET puede dispararse
// solo desde un prefetch del navegador, un rastreador o el previsualizador de
// enlaces de cualquier chat. Con POST eso no pasa por accidente.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Comparación en tiempo constante: comparar con === se rinde en el primer
// carácter distinto, y esa diferencia de tiempo permite adivinar el secreto
// carácter por carácter.
function secretoValido(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function autorizado(request: Request): Promise<boolean> {
  const cabecera = request.headers.get('authorization') ?? '';
  const secreto = process.env.CRON_SECRET?.trim();

  if (secreto && cabecera.startsWith('Bearer ')) {
    if (secretoValido(cabecera.slice(7).trim(), secreto)) return true;
  }

  const sesion = await obtenerSesion();
  return sesion?.usuario.rol === 'gerencia';
}

export async function POST(request: Request) {
  if (!(await autorizado(request))) {
    // 404 y no 401: no hace falta confirmarle a nadie que esta ruta existe.
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  // Permite reprocesar un día concreto: útil si una corrida falló y hay que
  // recuperarla sin esperar a mañana.
  const fecha = new URL(request.url).searchParams.get('fecha') ?? undefined;

  try {
    const resultado = await correrMonitorNormas(fecha);
    return NextResponse.json(resultado, { status: 200 });
  } catch (e) {
    // El detalle ya quedó guardado en el historial por el propio monitor. Acá
    // se responde 500 para que la Action falle de forma VISIBLE: un monitor
    // roto que responde 200 no se distingue de uno que no encontró nada.
    return NextResponse.json(
      {
        corrio: false,
        error: e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido',
      },
      { status: 500 },
    );
  }
}
