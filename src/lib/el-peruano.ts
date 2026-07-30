import 'server-only';
import { decodificarTurboStream, ErrorTurboStream } from '@/lib/turbo-stream';

// ── Lector del diario oficial El Peruano ─────────────────────────────────────
//
// De dónde salen los datos: el buscador (busquedas.elperuano.pe) es una
// aplicación React Router v7. Su HTML no sirve — llega sin contenido — pero
// cada ruta tiene una gemela de datos, y esa sí devuelve los registros.
//
//   /_root.data?ci=all&fecha=AAAAMMDD&tipoPublicacion=NL
//
// Los tres parámetros importan:
//   ci=all              sin esto no devuelve publicaciones
//   fecha               en formato AAAAMMDD, hora de Lima
//   tipoPublicacion=NL  el filtro que de verdad funciona
//
// Ojo con `rubro=NL`: el servidor lo ACEPTA y lo devuelve en el eco de
// parámetros, pero lo IGNORA — sigue entregando Boletín Oficial. No usarlo.
//
// Volumen real: un día hábil trae del orden de 7 normas legales, frente a ~573
// publicaciones si no se filtra (casi todas sucesiones intestadas del Boletín).
// Por eso conviene traer el día completo y filtrar aquí, en vez de lanzar una
// búsqueda por cada término vigilado.
//
// ── Fragilidad conocida ─────────────────────────────────────────────────────
// Esto lee un formato interno de El Peruano, no un API público con contrato.
// Pueden cambiarlo sin avisar. Todo lo que se valida acá LANZA excepción en
// lugar de devolver una lista vacía: una lista vacía se confundiría con "hoy
// no se publicó nada relevante", y el monitor callaría justo cuando falla.

const RAIZ = 'https://busquedas.elperuano.pe';

// Tope de seguridad: si algún día la paginación se rompe y `hasNext` viene
// siempre en true, esto evita un bucle infinito dentro de la función serverless.
const MAX_PAGINAS = 20;

export class ErrorElPeruano extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = 'ErrorElPeruano';
  }
}

/** Una publicación del diario, tal como la entrega El Peruano. */
export type NormaPublicada = {
  /** Identificador estable de la publicación, p. ej. "2538536-1". */
  op: string;
  /** Fecha en formato AAAAMMDD. */
  fechaPublicacion: string;
  /** "RESOLUCIÓN MINISTERIAL", "ORDENANZA", … Puede venir vacío. */
  tipoDispositivo: string;
  /** "N° 418-2026-MINEDU". Puede venir vacío. */
  numeroDispositivo: string;
  /** La entidad que publica. En el payload se llama `distributor`. */
  entidad: string;
  /** El resumen de la norma. Es el texto más útil para buscar coincidencias. */
  sumilla: string;
  /** Enlace absoluto al PDF oficial. */
  urlPdf: string;
  /** Enlace absoluto a la ficha en el buscador. */
  urlFicha: string;
};

/**
 * La fecha de hoy en Lima, en el formato que espera El Peruano.
 *
 * Se calcula en hora local y no en UTC a propósito: El Peruano publica en
 * horario peruano, y entre las 19:00 y la medianoche de Lima el UTC ya cayó al
 * día siguiente. La corrida de la tarde pediría un día que todavía no existe y
 * reportaría "sin novedades" todos los días sin que nadie lo notara.
 */
export function fechaHoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replaceAll('-', '');
}

