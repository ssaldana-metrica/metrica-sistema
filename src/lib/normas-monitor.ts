import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { enviarCorreoInterno, plantillaCorreo, escaparHtml } from '@/lib/correo';
import { traerNormasDelDia, fechaHoyLima } from '@/lib/el-peruano';
import {
  filtrarRelevantes,
  type TerminoVigilado,
  type NormaConCoincidencias,
} from '@/lib/normas-coincidencias';

// ── El monitor de normas legales ─────────────────────────────────────────────
//
// Lo que hace una corrida, en orden:
//
//   1. Se asegura de que la automatización esté encendida.
//   2. Abre una fila en el historial ANTES de trabajar, para que una caída
//      quede registrada y no desaparezca sin rastro.
//   3. Lee las normas legales del día en El Peruano.
//   4. Las compara contra los términos de cada cuenta.
//   5. Guarda las nuevas, salteando las que ya vio (por `op`).
//   6. Reparte a los destinatarios en grupos y le manda a cada uno lo que le
//      corresponde ver, con cada norma etiquetada según las cuentas que toca.
//   7. Recién cuando TODOS los correos salieron bien, las marca como avisadas.
//   8. Cierra la fila del historial.
//
// ── Por qué el orden 6-7 y no al revés ──────────────────────────────────────
// Marcar primero y enviar después sería más simple, pero si Resend falla las
// normas quedarían marcadas como avisadas sin que nadie las haya visto, y no
// habría forma de recuperarlas. Marcando al final, un fallo de correo deja los
// hallazgos pendientes y la siguiente corrida los reintenta sola.
//
// Por eso también el correo incluye TODO lo pendiente y no solo lo de hoy: si
// el envío del martes falló, el miércoles llega lo de ambos días.

const CLAVE = 'normas_legales';

/** A quién le llega todo cuando la automatización está en modo prueba. */
const CORREO_PRUEBA_MONITOR = 'ssaldana@metrica.pe';

export type ResultadoCorrida = {
  corrio: boolean;
  motivo?: string;
  fecha?: string;
  normasEncontradas?: number;
  normasRelevantes?: number;
  nuevas?: number;
  correo?: string;
};

type FilaPendiente = {
  id: string;
  tipo: string;
  numero: string;
  titulo: string;
  entidad: string;
  fecha_publicacion: string | null;
  url: string;
  resumen: string;
  etiquetas: { cuenta: string; terminos: string[] }[];
};

// ── Armado del correo ───────────────────────────────────────────────────────

function tarjetaNorma(n: FilaPendiente): string {
  const etiquetas = n.etiquetas
    .map(
      (e) =>
        `<span style="display:inline-block;background:#001830;color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:.08em;padding:3px 8px;border-radius:5px;margin-right:6px;">${escaparHtml(e.cuenta)}</span>`,
    )
    .join('');

  // Por qué se marcó: sin esto nadie puede juzgar si la coincidencia fue buena
  // ni darse cuenta de que un término está trayendo ruido.
  const porQue = n.etiquetas
    .map((e) => `${escaparHtml(e.cuenta)}: ${escaparHtml(e.terminos.join(', '))}`)
    .join(' · ');

  const encabezado = [n.tipo, n.numero].filter(Boolean).map(escaparHtml).join(' ');

  // La fecha va en cada tarjeta y no en la cabecera del correo: un mismo envío
  // puede traer normas de varios días si el correo de una corrida anterior
  // falló y estas quedaron pendientes.
  const fecha = n.fecha_publicacion
    ? `<div style="font-size:10px;color:#7C8898;margin-top:2px;">${escaparHtml(fechaIsoLegible(n.fecha_publicacion))}</div>`
    : '';

  return `
  <div style="border:1px solid #E6E8EA;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
    <div style="margin-bottom:8px;">${etiquetas}</div>
    ${encabezado ? `<div style="font-size:12px;font-weight:700;color:#001830;">${encabezado}</div>` : ''}
    ${n.entidad ? `<div style="font-size:11px;color:#7C8898;margin-top:2px;">${escaparHtml(n.entidad)}</div>` : ''}
    ${fecha}
    <div style="font-size:13px;line-height:1.5;color:#001830;margin-top:8px;">${escaparHtml(n.resumen || n.titulo)}</div>
    ${n.url ? `<div style="margin-top:10px;"><a href="${escaparHtml(n.url)}" style="font-size:12px;color:#C2683A;font-weight:600;">Ver el documento oficial →</a></div>` : ''}
    <div style="font-size:10px;color:#7C8898;margin-top:8px;font-family:monospace;">coincidió por — ${porQue}</div>
  </div>`;
}

