// Genera un PDF de muestra de una ODA de PROVEEDORES, para revisar el formato
// sin tener que crear una orden real:
//   npx tsx scripts/prueba-pdf-oda-proveedor.mts
import { writeFileSync } from 'node:fs';
import { generarPdfOda } from '../src/lib/pdf-oda';
import { CLAUSULAS_ODA_PROVEEDOR, ETIQUETA_TIPO_PROVEEDOR } from '../src/config/oda-proveedores';

const pdf = await generarPdfOda({
  codigo: 'ODA-PROV-2026-1001',
  fechaEmision: '2026-07-31T15:00:00.000Z',
  comprobante: 'factura',
  clausulas: CLAUSULAS_ODA_PROVEEDOR,
  proveedor: {
    razonSocial: 'Andina Data Services S.A.C.',
    nombreComercial: 'Andina Data',
    ruc: '20512345678',
    etiquetaTipo: ETIQUETA_TIPO_PROVEEDOR.suscripciones,
    banco: 'BCP',
    cuenta: '194-8555656-6',
    cci: '00219400855565601',
    email: 'facturacion@andinadata.pe',
  },
  detalles: [
    { descripcion: 'Suscripción anual · plataforma de monitoreo de medios', cantidad: 1, precioUnitario: 4200, total: 4200 },
    { descripcion: 'Usuarios adicionales (3)', cantidad: 3, precioUnitario: 260, total: 780 },
  ],
  moneda: 'PEN',
  condicionesPago: 'Pago anual por adelantado, contra factura',
});

const salida = process.argv[2] ?? '/tmp/muestra-oda-proveedor.pdf';
writeFileSync(salida, pdf);
console.log(`PDF generado: ${pdf.length} bytes → ${salida}`);
