import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/auth';

// ── Sonda de diagnóstico · ¿se puede leer El Peruano DESDE EL SERVIDOR? ──────
//
// Por qué existe: la misma página responde distinto según quién la pida. Desde
// una laptop con navegador devuelve 200; desde un servidor llegó 403. Importa
// porque el monitor va a correr en un datacenter, no en una laptop.
//
// ── Dónde se prueba y por qué aquí ──────────────────────────────────────────
// La arquitectura acordada es que GitHub Actions solo DISPARA (un POST con el
// secreto compartido) y todo el trabajo — leer El Peruano, clasificar, enviar
// el correo — ocurre en Vercel. Por eso esta sonda vive en Vercel: corre en la
// misma red, región e infraestructura que el monitor real, así que su
// resultado es autoritativo.
//
// Si algún día el trabajo se mudara a que la Action haga el fetch ella misma,
// esta sonda dejaría de decir nada útil: los runners de GitHub salen por IPs
// de Azure en EE. UU., no por AWS São Paulo (gru1) como Vercel. Habría que
// reproducir la prueba dentro de un runner.
//
// Es temporal: se borra al cerrar la Etapa 0.
//
// Uso: entrar a /automatizaciones/sonda logueado como gerencia.

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
  cabeceras: 'navegador' | 'ninguna';
  estado: number | null;
  bytes: number | null;
  mencionesNormas: number | null; // ¿el HTML ya trae contenido o lo arma JS?
  muestra: string | null;
  error: string | null;
};

async function probar(url: string, conCabeceras: boolean): Promise<Intento> {
  const r: Intento = {
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
      signal: AbortSignal.timeout(20_000),
    });

    r.estado = respuesta.status;
    if (!respuesta.ok) return r;

    const html = await respuesta.text();
    r.bytes = html.length;
    r.mencionesNormas = (
      html.match(
        /decreto supremo|resoluci[óo]n ministerial|resoluci[óo]n directoral|normas legales/gi,
      ) ?? []
    ).length;
    r.muestra = html.slice(0, 1500);
  } catch (e) {
    r.error = e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido';
  }

  return r;
}

// Tres desenlaces posibles, no dos. La diferencia entre el 2 y el 3 es la que
// decide si el proyecto sigue derecho o cambia de enfoque.
function diagnosticar(sinCabeceras: Intento, conCabeceras: Intento) {
  const okSin = sinCabeceras.estado === 200;
  const okCon = conCabeceras.estado === 200;

  if (okSin) {
    return {
      caso: 1,
      titulo: 'LIBRE — responde incluso sin disfraz',
      detalle:
        'El host contesta 200 a una petición pelada desde Vercel. No hay filtrado que sortear.',
    };
  }
  if (okCon) {
    return {
      caso: 2,
      titulo: 'FILTRADO POR USER-AGENT — se resuelve con cabeceras',
      detalle:
        'Sin cabeceras rebota, con cabeceras de navegador pasa. El bloqueo mira el User-Agent, no la IP. El lector funcionará mandando estas mismas cabeceras.',
    };
  }
  return {
    caso: 3,
    titulo: 'BLOQUEADO — y esta sonda NO puede decir por qué',
    detalle:
      'Rebota con y sin cabeceras. Las dos causas posibles son reputación de IP de datacenter y huella TLS/HTTP (el fetch de Node no se ve como un navegador ante un WAF por mucho que se le pongan las cabeceras correctas). Distinguirlas requiere más evidencia; no asumir cuál es. Ver "alternativas" en esta misma respuesta.',
  };
}

const ALTERNATIVAS_CASO_3 = [
  'Comparar host por host: busquedas.elperuano.pe y elperuano.pe pueden estar tras protecciones distintas. Si uno pasa, se usa ese.',
  'La edición PDF diaria de Normas Legales: un archivo estático suele servirse por otra ruta que el buscador dinámico. Exigiría leer PDF en vez de HTML (@react-pdf/renderer del proyecto genera, no lee; haría falta otra librería).',
  '¿Hay RSS o feed oficial? No darlo por hecho: verificarlo.',
  'Fuentes alternativas del mismo dato: SPIJ del MINJUS, y los portales de MINEM y OSINERGMIN, que además son las entidades que más pesan para KALLPA y SPGL.',
  'Vía API de búsqueda en lugar de scraping directo (p. ej. la cuenta de Serper que ya se usa en otro proyecto).',
  'ANTES de insistir disfrazando la petición: si El Peruano bloquea servidores a propósito, martillar dos veces al día puede endurecer el bloqueo sobre una IP de Vercel COMPARTIDA con el sistema de cotizaciones. Conviene buscar canal oficial o feed antes de escalar por ahí.',
];

export async function GET() {
  // Diagnóstico interno: solo gerencia. Devuelve 404 y no 403 para no
  // confirmarle a nadie más que esta ruta existe.
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.rol !== 'gerencia') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const hosts = ['https://busquedas.elperuano.pe/', 'https://elperuano.pe/'];

  // Cada host se evalúa por separado y con las dos variantes: pueden estar
  // detrás de protecciones distintas y basta con que uno sirva.
  const resultados = await Promise.all(
    hosts.map(async (url) => {
      const [sinCabeceras, conCabeceras] = await Promise.all([
        probar(url, false),
        probar(url, true),
      ]);
      const diagnostico = diagnosticar(sinCabeceras, conCabeceras);
      const trae = (conCabeceras.mencionesNormas ?? 0) > 3;
      return {
        url,
        diagnostico,
        // Solo tiene sentido preguntarse por el contenido si algo respondió.
        contenido:
          diagnostico.caso === 3
            ? 'no evaluable (no hubo respuesta)'
            : trae
              ? 'el HTML ya trae las normas: se puede leer con un parser normal'
              : 'el HTML llega sin contenido: probablemente lo arma JavaScript y haría falta un navegador automatizado',
        intentos: { sinCabeceras, conCabeceras },
      };
    }),
  );

  // Caso 1 es el mejor desenlace y 3 el peor, así que el mínimo es el mejor
  // host disponible: basta con que UNO sirva para que el proyecto siga.
  const mejorCaso = Math.min(...resultados.map((r) => r.diagnostico.caso));
  const bloqueadoTodo = resultados.every((r) => r.diagnostico.caso === 3);

  return NextResponse.json(
    {
      resumen: bloqueadoTodo
        ? 'Ningún host de El Peruano responde a Vercel. Hay que evaluar las alternativas antes de seguir.'
        : `Al menos un host es utilizable desde Vercel (mejor caso: ${mejorCaso}).`,
      probadoDesde: 'Vercel · región gru1 (AWS São Paulo)',
      ejecutadoEn: new Date().toISOString(),
      resultados,
      ...(bloqueadoTodo ? { alternativas: ALTERNATIVAS_CASO_3 } : {}),
    },
    { status: 200 },
  );
}
