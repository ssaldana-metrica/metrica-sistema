// Genera un PDF de muestra con datos de ejemplo para revisar el formato:
//   npx tsx scripts/prueba-pdf.ts
import { writeFileSync } from 'node:fs';
import { generarPdfCotizacion } from '../src/lib/pdf';

const pdf = await generarPdfCotizacion({
  codigo: 'COT-2026-0002',
  proyecto: 'Campaña influencers Q2',
  moneda: 'USD',
  feePorcentaje: 12,
  fechaEnvioCliente: '2026-06-13',
  cliente: {
    nombre: 'H&M Perú',
    razonSocial: 'H & M Hennes & Mauritz S.A.C.',
    ruc: '20543219876',
  },
  ejecutivo: 'Luis Mendoza',
  lineas: [
    { orden: 1, proveedor: 'JMA Influencers Connect', descripcion: '3 reels @conan.style', cantidad: 1, precio: 3200, subtotal: 3200 },
    { orden: 2, proveedor: 'Productora Lima Films', descripcion: 'Edición y post-producción', cantidad: 1, precio: 2100, subtotal: 2100 },
    { orden: 3, proveedor: 'Foto Estudio Norte', descripcion: 'Sesión producto', cantidad: 1, precio: 1800, subtotal: 1800 },
  ],
});

writeFileSync('/tmp/muestra-cotizacion.pdf', pdf);
console.log(`PDF generado: ${pdf.length} bytes → /tmp/muestra-cotizacion.pdf`);
