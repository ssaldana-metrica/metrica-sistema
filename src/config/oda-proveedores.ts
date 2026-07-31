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
