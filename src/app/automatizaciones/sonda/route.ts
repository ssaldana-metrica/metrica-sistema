import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';
import { decodificarTurboStream } from '@/lib/turbo-stream';

// ── Sonda de diagnóstico · confirmar el listado de Normas Legales ────────────
//
// Lo aprendido:
//   V1 — Vercel llega a El Peruano sin bloqueo.
//   V2 — Es una app React Router v7; el HTML no trae marcado útil.
//   V3 — Se puede pedir por fecha.
//   V4 — Formato turbo-stream; se leen los nombres de campo.
//   V5 — El listado por defecto trae Boletín Oficial, NO normas legales.
//
// LA V5 SE EQUIVOCÓ AL DECLARAR GANADOR. Su criterio era contar la cadena
// "rubro","NL" en el payload, pero eso aparecía en el ECO DE LOS PARÁMETROS
// enviados, no en un resultado. La prueba: `rubro=NL` devolvió exactamente los
// mismos 13 códigos de Boletín que el control, con ocho bytes más — los del
// parámetro repetido de vuelta. El filtro fue ignorado.
//
// El que sí funcionó fue `tipoPublicacion=NL`: códigos distintos, terminados en
// -1 en vez de -8, y coincidentes con los que se ven en pantalla. Su rastro
// delator fue "RESOLUCIÓN MINISTERIAL" en singular — un valor real de
// tipoDispositivo. Los plurales ("RESOLUCIONES MINISTERIALES") son etiquetas
// del menú de filtros y salen en todos los payloads por igual.
//
// V6 (esto): se acabaron las heurísticas de texto. Se decodifica el payload de
// verdad y se devuelven los registros ya armados. Si el formato no es el
// esperado, revienta con un mensaje claro en vez de inventar un resultado.
//
// De la cabecera de la V5 salió además la forma de la respuesta:
//   totalHits: 573 · start: 0 · paginatedBy: 20 · hits: [20 posiciones]
// O sea que hay paginación de 20 en 20 y habrá que recorrer páginas.
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

// El objeto de resultados está anidado bajo la ruta de React Router, cuyo
// nombre puede cambiar. En vez de asumir el camino, se busca el primer objeto
// que tenga `hits`: eso sobrevive a que renombren la ruta.
function buscarResultados(nodo: unknown, profundidad = 0): Record<string, unknown> | null {
  if (profundidad > 8 || nodo === null || typeof nodo !== 'object') return null;
  const obj = nodo as Record<string, unknown>;
  if (Array.isArray(obj.hits)) return obj;
  for (const hijo of Object.values(obj)) {
    const hallado = buscarResultados(hijo, profundidad + 1);
    if (hallado) return hallado;
  }
  return null;
}

async function inspeccionar(nombre: string, url: string) {
  try {
    const r = await fetch(url, {
      headers: NAVEGADOR,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return { nombre, url, estado: r.status, error: 'no respondió 200' };

    const crudo = await r.text();
    const arbol = decodificarTurboStream(crudo);
    const resultados = buscarResultados(arbol);

    if (!resultados) {
      return { nombre, url, estado: r.status, error: 'no se encontró ningún bloque con `hits`' };
    }

    const hits = (resultados.hits ?? []) as Record<string, unknown>[];

    // Qué rubros y tipos trae DE VERDAD, contados sobre los registros ya
    // decodificados y no sobre el texto crudo.
    const rubros: Record<string, number> = {};
    const tipos: Record<string, number> = {};
    for (const h of hits) {
      const rubro = String(h.rubro ?? '¿?');
      const tipo = String(h.tipoDispositivo ?? '¿?');
      rubros[rubro] = (rubros[rubro] ?? 0) + 1;
      tipos[tipo] = (tipos[tipo] ?? 0) + 1;
    }

    return {
      nombre,
      url,
      estado: r.status,
      params: resultados.params,
      totalHits: resultados.totalHits,
      paginatedBy: resultados.paginatedBy,
      start: resultados.start,
      hasNext: resultados.hasNext,
      enEstaPagina: hits.length,
      rubros,
      tipos,
      // Dos registros completos: con esto se termina de fijar el mapeo a las
      // columnas de normas_legales_hallazgos.
      ejemplos: hits.slice(0, 2),
    };
  } catch (e) {
    return {
      nombre,
      url,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido',
    };
  }
}

export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const fecha = params.get('fecha') ?? fechaLima();

  const resultados = await Promise.all([
    inspeccionar(
      'tipoPublicacion=NL (candidato)',
      `${RAIZ}/_root.data?ci=all&fecha=${fecha}&tipoPublicacion=NL`,
    ),
    inspeccionar('ci=all (control)', `${RAIZ}/_root.data?ci=all&fecha=${fecha}`),
    // Segunda página del candidato: confirma que `start` es el parámetro de
    // paginación y no otro.
    inspeccionar(
      'tipoPublicacion=NL · página 2',
      `${RAIZ}/_root.data?ci=all&fecha=${fecha}&tipoPublicacion=NL&start=20`,
    ),
  ]);

  return NextResponse.json(
    { fechaConsultada: fecha, resultados, ejecutadoEn: new Date().toISOString() },
    { status: 200 },
  );
}
