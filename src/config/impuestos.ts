import { redondear } from '@/lib/calculos';

// ⚠️ PARÁMETROS TRIBUTARIOS DE LA ODA — PENDIENTES DE CONFIRMAR CON CONTABILIDAD
// (falta definir detracción y casos especiales). Para ajustar el tratamiento,
// cambia SOLO los números o la lógica de `calcularImpuestos` aquí; el PDF y la
// pantalla lo toman automáticamente.
export const IMPUESTOS = {
  igvPorcentaje: 18, //         empresa: IGV sobre el monto
  retencionRentaPorcentaje: 8, // persona natural: retención de renta sobre el monto
};

export type TipoProveedorImp = 'empresa' | 'persona_natural';

export type DesgloseImpuestos = {
  modo: 'igv' | 'retencion';
  base: number; // monto base
  porcentaje: number;
  impuesto: number; // IGV (empresa) o retención (persona natural)
  total: number; // empresa: base + IGV · persona natural: base − retención
  etiquetaImpuesto: string;
  etiquetaTotal: string;
};

// Regla actual (provisional):
//  - empresa         → se AGREGA IGV; total = base + IGV.
//  - persona_natural → se RETIENE renta; neto a pagar = base − retención (sin IGV).
export function calcularImpuestos(
  monto: number,
  tipo: TipoProveedorImp,
): DesgloseImpuestos {
  const base = redondear(monto || 0);
  if (tipo === 'persona_natural') {
    const porcentaje = IMPUESTOS.retencionRentaPorcentaje;
    const impuesto = redondear((base * porcentaje) / 100);
    return {
      modo: 'retencion',
      base,
      porcentaje,
      impuesto,
      total: redondear(base - impuesto),
      etiquetaImpuesto: `Retención de renta (${porcentaje}%)`,
      etiquetaTotal: 'Neto a pagar',
    };
  }
  const porcentaje = IMPUESTOS.igvPorcentaje;
  const impuesto = redondear((base * porcentaje) / 100);
  return {
    modo: 'igv',
    base,
    porcentaje,
    impuesto,
    total: redondear(base + impuesto),
    etiquetaImpuesto: `IGV (${porcentaje}%)`,
    etiquetaTotal: 'Total',
  };
}