function armarCorreo(pendientes: FilaPendiente[], esPrueba: boolean) {
  const cuentas = [...new Set(pendientes.flatMap((p) => p.etiquetas.map((e) => e.cuenta)))].sort();

  const aviso = esPrueba
    ? `<p style="background:#F6ECD2;color:#9A6A12;padding:10px 14px;border-radius:8px;font-family:monospace;font-size:11px;">
         MODO PRUEBA · este aviso solo se envió a ${escaparHtml(CORREO_PRUEBA_MONITOR)}.
         Apágalo en Automatizaciones para que llegue a toda la lista.
       </p>`
    : '';

  const cuerpo = `
    ${aviso}
    <p style="font-size:13px;color:#001830;margin:0 0 4px;">
      ${pendientes.length === 1 ? '1 norma' : `${pendientes.length} normas`}
      ${pendientes.length === 1 ? 'toca' : 'tocan'} ${cuentas.length === 1 ? 'la cuenta' : 'las cuentas'}
      <strong>${cuentas.map(escaparHtml).join('</strong>, <strong>')}</strong>.
    </p>
    <p style="font-size:11px;color:#7C8898;margin:0 0 18px;">
      Diario Oficial El Peruano · Normas Legales
    </p>
    ${pendientes.map(tarjetaNorma).join('')}`;

  const asunto = `Normas legales · ${cuentas.join(' + ')} · ${pendientes.length} ${
    pendientes.length === 1 ? 'norma' : 'normas'
  }`;

  // Lo que se lee en la bandeja junto al asunto, sin abrir el correo. Se
  // adelantan las primeras normas para poder decidir desde ahí si urge o no;
  // por defecto el gestor mostraría la primera línea del cuerpo, que cuando
  // hay modo prueba es el aviso amarillo y no dice nada del contenido.
  const vistaPrevia = pendientes
    .slice(0, 3)
    .map((p) => (p.entidad ? `${p.entidad}: ` : '') + (p.resumen || p.titulo))
    .join(' · ')
    .replace(/\s+/g, ' ')
    .slice(0, 200);

  return {
    asunto: esPrueba ? `[PRUEBA] ${asunto}` : asunto,
    html: plantillaCorreo('Monitor de normas legales', cuerpo, vistaPrevia),
  };
}