// El payload anida los resultados bajo el nombre de la ruta de React Router
// ("routes/_index"), que es un detalle interno y puede cambiar al reorganizar
// ellos su código. Buscar el primer bloque que tenga `hits` sobrevive a eso.
function buscarBloqueResultados(
  nodo: unknown,
  profundidad = 0,
): Record<string, unknown> | null {
  if (profundidad > 8 || nodo === null || typeof nodo !== 'object') return null;
  const obj = nodo as Record<string, unknown>;
  if (Array.isArray(obj.hits)) return obj;
  for (const hijo of Object.values(obj)) {
    const hallado = buscarBloqueResultados(hijo, profundidad + 1);
    if (hallado) return hallado;
  }
  return null;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function normalizarRegistro(bruto: Record<string, unknown>): NormaPublicada | null {
  const op = texto(bruto.op);
  // Sin identificador no hay forma de evitar avisar dos veces de lo mismo, así
  // que ese registro no sirve. Se descarta en silencio: es un dato suelto malo,
  // no una señal de que el formato cambió.
  if (!op) return null;

  const rutaPdf = texto(bruto.urlPDF);

  return {
    op,
    fechaPublicacion: texto(bruto.fechaPublicacion),
    tipoDispositivo: texto(bruto.tipoDispositivo),
    numeroDispositivo: texto(bruto.numeroDispositivo),
    // En el payload la entidad se llama `distributor`. Se renombra aquí para
    // que el resto del sistema no herede un nombre que no significa nada.
    entidad: texto(bruto.distributor),
    sumilla: texto(bruto.sumilla),
    urlPdf: rutaPdf ? `${RAIZ}${rutaPdf}` : '',
    urlFicha: `${RAIZ}/dispositivo/NL/${op}`,
  };
}

async function traerPagina(fecha: string, inicio: number) {
  const url = `${RAIZ}/_root.data?ci=all&fecha=${fecha}&tipoPublicacion=NL&start=${inicio}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    throw new ErrorElPeruano(`No se pudo consultar El Peruano (${url})`, { cause: e });
  }

  if (!respuesta.ok) {
    throw new ErrorElPeruano(
      `El Peruano respondió ${respuesta.status} al pedir la fecha ${fecha}`,
    );
  }

  let arbol: unknown;
  try {
    arbol = decodificarTurboStream(await respuesta.text());
  } catch (e) {
    if (e instanceof ErrorTurboStream) {
      throw new ErrorElPeruano(
        `El Peruano cambió el formato de su respuesta: ${e.message}`,
        { cause: e },
      );
    }
    throw e;
  }

  const bloque = buscarBloqueResultados(arbol);
  if (!bloque) {
    throw new ErrorElPeruano(
      'La respuesta de El Peruano no trae el bloque de resultados esperado (sin `hits`)',
    );
  }

  const hits = (bloque.hits as unknown[]).filter(
    (h): h is Record<string, unknown> => h !== null && typeof h === 'object',
  );

  return {
    normas: hits.map(normalizarRegistro).filter((n): n is NormaPublicada => n !== null),
    hayMas: bloque.hasNext === true,
    total: typeof bloque.totalHits === 'number' ? bloque.totalHits : null,
  };
}

/**
 * Trae todas las normas legales publicadas en una fecha.
 *
 * @param fecha AAAAMMDD. Por defecto, hoy en hora de Lima.
 * @throws {ErrorElPeruano} Si no responde o si cambió el formato. Nunca
 *   devuelve una lista vacía por error: vacío significa "no se publicó nada".
 */
export async function traerNormasDelDia(
  fecha: string = fechaHoyLima(),
): Promise<{ normas: NormaPublicada[]; total: number | null }> {
  if (!/^\d{8}$/.test(fecha)) {
    throw new ErrorElPeruano(`Fecha inválida "${fecha}": se esperaba AAAAMMDD`);
  }

  const normas: NormaPublicada[] = [];
  const vistos = new Set<string>();
  let inicio = 0;
  let total: number | null = null;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const resultado = await traerPagina(fecha, inicio);
    if (total === null) total = resultado.total;

    // Si una página repite lo de la anterior, la paginación está mal y seguir
    // pidiendo solo acumularía duplicados. Mejor cortar.
    const nuevas = resultado.normas.filter((n) => !vistos.has(n.op));
    for (const n of nuevas) vistos.add(n.op);
    normas.push(...nuevas);

    if (!resultado.hayMas || nuevas.length === 0) return { normas, total };
    inicio += 20; // `paginatedBy` del propio payload
  }

  throw new ErrorElPeruano(
    `La paginación no terminó tras ${MAX_PAGINAS} páginas; probablemente cambió el formato`,
  );
}
