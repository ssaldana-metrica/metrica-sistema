import type { NormaPublicada } from '@/lib/el-peruano';

// ── Detectar qué normas importan y a qué cuenta ──────────────────────────────
//
// Cada cuenta monitoreada (KALLPA, SPGL) tiene su lista de términos. Una norma
// puede tocar a varias: MINEM y OSINERGMIN están a propósito en las dos listas,
// así que una resolución de cualquiera de ellos se etiqueta con AMBAS.
//
// ── Contra qué se busca ─────────────────────────────────────────────────────
// El Peruano no entrega el texto completo de la norma, solo la sumilla (un
// resumen de una o dos líneas), más la entidad, el tipo y el número. Se busca
// sobre todo eso junto.
//
// Esto tiene un límite real que conviene tener presente: una norma cuyo cuerpo
// hable de gas natural pero cuya sumilla no lo mencione NO se detecta. La
// defensa contra eso es vigilar también las entidades — cualquier norma de
// MINEM u OSINERGMIN entra por el nombre de quien la publica, sin depender de
// cómo esté redactado el resumen.
//
// ── Por qué normalizar ──────────────────────────────────────────────────────
// El diario mezcla mayúsculas, minúsculas y tildes sin criterio fijo: escribe
// "Diésel B5" en una sumilla y "DIESEL" en otra. Comparar el texto crudo
// perdería coincidencias evidentes, así que todo se lleva a minúsculas sin
// tildes antes de comparar.

/** Un término vigilado, con las otras formas en que puede aparecer escrito. */
export type TerminoVigilado = {
  id: string;
  cuentaId: string;
  termino: string;
  sinonimos: string[];
};

export type CoincidenciaPorCuenta = {
  cuentaId: string;
  /** Los términos PRINCIPALES que coincidieron, nunca los sinónimos. */
  terminos: string[];
};

export type NormaConCoincidencias = {
  norma: NormaPublicada;
  cuentas: CoincidenciaPorCuenta[];
};

/**
 * Minúsculas y sin tildes, para que "Diésel", "diesel" y "DIÉSEL" se comparen
 * igual. La ñ se conserva: quitarla juntaría palabras que no son la misma.
 */
// NFD separa cada letra de su acento. Se borran los acentos sueltos —el rango
// U+0300 a U+036F— EXCEPTO U+0303, la virgulilla de la ñ: en español la ñ es
// una letra distinta de la n, no una n acentuada, y confundirlas uniría
// palabras que no significan lo mismo.
//
// Se construye con RegExp y una cadena en vez de escribirlo como literal
// /[...]/ porque los caracteres combinantes son INVISIBLES en el editor: en el
// literal no hay forma de revisar a ojo si el rango es el correcto, y la
// primera versión de esta función se comía la ñ sin que se notara.
const ACENTOS_SIN_VIRGULILLA = new RegExp('[\\u0300-\\u0302\\u0304-\\u036f]', 'g');

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(ACENTOS_SIN_VIRGULILLA, '').toLowerCase();
}

const escaparRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Construye el buscador de un término. Exige límites de palabra para que
 * siglas cortas no aparezcan dentro de otras palabras: sin esto, "GNL" saltaría
 * dentro de cualquier texto que la contuviera por casualidad.
 *
 * Los límites se calculan sobre el texto ya normalizado.
 */
function comoRegex(frase: string): RegExp | null {
  const limpia = normalizar(frase).trim().replace(/\s+/g, ' ');
    if (!limpia) return null;
  // \b no funciona junto a caracteres no ASCII como la ñ, así que se usan
  // miradas alrededor que exigen que lo pegado no sea letra ni dígito.
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaparRegex(limpia)}(?![\\p{L}\\p{N}])`,
    'u',
  );
}

/** El texto de una norma sobre el que tiene sentido buscar. */
export function textoBuscable(norma: NormaPublicada): string {
  return normalizar(
    [norma.sumilla, norma.entidad, norma.tipoDispositivo, norma.numeroDispositivo]
      .filter(Boolean)
      .join(' · '),
  );
}

/**
 * Revisa una norma contra todos los términos y devuelve, por cuenta, cuáles
 * coincidieron. Si no coincide nada, devuelve un arreglo vacío.
 */
export function coincidenciasDeNorma(
  norma: NormaPublicada,
  terminos: TerminoVigilado[],
): CoincidenciaPorCuenta[] {
  const texto = textoBuscable(norma);
  const porCuenta = new Map<string, Set<string>>();

  for (const t of terminos) {
    // El término principal y sus sinónimos son formas del MISMO concepto: basta
    // que una aparezca, y siempre se reporta el principal.
    const formas = [t.termino, ...t.sinonimos];
    const coincide = formas.some((forma) => comoRegex(forma)?.test(texto) ?? false);
    if (!coincide) continue;

    if (!porCuenta.has(t.cuentaId)) porCuenta.set(t.cuentaId, new Set());
    porCuenta.get(t.cuentaId)!.add(t.termino);
  }

  return [...porCuenta.entries()].map(([cuentaId, terminos]) => ({
    cuentaId,
    // Orden estable: el mismo hallazgo se ve igual en la pantalla y en el
    // correo, sin depender del orden en que se recorrieron los términos.
    terminos: [...terminos].sort((a, b) => a.localeCompare(b, 'es')),
  }));
}

/** Filtra una tanda de normas y deja solo las que tocan alguna cuenta. */
export function filtrarRelevantes(
  normas: NormaPublicada[],
  terminos: TerminoVigilado[],
): NormaConCoincidencias[] {
  const relevantes: NormaConCoincidencias[] = [];
  for (const norma of normas) {
    const cuentas = coincidenciasDeNorma(norma, terminos);
    if (cuentas.length > 0) relevantes.push({ norma, cuentas });
  }
  return relevantes;
}
