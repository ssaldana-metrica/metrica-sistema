import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · encontrar el listado de NORMAS LEGALES del día ────
//
// Lo aprendido:
//   V1 — Vercel llega a El Peruano sin bloqueo.
//   V2 — Es una app React Router v7; el HTML no trae marcado útil.
//   V3 — Se puede pedir por fecha; solo `ci=all` devuelve publicaciones.
//   V4 — El formato es turbo-stream y ya se leen los nombres de campo:
//        op, fechaPublicacion, tipoDispositivo, sumilla, rubro,
//        numeroDispositivo, nombreDispositivo, sector, urlPDF, clasificacion1..3
//
// EL PROBLEMA QUE ABRIÓ LA V4: los 13 resultados que devuelve
// `_root.data?ci=all&fecha=…` son TODOS rubro "BO" — Boletín Oficial, o sea
// sucesiones intestadas y avisos notariales. Ninguna norma legal. Por eso
// /dispositivo/NL/<código>.data dio 404 y el mismo código bajo /BO/ dio 200:
// el código era de Boletín, no de Normas Legales.
//
// Los rubros del sistema son BO, EX, NL y SE. El monitor necesita NL, y hay
// una ruta específica vista en el manifiesto del navegador:
// /cuadernillo/NL/AAAAMMDD — el cuadernillo de Normas Legales del día.
//
// V5 (esto): probar las formas de pedir NL y quedarse con la que sirva. Se
// mide en NORMAS, no en bytes: un payload grande lleno de opciones de filtro
// no vale nada.
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

async function traer(url: string, timeoutMs = 20_000) {
  try {
    const r = await fetch(url, {
      headers: NAVEGADOR,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      estado: r.status,
      tipo: r.headers.get('content-type'),
      texto: r.ok ? await r.text() : null,
    };
  } catch (e) {
    return {
      estado: null,
      tipo: null,
      texto: null,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'error',
    };
  }
}

// Qué tan útil es un payload: no su tamaño, sino cuántas normas trae y de qué
// rubro. La V4 enseñó que 87 KB pueden ser casi todo menú de filtros.
function medir(texto: string) {
  const codigos = [...new Set(texto.match(/\b\d{7}-\d\b/g) ?? [])];

  // En turbo-stream el valor va justo después de su clave, así que
  // "rubro","NL" pegados indican una publicación de Normas Legales.
  const contar = (rubro: string) =>
    (texto.match(new RegExp(`"rubro","${rubro}"`, 'g')) ?? []).length;

  // Los tipos que de verdad importan para el monitor.
  const tipos = [
    ...new Set(
      (
        texto.match(
          /"(DECRETO SUPREMO|RESOLUCI[ÓO]N MINISTERIAL|RESOLUCIONES MINISTERIALES|DECRETO DE URGENCIA|LEY|RESOLUCI[ÓO]N DIRECTORAL)"/gi,
        ) ?? []
      ).map((t) => t.replaceAll('"', '')),
    ),
  ];

  return {
    codigos: codigos.length,
    primeros: codigos.slice(0, 5),
    rubroNL: contar('NL'),
    rubroBO: contar('BO'),
    rubroEX: contar('EX'),
    rubroSE: contar('SE'),
    tiposVistos: tipos,
  };
}

export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const fecha = params.get('fecha') ?? fechaLima();

  const candidatos = [
    // La ruta dedicada del cuadernillo de Normas Legales: la más prometedora.
    { nombre: 'cuadernillo NL', url: `${RAIZ}/cuadernillo/NL/${fecha}.data` },
    { nombre: 'cuadernillo NL (sin .data)', url: `${RAIZ}/cuadernillo/NL/${fecha}` },
    // Filtrar el listado general por rubro, con los nombres de parámetro más
    // plausibles según los campos que ya conocemos.
    { nombre: 'raíz rubro=NL', url: `${RAIZ}/_root.data?ci=all&fecha=${fecha}&rubro=NL` },
    { nombre: 'raíz ci=NL', url: `${RAIZ}/_root.data?ci=NL&fecha=${fecha}` },
    {
      nombre: 'raíz tipoPublicacion=NL',
      url: `${RAIZ}/_root.data?ci=all&fecha=${fecha}&tipoPublicacion=NL`,
    },
    // Control: el listado tal como lo probó la V4, para comparar.
    { nombre: 'raíz ci=all (control)', url: `${RAIZ}/_root.data?ci=all&fecha=${fecha}` },
  ];

  const resultados = await Promise.all(
    candidatos.map(async (c) => {
      const r = await traer(c.url);
      if (!r.texto) {
        return { ...c, estado: r.estado, tipo: r.tipo, bytes: 0, medicion: null, util: false };
      }
      const medicion = medir(r.texto);
      return {
        ...c,
        estado: r.estado,
        tipo: r.tipo,
        bytes: r.texto.length,
        medicion,
        util: medicion.rubroNL > 0,
      };
    }),
  );

  const ganador = resultados.find((r) => r.util);

  // Del ganador se devuelve el ARRANQUE del payload: la V4 enseñó que ahí
  // viven la ruta y las claves, que es lo que hace falta para el decodificador.
  let cabecera: string | null = null;
  if (ganador) {
    const r = await traer(ganador.url);
    cabecera = r.texto?.slice(0, 5000) ?? null;
  }

  return NextResponse.json(
    {
      recomendacion: ganador
        ? `USAR "${ganador.nombre}" → ${ganador.url}. Es el único que devuelve publicaciones de rubro NL.`
        : 'Ninguna variante trajo normas legales. Puede que hoy no se haya publicado el cuadernillo todavía (sale temprano), o que el parámetro sea otro. Reintentar con ?fecha=20260729 para descartar que sea un problema del día.',
      fechaConsultada: fecha,
      resultados,
      cabeceraDelGanador: cabecera,
      ejecutadoEn: new Date().toISOString(),
    },
    { status: 200 },
  );
}
