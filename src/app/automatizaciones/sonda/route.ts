import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · ¿se puede leer El Peruano DESDE EL SERVIDOR? ──────
//
// Por qué existe: la misma página responde distinto según quién la pida.
// Desde una laptop con un navegador devuelve 200; desde un servidor de
// datacenter llegó 403. Eso importa porque el monitor de normas legales va a
// correr en Vercel, que es un datacenter. Si El Peruano bloquea a Vercel, el
// proyecto entero necesita otro camino, y conviene saberlo ANTES de escribir
// el lector, no después.
//
// La duda concreta que resuelve: ¿el 403 es por la IP (datacenter) o por el
// User-Agent (que la petición no parezca un navegador)? Si es lo segundo, se
// arregla mandando cabeceras de navegador — y eso es justo lo que prueba aquí
// el intento "con cabeceras de navegador" contra el intento "pelado".
//
// Es temporal: se borra cuando la Etapa 0 quede cerrada.
//
// Uso: entrar a /automatizaciones/sonda estando logueado como gerencia.

export const dynamic = 'force-dynamic'; // nunca cachear un diagnóstico
export const maxDuration = 60;

const NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};

type Intento = {
  url: string;
  cabeceras: 'navegador' | 'ninguna';
  estado: number | null;
  bytes: number | null;
  // Señal de si el contenido viene ya en el HTML o lo arma JavaScript.
  mencionesNormas: number | null;
  muestra: string | null;
  error: string | null;
};

async function probar(url: string, conCabeceras: boolean): Promise<Intento> {
  const base: Intento = {
    url,
    cabeceras: conCabeceras ? 'navegador' : 'ninguna',
    estado: null,
    bytes: null,
    mencionesNormas: null,
    muestra: null,
    error: null,
  };

  try {
    const respuesta = await fetch(url, {
      headers: conCabeceras ? NAVEGADOR : undefined,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });

    base.estado = respuesta.status;
    if (!respuesta.ok) return base;

    const html = await respuesta.text();
    base.bytes = html.length;
    base.mencionesNormas = (
      html.match(
        /decreto supremo|resoluci[óo]n ministerial|resoluci[óo]n directoral|normas legales/gi,
      ) ?? []
    ).length;
    // Un trozo del cuerpo para poder reconocer la estructura sin traerse
    // 90 KB por la respuesta.
    base.muestra = html.slice(0, 1500);
  } catch (e) {
    base.error = e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido';
  }

  return base;
}

export async function GET() {
  // Diagnóstico interno: solo gerencia. Devuelve 404 y no 403 para no
  // confirmarle a nadie más que esta ruta existe.
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const objetivos = [
    'https://busquedas.elperuano.pe/',
    'https://elperuano.pe/',
  ];

  const intentos = await Promise.all([
    ...objetivos.map((u) => probar(u, true)),
    // El mismo destino sin cabeceras: si este falla y el de arriba pasa, el
    // bloqueo era por User-Agent y se resuelve solo con cabeceras.
    probar(objetivos[0], false),
  ]);

  const conCabeceras = intentos.filter((i) => i.cabeceras === 'navegador');
  const algunoPaso = conCabeceras.some((i) => i.estado === 200);
  const traeContenido = conCabeceras.some((i) => (i.mencionesNormas ?? 0) > 3);

  const veredicto = !algunoPaso
    ? 'BLOQUEADO — El Peruano no responde 200 a Vercel ni con cabeceras de navegador. Hay que cambiar de enfoque (lectura desde otra red o fuente alterna).'
    : traeContenido
      ? 'VIABLE — El Peruano responde a Vercel y el HTML ya trae el contenido: se puede leer con un parser normal.'
      : 'PARCIAL — El Peruano responde a Vercel, pero el HTML llega sin contenido: probablemente lo arma JavaScript y haría falta un navegador automatizado.';

  return NextResponse.json(
    { veredicto, ejecutadoEn: new Date().toISOString(), intentos },
    { status: 200 },
  );
}