/** "2026-07-30" (como lo guarda la base) → "30/07/2026". */
function fechaIsoLegible(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// ── La corrida ──────────────────────────────────────────────────────────────

export async function correrMonitorNormas(
  fechaPedida?: string,
): Promise<ResultadoCorrida> {
  const db = crearClienteAdmin();
  const fecha = fechaPedida ?? fechaHoyLima();

  const { data: automatizacion } = await db
    .from('automatizaciones')
    .select('clave, activa, modo_prueba')
    .eq('clave', CLAVE)
    .maybeSingle();

  if (!automatizacion) {
    return { corrio: false, motivo: `No existe la automatización "${CLAVE}"` };
  }
  if (!automatizacion.activa) {
    // No se registra ejecución: una tarea apagada no "corrió", y anotarlo dos
    // veces al día llenaría el historial de ruido.
    return { corrio: false, motivo: 'La automatización está apagada' };
  }

  const esPrueba = automatizacion.modo_prueba === true;

  // Fila de historial abierta ANTES de trabajar: si el proceso muere a mitad,
  // queda con `fin` en nulo y eso se lee como "empezó y nunca terminó".
  const { data: ejecucion } = await db
    .from('automatizacion_ejecuciones')
    .insert({ automatizacion: CLAVE, estado: 'ok' })
    .select('id')
    .single();

  const cerrar = async (campos: Record<string, unknown>) => {
    if (ejecucion?.id) {
      await db
        .from('automatizacion_ejecuciones')
        .update({ fin: new Date().toISOString(), ...campos })
        .eq('id', ejecucion.id);
    }
    await db
      .from('automatizaciones')
      .update({
        ultima_corrida_en: new Date().toISOString(),
        ultimo_estado: campos.estado,
        ultimo_detalle: String(campos.error_detalle ?? ''),
      })
      .eq('clave', CLAVE);
  };

  try {
    // 1. Las normas del día.
    const { normas } = await traerNormasDelDia(fecha);

    // 2. Los términos vigilados, con su cuenta.
    const { data: filasTerminos } = await db
      .from('normas_legales_terminos')
      .select('id, cuenta_id, termino, sinonimos')
      .eq('activo', true);

    const terminos: TerminoVigilado[] = (filasTerminos ?? []).map((t) => ({
      id: t.id as string,
      cuentaId: t.cuenta_id as string,
      termino: t.termino as string,
      sinonimos: (t.sinonimos as string[] | null) ?? [],
    }));

    if (terminos.length === 0) {
      await cerrar({
        estado: 'error',
        normas_encontradas: normas.length,
        error_detalle: 'No hay términos vigilados activos: el monitor no puede filtrar nada.',
      });
      return { corrio: true, fecha, motivo: 'Sin términos vigilados' };
    }

    // 3. Qué toca a quién.
    const relevantes = filtrarRelevantes(normas, terminos);

    // 4. Guardar las que no se habían visto.
    const nuevas = await guardarHallazgos(db, relevantes);

    // 5. Enviar TODO lo pendiente (incluye reintentos de días anteriores).
    const pendientes = await leerPendientes(db);

    if (pendientes.length === 0) {
      await cerrar({
        estado: 'sin_novedades',
        normas_encontradas: normas.length,
        normas_relevantes: relevantes.length,
      });
      return {
        corrio: true,
        fecha,
        normasEncontradas: normas.length,
        normasRelevantes: 0,
        nuevas: 0,
      };
    }

    const grupos = await armarGrupos(db, esPrueba, pendientes);
    if (grupos.length === 0) {
      await cerrar({
        estado: 'error',
        normas_encontradas: normas.length,
        normas_relevantes: relevantes.length,
        error_detalle: 'Hay normas para avisar pero ningún destinatario activo.',
      });
      return { corrio: true, fecha, motivo: 'Sin destinatarios activos' };
    }

    const detalles: string[] = [];
    const fallos: string[] = [];

    for (const grupo of grupos) {
      const { asunto, html } = armarCorreo(grupo.pendientes, esPrueba);
      const envio = await enviarCorreoInterno({ para: grupo.correos, asunto, html });
      if (envio.enviado) detalles.push(envio.detalle);
      else fallos.push(`${grupo.etiqueta}: ${envio.detalle}`);
    }

    if (fallos.length > 0) {
      // Nada se marca como avisado: la próxima corrida reintenta.
      //
      // El precio es que si un grupo sí recibió el correo, mañana lo verá
      // repetido. Se acepta a propósito: una norma legal duplicada es una
      // molestia, una norma que nadie vio puede costar una oportunidad o una
      // multa. Ante la duda, repetir.
      await cerrar({
        estado: 'error',
        normas_encontradas: normas.length,
        normas_relevantes: relevantes.length,
        error_detalle: `No se pudo enviar a ${fallos.length} de ${grupos.length} grupos — ${fallos.join(' | ')}`,
      });
      return { corrio: true, fecha, motivo: fallos.join(' | ') };
    }

    const resumenEnvio = detalles.join(' | ');

    // 6. Recién ahora quedan avisadas.
    await db
      .from('normas_legales_hallazgos')
      .update({ notificado_en: new Date().toISOString() })
      .in('id', pendientes.map((p) => p.id));

    await cerrar({
      estado: 'ok',
      normas_encontradas: normas.length,
      normas_relevantes: relevantes.length,
      error_detalle: resumenEnvio,
    });

    return {
      corrio: true,
      fecha,
      normasEncontradas: normas.length,
      normasRelevantes: relevantes.length,
      nuevas,
      correo: resumenEnvio,
    };
  } catch (e) {
    const detalle = e instanceof Error ? `${e.name}: ${e.message}` : 'error desconocido';
    await cerrar({ estado: 'error', error_detalle: detalle });
    throw e;
  }
}

// ── Guardado, con defensa contra avisar dos veces ───────────────────────────

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>;

async function guardarHallazgos(
  db: ClienteAdmin,
  relevantes: NormaConCoincidencias[],
): Promise<number> {
  if (relevantes.length === 0) return 0;

  // El `op` de El Peruano identifica la publicación de forma estable, así que
  // sirve tal cual de defensa contra duplicados: el índice único de
  // hash_dedupe hace que la corrida de la tarde no reinserte lo de la mañana.
  const filas = relevantes.map(({ norma }) => ({
    hash_dedupe: norma.op,
    tipo: norma.tipoDispositivo,
    numero: norma.numeroDispositivo,
    titulo: norma.sumilla || `${norma.tipoDispositivo} ${norma.numeroDispositivo}`.trim(),
    entidad: norma.entidad,
    fecha_publicacion: fechaIso(norma.fechaPublicacion),
    url: norma.urlPdf || norma.urlFicha,
    resumen: norma.sumilla,
  }));

  const { data: insertadas, error } = await db
    .from('normas_legales_hallazgos')
    .upsert(filas, { onConflict: 'hash_dedupe', ignoreDuplicates: true })
    .select('id, hash_dedupe');

  if (error) throw new Error(`No se pudieron guardar los hallazgos: ${error.message}`);

  // Se releen TODOS (nuevos y ya existentes) porque hace falta el id para las
  // etiquetas, y `ignoreDuplicates` solo devuelve los recién insertados.
  const { data: todos } = await db
    .from('normas_legales_hallazgos')
    .select('id, hash_dedupe')
    .in('hash_dedupe', relevantes.map((r) => r.norma.op));

  const porHash = new Map((todos ?? []).map((f) => [f.hash_dedupe as string, f.id as string]));

  const etiquetas = relevantes.flatMap(({ norma, cuentas }) => {
    const hallazgoId = porHash.get(norma.op);
    if (!hallazgoId) return [];
    return cuentas.map((c) => ({
      hallazgo_id: hallazgoId,
      cuenta_id: c.cuentaId,
      terminos_detectados: c.terminos,
    }));
  });

  if (etiquetas.length > 0) {
    await db
      .from('normas_legales_hallazgo_cuenta')
      .upsert(etiquetas, { onConflict: 'hallazgo_id,cuenta_id', ignoreDuplicates: true });
  }

  return insertadas?.length ?? 0;
}

/** "20260730" → "2026-07-30", que es lo que espera una columna `date`. */
function fechaIso(aaaammdd: string): string | null {
  if (!/^\d{8}$/.test(aaaammdd)) return null;
  return `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6, 8)}`;
}

async function leerPendientes(db: ClienteAdmin): Promise<FilaPendiente[]> {
  const { data } = await db
    .from('normas_legales_hallazgos')
    .select(
      `id, tipo, numero, titulo, entidad, fecha_publicacion, url, resumen,
       normas_legales_hallazgo_cuenta ( terminos_detectados,
         normas_legales_cuentas ( nombre ) )`,
    )
    .is('notificado_en', null)
    .order('fecha_publicacion', { ascending: false });

  return (data ?? []).map((f) => {
    const puentes = (f.normas_legales_hallazgo_cuenta ?? []) as unknown as {
      terminos_detectados: string[] | null;
      normas_legales_cuentas: { nombre: string } | null;
    }[];

    return {
      id: f.id as string,
      tipo: (f.tipo as string) ?? '',
      numero: (f.numero as string) ?? '',
      titulo: (f.titulo as string) ?? '',
      entidad: (f.entidad as string) ?? '',
      fecha_publicacion: (f.fecha_publicacion as string) ?? null,
      url: (f.url as string) ?? '',
      resumen: (f.resumen as string) ?? '',
      etiquetas: puentes
        .map((p) => ({
          cuenta: p.normas_legales_cuentas?.nombre ?? '¿?',
          terminos: p.terminos_detectados ?? [],
        }))
        .sort((a, b) => a.cuenta.localeCompare(b.cuenta, 'es')),
    };
  });
}

/** Un correo a enviar: a quiénes va y con qué normas dentro. */
type GrupoEnvio = { etiqueta: string; correos: string[]; pendientes: FilaPendiente[] };

/**
 * Reparte los destinatarios en grupos según lo que a cada uno le corresponde
 * ver, y a cada grupo le arma SU propia lista de normas.
 *
 * Un destinatario sin cuenta asignada recibe el correo completo. Uno con
 * cuenta recibe únicamente las normas que tocan esa cuenta — no basta con
 * decidir SI le llega el correo, hay que recortarle el contenido, o alguien
 * suscrito solo a SPGL terminaría leyendo las normas eléctricas de KALLPA.
 */
async function armarGrupos(
  db: ClienteAdmin,
  esPrueba: boolean,
  pendientes: FilaPendiente[],
): Promise<GrupoEnvio[]> {
  // En modo prueba no se consulta la lista siquiera: así no hay manera de que
  // un correo de prueba se escape a los demás por un descuido.
  if (esPrueba) {
    return [{ etiqueta: 'prueba', correos: [CORREO_PRUEBA_MONITOR], pendientes }];
  }

  const { data } = await db
    .from('normas_legales_destinatarios')
    .select('correo, cuenta_id, normas_legales_cuentas ( nombre )')
    .eq('activo', true);

  const todos: string[] = [];
  const porCuenta = new Map<string, string[]>();

  for (const d of data ?? []) {
    const correo = d.correo as string;
    if (!d.cuenta_id) {
      todos.push(correo);
      continue;
    }
    const nombre = (d.normas_legales_cuentas as unknown as { nombre: string } | null)?.nombre;
    if (!nombre) continue; // cuenta borrada: sin ella no se sabe qué mandarle
    if (!porCuenta.has(nombre)) porCuenta.set(nombre, []);
    porCuenta.get(nombre)!.push(correo);
  }

  const grupos: GrupoEnvio[] = [];

  if (todos.length > 0) {
    grupos.push({ etiqueta: 'lista completa', correos: todos, pendientes });
  }

  for (const [cuenta, correos] of porCuenta) {
    const suyas = pendientes.filter((p) => p.etiquetas.some((e) => e.cuenta === cuenta));
    // Si esta tanda no trae nada de su cuenta, no se le escribe.
    if (suyas.length > 0) grupos.push({ etiqueta: cuenta, correos, pendientes: suyas });
  }

  return grupos;
}
