import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · ¿cómo se leen las normas del día? ─────────────────
//
// VUELTA 1 (cerrada): ¿deja Vercel leer El Peruano? SÍ, 200 sin bloqueo alguno.
//
// VUELTA 2 (cerrada): el buscador es una aplicación JavaScript hecha con React
// Router v7, así que su HTML podría llegar vacío. Los bundles no revelaron
// rutas de API porque el endpoint de datos es una convención del framework
// (`_root.data`), no un texto escrito en el código: buscarlo ahí era buscar lo
// que no podía estar.
//
// VUELTA 3 (esto): la pestaña Red del navegador dio las dos piezas que
// faltaban, y una es mejor de lo esperado:
//
//   /?ci=full&fecha=AAAAMMDD          ← el listado del día
//   /_root.data?ci=full&fecha=…       ← los mismos datos, crudos
//
// Poder pedir POR FECHA cambia el diseño del monitor: en vez de lanzar 56
// búsquedas (una por término), se trae lo publicado hoy en UNA petición y se
// filtra localmente contra los términos. Menos carga para El Peruano, más
// rápido, y sin riesgo de que un término se coma la cuota.
//
// Lo que decide esta sonda es CUÁL de las dos vías usar:
//
//   a) Si el HTML por fecha ya trae las normas, React Router está renderizando
//      en el servidor y leemos HTML. Es la vía más estable: el HTML público es
//      contrato con Google, y romperlo les costaría posicionamiento.
//   b) Si el HTML llega vacío, vamos a `_root.data`. Trae los datos limpios,
//      pero es un detalle interno del framework: puede cambiar de formato en
//      cualquier despliegue suyo, sin aviso.
//
// Es temporal: se borra cuando el lector esté escrito.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RAIZ = 'https://busquedas.elperuano.pe';

const NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
};

// El Peruano publica en hora de Lima. Pedir la fecha en UTC haría que entre
// las 19:00 y la medianoche de Lima se consultara el día siguiente, que aún no
// existe — y el monitor reportaría "sin novedades" justo en la corrida de la
// tarde.
function fechaLima(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return partes.replaceAll('-', ''); // AAAAMMDD
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
    return {
      estado: r.status,
      tipo: r.headers.get('content-type'),
      bytes: texto?.length ?? 0,
      texto,
      error: null as string | null,
    };
  } catch (e) {
    return {
      estado: null,
      tipo: null,
      bytes: 0,
      texto: null,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido',
    };
  }
}

// Señales de que hay normas de verdad, no metadatos de relleno. Se cuenta
// fuera del <head> por lo aprendido en la vuelta 2.
function señalesDeNormas(texto: string, esHtml: boolean) {
  const cuerpo = esHtml ? texto.replace(/<head[\s\S]*?<\/head>/i, '') : texto;
  return {
    // Códigos de publicación tipo 2538536-1: son el identificador estable de
    // cada norma y el mejor indicio de que hay contenido real.
    codigosPublicacion: (cuerpo.match(/\b25\d{5}-\d\b/g) ?? []).length,
    // Enlaces a normas individuales.
    enlacesDispositivo: (cuerpo.match(/\/dispositivo\/[A-Z]{2}\/[\d-]+/g) ?? []).length,
    tiposDeNorma: (
      cuerpo.match(/resoluci[óo]n ministerial|decreto supremo|resoluci[óo]n directoral/gi) ?? []
    ).length,
  };
}

export async function GET(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  // Permite forzar una fecha para depurar: /automatizaciones/sonda?fecha=20260730
  const fecha = new URL(request.url).searchParams.get('fecha') ?? fechaLima();

  const variantes = [
    { via: 'html', etiqueta: 'HTML del día', url: `${RAIZ}/?ci=full&fecha=${fecha}` },
    { via: 'datos', etiqueta: 'Datos del día', url: `${RAIZ}/_root.data?ci=full&fecha=${fecha}` },
    { via: 'datos', etiqueta: 'Datos del día (ci=all)', url: `${RAIZ}/_root.data?ci=all&fecha=${fecha}` },
  ];

  const resultados = await Promise.all(
    variantes.map(async (v) => {
      const r = await traer(v.url);
      // Misma forma en éxito y en fallo: así el resumen de abajo puede leer
      // `util` sin comprobar antes cuál de las dos ramas salió.
      if (!r.texto) {
        return {
          ...v,
          estado: r.estado,
          tipo: r.tipo,
          bytes: r.bytes,
          señales: null,
          util: false,
          muestra: null,
          error: r.error,
        };
      }
      const señales = señalesDeNormas(r.texto, v.via === 'html');
      const util = señales.codigosPublicacion > 3 || señales.enlacesDispositivo > 3;
      return {
        ...v,
        estado: r.estado,
        tipo: r.tipo,
        bytes: r.bytes,
        señales,
        util,
        // Trozo del medio, no del principio: el arranque de un HTML es todo
        // <head> y el de un payload de framework es andamiaje. El contenido
        // real vive más adentro.
        muestra: r.texto.slice(Math.floor(r.texto.length / 3), Math.floor(r.texto.length / 3) + 2500),
        error: null,
      };
    }),
  );

  const htmlSirve = resultados.find((r) => r.via === 'html')?.util === true;
  const datosSirven = resultados.some((r) => r.via === 'datos' && r.util === true);

  const recomendacion = htmlSirve
    ? 'USAR EL HTML por fecha. React Router renderiza en el servidor, así que el listado ya viene armado. Es la vía más estable: ese HTML es el que ve Google y no lo van a romper a la ligera.'
    : datosSirven
      ? 'USAR _root.data. El HTML llega vacío, pero el endpoint de datos responde. Advertencia: es un detalle interno del framework y puede cambiar de formato sin aviso en cualquier despliegue suyo; el lector tiene que fallar ruidosamente si el formato cambia, no en silencio.'
      : 'NINGUNA DE LAS DOS sirvió con esta fecha. Puede ser que hoy no haya publicaciones o que el parámetro sea otro. Reintentar con ?fecha=20260730, que es la fecha vista funcionando en el navegador.';

  return NextResponse.json(
    {
      recomendacion,
      fechaConsultada: fecha,
      zonaHoraria: 'America/Lima (El Peruano publica en hora local)',
      ejecutadoEn: new Date().toISOString(),
      resultados,
    },
    { status: 200 },
  );
}
