// Lógica compartida de la tabla de control (sin estado de cliente ni servidor).

// Estado del proceso (cotización → ficha → ODA). Se DERIVA al leer, nunca se
// guarda, y es SOLO de estado (jamás financiero).
export type EstadoProc = 'apertura' | 'en_proceso' | 'cerrado' | 'anulado';

// Reglas:
//  - anulado:    la ficha está anulada (cascada).
//  - apertura:   ficha en proceso (recién creada).
//  - en_proceso: ficha lista del ejecutivo; o completa pero sin todas sus ODA
//                emitidas (o sin ninguna ODA todavía).
//  - cerrado:    ficha completa Y tiene ODA y todas están emitidas.
export function estadoProceso(
  estadoFicha: string,
  odas: { estado: string }[],
): EstadoProc {
  if (estadoFicha === 'anulada') return 'anulado';
  if (estadoFicha === 'en_proceso') return 'apertura';
  if (estadoFicha === 'lista_ejecutivo') return 'en_proceso';
  if (odas.length > 0 && odas.every((o) => o.estado === 'emitida'))
    return 'cerrado';
  return 'en_proceso';
}

export const ESTILO_PROC: Record<EstadoProc, { clase: string; etiqueta: string }> = {
  apertura: { clase: 'bg-ambar-fondo text-ambar', etiqueta: 'Apertura' },
  en_proceso: { clase: 'bg-azul-fondo text-azul', etiqueta: 'En proceso' },
  cerrado: { clase: 'bg-verde-fondo text-verde', etiqueta: 'Cerrado' },
  anulado: { clase: 'bg-rojo-fondo text-rojo', etiqueta: 'Anulado' },
};

export const fechaCorta = (iso: string | null) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    : '—';

// Datos editables de control por proveedor (zona derecha).
export type ControlFila = {
  nContrato: string;
  facturaProveedor: string;
  ocOsCliente: string;
  facturaCliente: string;
  fechaFacturacion: string | null;
  fechaCobro: string | null;
};

export const controlVacio = (): ControlFila => ({
  nContrato: '',
  facturaProveedor: '',
  ocOsCliente: '',
  facturaCliente: '',
  fechaFacturacion: null,
  fechaCobro: null,
});
