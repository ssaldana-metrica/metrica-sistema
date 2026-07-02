import { redondear } from '@/lib/calculos';

// ⚠️ PARÁMETROS TRIBUTARIOS DE LA ODA — El IGV lo decide el TIPO DE COMPROBANTE:
// una factura lleva IGV; un Recibo por Honorarios (RxH) no. Para ajustar el
// porcentaje, cambia el número aquí; el PDF y la pantalla lo toman solos.
export const IMPUESTOS = {
  igvPorcentaje: 18, // IGV que se agrega cuando el comprobante es una factura
};

// Tipo de proveedor: dato INFORMATIVO (empresa / persona natural). Ya NO decide
// el IGV; eso lo hace el tipo de comprobante.
export type TipoProveedorImp = 'empresa' | 'persona_natural';

// Tipo de comprobante: DECIDE el IGV. Factura → con IGV; RxH → solo el total.
export type TipoComprobante = 'factura' | 'rxh';

export type DesgloseImpuestos = {
  conIgv: boolean; // true → factura (se muestra IGV); false → RxH (solo total)
  base: number; // monto base (suma de líneas)
  porcentaje: number; // % de IGV (0 en RxH)
  igv: number; // monto del IGV (0 en RxH)
  total: number; // factura: base + IGV · RxH: base
};

// Regla:
//  - factura → se AGREGA IGV; total = base + IGV.
//  - rxh     → sin IGV; total = base (únicamente el total).
export function calcularImpuestos(
  monto: number,
  comprobante: TipoComprobante,
): DesgloseImpuestos {
  const base = redondear(monto || 0);
  if (comprobante === 'rxh') {
    return { conIgv: false, base, porcentaje: 0, igv: 0, total: base };
  }
  const porcentaje = IMPUESTOS.igvPorcentaje;
  const igv = redondear((base * porcentaje) / 100);
  return { conIgv: true, base, porcentaje, igv, total: redondear(base + igv) };
}
