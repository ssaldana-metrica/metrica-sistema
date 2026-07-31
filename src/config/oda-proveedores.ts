// ⚠️ REGLAS DE LAS ODA DE PROVEEDORES (gasto propio de la oficina).
//
// Estas órdenes no cuelgan de ninguna ficha ni cotización: se crean sueltas
// para suscripciones, corresponsales, servicios de oficina y demás gasto de la
// casa. Todo lo configurable de ese módulo vive acá.

export const TIPOS_PROVEEDOR_ODA = [
  'suscripciones',
  'corresponsales',
  'vinculadas',
  'servicios_oficina',
  'otros',
  'bienes',
] as const;

export type TipoProveedorOda = (typeof TIPOS_PROVEEDOR_ODA)[number];

// Cómo se escribe cada uno en pantalla y en el PDF.
export const ETIQUETA_TIPO_PROVEEDOR: Record<TipoProveedorOda, string> = {
  suscripciones: 'Suscripciones',
  corresponsales: 'Corresponsales',
  vinculadas: 'Vinculadas',
  servicios_oficina: 'Servicios de oficina',
  otros: 'Otros',
  bienes: 'Bienes',
};

// ── Monto mínimo para emitir ────────────────────────────────────────────────
//
// Estas órdenes existen para el gasto que vale la pena documentar; por debajo
// del mínimo no se emite ODA.
//
// Se mide SIN IGV. Si se midiera con IGV, un proveedor con factura cruzaría el
// límite en S/ 593 y uno con recibo por honorarios necesitaría S/ 700 — la
// misma compra permitida o bloqueada según qué comprobante emita, que no tiene
// sentido. Sin IGV es además la cifra que la lista muestra como monto.
//
// El mínimo en dólares es un número FIJO, no una conversión. El sistema no
// tiene tipo de cambio en ninguna parte, y convertir en vivo haría que una
// orden que ayer pasaba hoy se bloquee porque se movió el dólar. A ~3,70 los
// S/ 700 son unos US$ 189; se redondea a 200 para dejar margen. Si el tipo de
// cambio se mueve mucho, cambiar este número.
export const MINIMO_ODA_PROVEEDOR = {
  PEN: 700,
  USD: 200,
} as const;

export function montoAlcanzaMinimo(monto: number, moneda: 'PEN' | 'USD'): boolean {
  return monto >= MINIMO_ODA_PROVEEDOR[moneda];
}

export function textoMinimo(moneda: 'PEN' | 'USD'): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  return `${simbolo} ${MINIMO_ODA_PROVEEDOR[moneda].toLocaleString('es-PE')}`;
}

// ── Cláusulas del PDF ───────────────────────────────────────────────────────
//
// ⚠️ REVISAR CON CONTABILIDAD antes de darlas por definitivas. Acá se ajustó lo
// que claramente no correspondía; lo tributario debe confirmarlo quien lleva
// los libros.
//
// Por qué no se reutilizan las de proyecto (`CLAUSULAS_ODA`): la primera de
// aquellas dice «Código 022 para servicios de influencers». Estas órdenes son
// para suscripciones de software, corresponsales y servicios de oficina, donde
// esa instrucción no viene al caso y, peor, sugiere consignar un código que
// puede no ser el correcto. Se reemplaza por una redacción general que remite
// a la naturaleza real de la operación.
//
// Lo que SÍ se conserva, porque aplica igual en los dos casos:
//   · el número de orden obligatorio en el comprobante
//   · el envío exclusivo a facturas@metrica.pe
//   · la retención de cuarta categoría en Recibos por Honorarios, que es
//     frecuente acá: muchos corresponsales facturan como persona natural
//
// Lo que se agrega, propio de este gasto:
//   · que la orden ampara solo lo detallado — el gasto de oficina se repite
//     mes a mes y sin esto es fácil que una orden vieja se use para cubrir un
//     consumo nuevo
//   · que una suscripción cubre únicamente su periodo, no su renovación
export const CLAUSULAS_ODA_PROVEEDOR: readonly string[] = [
  'El número de esta Orden debe consignarse obligatoriamente en la factura o comprobante de pago. Sin ese número, el comprobante no puede validarse ni tramitarse.',
  'Una vez emitida, la factura electrónica (archivos PDF y XML) debe enviarse exclusivamente al buzón: facturas@metrica.pe. No se reciben comprobantes enviados a otras cuentas.',
  'Si el comprobante corresponde a un Recibo por Honorarios (RxH), se aplicará la retención de renta de cuarta categoría cuando corresponda. De contar con constancia de suspensión vigente, adjuntarla al enviar el recibo.',
  'Si la operación está sujeta al régimen de detracciones, deberá consignarse el código que corresponda según la naturaleza del servicio o bien contratado.',
  'Esta Orden ampara únicamente los bienes o servicios detallados. Cualquier variación en el monto, el alcance o el periodo requiere la emisión de una Orden nueva.',
  'En servicios de suscripción o de carácter recurrente, esta Orden cubre solo el periodo indicado en el detalle; su renovación requiere una Orden nueva.',
];
