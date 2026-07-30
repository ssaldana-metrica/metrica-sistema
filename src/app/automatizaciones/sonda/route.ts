import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · ¿de dónde saca los datos El Peruano? ──────────────
//
// PRIMERA VUELTA (cerrada): ¿deja Vercel leer El Peruano? SÍ. Ambos hosts
// contestaron 200 incluso sin cabeceras de navegador, así que no hay bloqueo
// por IP de datacenter ni por User-Agent. Ese riesgo queda descartado.
//
// SEGUNDA VUELTA (esto): la primera versión de esta sonda dio un FALSO
// POSITIVO. Contaba menciones a "normas legales" en todo el HTML, pero el
// <head> de busquedas.elperuano.pe trae un <meta name="description"> y un
// og:description de relleno que dicen "Decretos | Normas Legales | Separatas
// Especiales | …". Ocho coincidencias, cero normas de verdad.
//
// La pista real estaba en <link rel="modulepreload" href="/assets/…">:
// busquedas.elperuano.pe es una aplicación JavaScript (bundle tipo Vite). El
// HTML llega sin contenido y las normas las pinta el navegador después.
//
// Eso NO es mala noticia. Una app así se alimenta de un API que devuelve JSON,
// y leer JSON es más estable que raspar HTML: no se rompe cuando rediseñan la
// página. Esta sonda busca ese API — descarga los bundles y extrae de ellos
// las rutas que el código llama.
//
// Es temporal: se borra cuando el lector esté escrito.
//
// Uso: entrar a /automatizaciones/sonda logueado como gerencia.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RAIZ = 'https://busquedas.elperuano.pe';

const NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
};

async function traer(url: string, timeoutMs = 15_000) {
  try {
    const r = await fetch(url, {
      headers: NAVEGADOR,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const texto = r.ok ? await r.text() : null;
    return {
      estado: r.status,
      tipo: r.headers.get('content-type'),
      texto,
      error: null as string | null,
    };
  } catch (e) {
    return {
      estado: null,
      tipo: null,
      texto: null,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido',
    };
  }
}

// El conteo honesto: solo dentro del <body>, sin metadatos que inflen el
// resultado. Esto es lo que arregla el falso positivo de la primera versión.
function normasEnCuerpo(html: string): number {
  const cuerpo = html.replace(/<head[\s\S]*?<\/head>/i, '');
  return (
    cuerpo.match(
      /decreto supremo|resoluci[óo]n ministerial|resoluci[óo]n directoral/gi,
    ) ?? []
  ).length;
}

function esAplicacionJs(html: string): boolean {
  return (
    /<link[^>]+rel=["']modulepreload["']/i.test(html) ||
    /<div[^>]+id=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(html) ||
    /src=["']\/assets\/[^"']+\.js["']/i.test(html)
  );
}

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const paso: Record<string, unknown> = {};

  // ── 1. La portada, para confirmar el diagnóstico con el conteo corregido ──
  const portada = await traer(`${RAIZ}/`);
  if (!portada.texto) {
    return NextResponse.json({
      error: 'La portada no respondió; nada más que hacer.',
      portada,
    });
  }

  paso.portada = {
    estado: portada.estado,
    bytes: portada.texto.length,
    normasEnCuerpo: normasEnCuerpo(portada.texto),
    esAplicacionJs: esAplicacionJs(portada.texto),
    lectura: esAplicacionJs(portada.texto)
      ? 'Aplicación JavaScript: el HTML no sirve, hay que ir al API que consume.'
      : 'HTML servido desde el servidor: se puede leer con un parser.',
  };

  // ── 2. Los bundles que carga la página ───────────────────────────────────
  const bundles = [
    ...new Set(
      [...portada.texto.matchAll(/(?:href|src)=["'](\/assets\/[^"']+\.js)["']/gi)].map(
        (m) => m[1],
      ),
    ),
  ].slice(0, 6); // los primeros bastan; no hay que descargar la app entera

  paso.bundles = bundles;

  // ── 3. Rutas de API escritas dentro del código ───────────────────────────
  // Se buscan literales de texto que parezcan endpoints. Es aproximado: el
  // bundle está minificado y las rutas pueden armarse por concatenación, así
  // que la ausencia de resultados NO prueba que no exista un API.
  const candidatas = new Set<string>();
  const patrones = [
    /["'](\/api\/[a-z0-9\-_/.{}$]+)["']/gi,
    /["'](https?:\/\/[a-z0-9.\-]*elperuano\.pe\/[^"']{0,120})["']/gi,
    /["'](\/[a-z0-9\-_]*(?:buscar|busqueda|search|normas|publicacion)[a-z0-9\-_/]*)["']/gi,
  ];

  for (const b of bundles) {
    const js = await traer(`${RAIZ}${b}`, 12_000);
    if (!js.texto) continue;
    for (const p of patrones) {
      for (const m of js.texto.matchAll(p)) {
        const ruta = m[1];
        // Descartar rutas de assets y basura corta.
        if (/\.(js|css|svg|png|jpe?g|woff2?|map)$/i.test(ruta)) continue;
        if (ruta.length < 6) continue;
        candidatas.add(ruta);
      }
    }
  }

  const rutas = [...candidatas].sort().slice(0, 60);
  paso.rutasEncontradas = rutas;

  // ── 4. Probar las más prometedoras ───────────────────────────────────────
  // Se prioriza lo que huela a búsqueda de normas y no tenga parámetros por
  // rellenar; probar una plantilla con {id} no diría nada.
  const prometedoras = rutas
    .filter((r) => r.startsWith('/api/') && !/[{}$:]/.test(r))
    .slice(0, 8);

  const pruebas = await Promise.all(
    prometedoras.map(async (ruta) => {
      const url = ruta.startsWith('http') ? ruta : `${RAIZ}${ruta}`;
      const r = await traer(url, 10_000);
      const esJson = (r.tipo ?? '').includes('json');
      return {
        url,
        estado: r.estado,
        tipo: r.tipo,
        esJson,
        // Un vistazo corto: suficiente para reconocer la forma de la respuesta.
        muestra: r.texto?.slice(0, 600) ?? null,
        error: r.error,
      };
    }),
  );

  paso.pruebasApi = pruebas;

  const sirveAlguna = pruebas.some((p) => p.estado === 200 && p.esJson);

  return NextResponse.json(
    {
      resumen: sirveAlguna
        ? 'Se encontró al menos un endpoint JSON que responde. Ese es el camino: leer datos, no raspar HTML.'
        : rutas.length > 0
          ? 'Se extrajeron rutas del código pero ninguna respondió JSON directamente. Revisar la lista a mano: puede que necesiten parámetros o método POST.'
          : 'No se pudieron extraer rutas de los bundles. El siguiente paso es mirar la pestaña Red del navegador en busquedas.elperuano.pe y anotar a qué URL llama la página al buscar.',
      redVerificada:
        'Vercel llega a El Peruano sin bloqueo (200 con y sin cabeceras, ambos hosts). Esa pregunta está cerrada.',
      probadoDesde: 'Vercel · región gru1 (AWS São Paulo)',
      ejecutadoEn: new Date().toISOString(),
      ...paso,
    },
    { status: 200 },
  );
}
