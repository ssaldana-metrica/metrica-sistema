import 'server-only';

// ── Decodificador de turbo-stream ───────────────────────────────────────────
//
// El buscador de El Peruano está hecho con React Router v7, que devuelve los
// datos de sus rutas en este formato. No es JSON normal: es un arreglo PLANO
// donde los valores se referencian por posición, para no repetir textos que
// aparecen muchas veces (los nombres de campo, sobre todo).
//
// Cómo se lee:
//
//   [ {"_1":2}, "titulo", "Decreto Supremo N° 001" ]
//     └ raíz     └ pos 1   └ pos 2
//
//   La raíz está en la posición 0. {"_1":2} significa "un objeto cuya clave
//   está en la posición 1 y cuyo valor está en la posición 2", o sea
//   { titulo: "Decreto Supremo N° 001" }.
//
//   Los arreglos guardan posiciones, no valores: [33,34] son las posiciones 33
//   y 34, no los números 33 y 34.
//
//   Los negativos son constantes, no posiciones (ver CONSTANTES abajo).
//
// ── Por qué propio y no la librería ─────────────────────────────────────────
// El paquete `turbo-stream` existe, pero va por la versión 3 y React Router v7
// emite el formato de la versión 2, con API distinta. Son cuarenta líneas;
// preferible tenerlas a la vista que atar el proyecto a una versión que puede
// dejar de calzar en cualquier actualización suya.
//
// ── Falla ruidosa, a propósito ──────────────────────────────────────────────
// Esto lee un formato interno de El Peruano que pueden cambiar sin avisar. Si
// cambia, la función LANZA una excepción en vez de devolver datos a medias.
// Un monitor que deja de encontrar normas en silencio es peor que uno caído:
// el silencio se confunde con "no hubo nada que reportar".

// Posiciones negativas reservadas por el formato para valores que no se pueden
// guardar en JSON.
const CONSTANTES: Record<number, unknown> = {
  [-1]: undefined, // hueco de un arreglo disperso
  [-2]: NaN,
  [-3]: -Infinity,
  [-4]: -0,
  [-5]: null,
  [-6]: Infinity,
  [-7]: undefined,
};

export class ErrorTurboStream extends Error {
  constructor(mensaje: string) {
    super(`Formato de El Peruano inesperado: ${mensaje}`);
    this.name = 'ErrorTurboStream';
  }
}

/**
 * Convierte el payload crudo de una ruta `.data` en un objeto normal.
 *
 * @param crudo Texto tal como lo devuelve El Peruano.
 * @throws {ErrorTurboStream} Si el formato no es el esperado.
 */
export function decodificarTurboStream(crudo: string): unknown {
  // El formato puede venir en varias líneas cuando la respuesta es diferida.
  // La primera trae el árbol principal, que es lo único que se necesita aquí.
  const primeraLinea = crudo.split('\n', 1)[0];

  let plano: unknown;
  try {
    plano = JSON.parse(primeraLinea);
  } catch {
    throw new ErrorTurboStream('la respuesta no es JSON válido');
  }

  if (!Array.isArray(plano)) {
    throw new ErrorTurboStream('se esperaba un arreglo en la raíz');
  }
  if (plano.length === 0) {
    throw new ErrorTurboStream('el arreglo llegó vacío');
  }

  // Memoria de lo ya resuelto: evita trabajo repetido y, sobre todo, evita
  // colgarse si el grafo tiene ciclos (un objeto que se referencia a sí mismo).
  const resueltos = new Map<number, unknown>();

  const resolver = (posicion: number): unknown => {
    if (posicion < 0) {
      if (posicion in CONSTANTES) return CONSTANTES[posicion];
      throw new ErrorTurboStream(`constante desconocida ${posicion}`);
    }
    if (posicion >= plano.length) {
      throw new ErrorTurboStream(
        `referencia a la posición ${posicion}, fuera de un arreglo de ${plano.length}`,
      );
    }
    if (resueltos.has(posicion)) return resueltos.get(posicion);

    const valor = (plano as unknown[])[posicion];

    // Texto, número, booleano y null se devuelven tal cual.
    if (valor === null || typeof valor !== 'object') {
      resueltos.set(posicion, valor);
      return valor;
    }

    if (Array.isArray(valor)) {
      // Los elementos son posiciones, no valores.
      const salida: unknown[] = [];
      resueltos.set(posicion, salida); // antes de recorrer, por los ciclos
      for (const ref of valor) {
        if (typeof ref !== 'number') {
          throw new ErrorTurboStream('un arreglo trae algo que no es una posición');
        }
        salida.push(resolver(ref));
      }
      return salida;
    }

    // Objeto: cada clave es "_" + la posición donde está el nombre del campo,
    // y cada valor es la posición donde está su contenido.
    const salida: Record<string, unknown> = {};
    resueltos.set(posicion, salida);
    for (const [claveCruda, refValor] of Object.entries(valor)) {
      if (!claveCruda.startsWith('_')) {
        throw new ErrorTurboStream(`clave "${claveCruda}" sin el prefijo esperado`);
      }
      const posClave = Number(claveCruda.slice(1));
      if (!Number.isInteger(posClave)) {
        throw new ErrorTurboStream(`clave "${claveCruda}" no apunta a una posición`);
      }
      const nombre = resolver(posClave);
      if (typeof nombre !== 'string') {
        throw new ErrorTurboStream(
          `el nombre de un campo resultó ${typeof nombre} en vez de texto`,
        );
      }
      if (typeof refValor !== 'number') {
        throw new ErrorTurboStream(`el campo "${nombre}" no apunta a una posición`);
      }
      salida[nombre] = resolver(refValor);
    }
    return salida;
  };

  return resolver(0);
}
