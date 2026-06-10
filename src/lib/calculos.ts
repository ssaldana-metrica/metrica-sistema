// Única fuente de verdad para los cálculos de una cotización.
// El IGV se aplica sobre (subtotal de proveedores + fee), como en el prototipo.
export const IGV = 0.18;

export type Moneda = 'PEN' | 'USD';

export type LineaCalculo = {
  cantidad: number;
  precioUnitario: number;
};

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export function subtotalLinea(l: LineaCalculo): number {
  return redondear((l.cantidad || 0) * (l.precioUnitario || 0));
}

export function calcularTotales(lineas: LineaCalculo[], feePorcentaje: number) {
  const subtotal = redondear(
    lineas.reduce((suma, l) => suma + subtotalLinea(l), 0),
  );
  const fee = redondear(subtotal * ((feePorcentaje || 0) / 100));
  const igv = redondear((subtotal + fee) * IGV);
  const total = redondear(subtotal + fee + igv);
  return { subtotal, fee, igv, total };
}

export function formatearMonto(n: number, moneda: Moneda): string {
  const simbolo = moneda === 'PEN' ? 'S/' : 'US$';
  return `${simbolo} ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
