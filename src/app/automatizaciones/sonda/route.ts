import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · ¿cómo está estructurado el dato? ──────────────────
//
// Lo aprendido hasta aquí:
//   V1 — Vercel llega a El Peruano sin bloqueo (200, con y sin cabeceras).
//   V2 — El buscador es una app React Router v7; su HTML no trae marcado útil.
//   V3 — Se puede pedir por fecha, y SOLO `ci=all` devuelve publicaciones
//        (las variantes ci=full dieron cero códigos).
//
// V4 (esto): el payload de `_root.data` es turbo-stream, la serialización
// interna de React Router: un arreglo plano donde los valores se referencian
// por número ({"_219":552}). Rebanar el texto al azar no sirvió — las muestras
// caían en la lista de opciones del desplegable de filtros, no en resultados.
//
// Esta vuelta deja de mirar a ciegas y hace dos cosas concretas:
//
//   1. Ubica los códigos de publicación (25xxxxx-N) dentro del listado del día
//      y devuelve una VENTANA alrededor de los primeros. Así se ve si el
//      título, la entidad y la fecha viven pegados al código o dispersos por
//      el arreglo. De eso depende si un lector pragmático es viable.
//
//   2. Prueba la ruta de UNA norma suelta. En React Router v7 cada ruta tiene
//      su gemela de datos añadiendo `.data`, así que /dispositivo/NL/2538536-1
//      debería responder en /dispositivo/NL/2538536-1.data. Si ese payload es
//      chico y legible, la estrategia cambia a mejor: sacar del listado solo
//      los códigos del día y pedir cada norma por separado. Payloads pequeños,
//      estructura simple y mucho menos que adivinar.
//
// Es temporal: se borra cuando el lector esté escrito.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RAIZ = 'https://busquedas.elperuano.pe';

const NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
};

function fechaLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replaceAll('-', '');
}

async function traer(url: string, timeoutMs = 25_000) {
  try {
    const r = await fetch(url, {
      headers: NAVEGADOR,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const texto = r.ok ? await r.text() : null;
    return { estado: r.status, tipo: r.headers.get('content-type'), texto };
  } catch (e) {
    return {
      estado: null,
      tipo: null,
      texto: null,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'error',
    };
  }
}

const CODIGO = /\b\d{7}-\d\b/g;

export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const fecha = params.get('fecha') ?? fechaLima();

  // ── 1. El listado del día ────────────────────────────────────────────────
  const listadoUrl = `${RAIZ}/_root.data?ci=all&fecha=${fecha}`;
  const listado = await traer(listadoUrl);

  if (!listado.texto) {
    return NextResponse.json({
      error: 'El listado del día no respondió.',
      listadoUrl,
      estado: listado.estado,
    });
  }

  const codigos = [...new Set(listado.texto.match(CODIGO) ?? [])];

  // Ventanas alrededor de los primeros códigos: es donde se sabrá si el
  // título y la entidad están cerca o hay que reconstruir referencias.
  const ventanas = codigos.slice(0, 2).map((codigo) => {
    const i = listado.texto!.indexOf(codigo);
    return {
      codigo,
      posicion: i,
      contexto: listado.texto!.slice(Math.max(0, i - 1400), i + 1400),
    };
  });

  // ── 2. Una norma suelta, por su ruta de datos ────────────────────────────
  // Se prueban las secciones conocidas: NL = Normas Legales (lo que interesa),
  // BO = Boletín Oficial, EX y PC vistos en el manifiesto del navegador.
  const codigoMuestra = params.get('codigo') ?? codigos[0];
  const pruebasNorma = codigoMuestra
    ? await Promise.all(
        ['NL', 'BO'].map(async (seccion) => {
          const url = `${RAIZ}/dispositivo/${seccion}/${codigoMuestra}.data`;
          const r = await traer(url, 15_000);
          return {
            url,
            estado: r.estado,
            tipo: r.tipo,
            bytes: r.texto?.length ?? 0,
            // Un payload de una sola norma debería ser chico: si lo es, cabe
            // casi entero aquí y se puede escribir el lector de una vez.
            contenido: r.texto?.slice(0, 6000) ?? null,
          };
        }),
      )
    : [];

  const algunaNormaSirve = pruebasNorma.some((p) => p.estado === 200 && p.bytes > 200);

  return NextResponse.json(
    {
      recomendacion: algunaNormaSirve
        ? 'La ruta por norma responde. Estrategia: sacar del listado los códigos del día y pedir cada norma por separado — payloads chicos y estructura simple.'
        : codigos.length > 0
          ? 'El listado trae códigos pero la ruta por norma no respondió. Habrá que decodificar el turbo-stream del listado; revisar las ventanas de contexto para ver qué tan cerca están título y entidad.'
          : 'El listado no trajo ningún código con esta fecha. Puede que hoy no haya publicaciones; reintentar con ?fecha=20260730.',
      fechaConsultada: fecha,
      listadoUrl,
      totalCodigos: codigos.length,
      codigos,
      bytesListado: listado.texto.length,
      ventanas,
      pruebasNorma,
      ejecutadoEn: new Date().toISOString(),
    },
    { status: 200 },
  );
}
