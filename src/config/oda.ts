// Cláusulas contractuales del PDF de la orden de adquisición.
// Estructura: secciones con título y una o más cláusulas. Editable: ajusta el
// texto, agrega o quita secciones/ítems según lo que defina la empresa.
export type SeccionClausula = { titulo: string; items: string[] };

// Indicaciones que van ANTES de las cláusulas numeradas (detracción, RxH,
// obligatoriedad del N° de orden y buzón de facturas). Se muestran como viñetas.
export const INTRO_CLAUSULAS_ODA: string[] = [
  'Consigne el código de detracción correspondiente según la naturaleza de la operación: Código 022 para servicios de influencers o el código aplicable según SUNAT para otros servicios y la compra de bienes.',
  'Si el comprobante corresponde a un Recibo por Honorarios (RxH), deberá aplicarse la retención del 8% cuando corresponda, de acuerdo con la normativa vigente.',
  'El número de esta Orden deberá consignarse obligatoriamente en la factura o comprobante de pago para su validación y trámite correspondiente.',
  'Una vez generada, la factura electrónica (archivos PDF y XML) debe enviarse exclusivamente al buzón: facturas@metrica.pe',
  'Nota: No se recibirán facturas que no incluyan el número de Orden de Compra / Servicios correspondiente o que sean enviadas a cuentas de correo distintas a la mencionada.',
];

export const CLAUSULAS_ODA: SeccionClausula[] = [
  {
    titulo: '1. Alcance',
    items: [
      '1.1 El Proveedor ejecutará los Servicios descritos a favor de MÉTRICA con los estándares de calidad exigibles y cumpliendo las normas legales y reglamentarias aplicables, garantizando la satisfacción del interés de MÉTRICA.',
      '1.2 El Proveedor ejecuta los Servicios por su propia cuenta y riesgo, con autonomía y recursos propios. Declara contar con las autorizaciones, licencias y permisos necesarios, y con la información suficiente para planificar y ejecutar los Servicios en la forma, lugares y plazos requeridos.',
    ],
  },
  {
    titulo: '2. Precios',
    items: [
      '2.1 El Precio Total de esta orden es la contraprestación que MÉTRICA pagará por la ejecución completa, correcta y oportuna de la totalidad de los Servicios.',
      '2.2 Los precios son fijos y no están sujetos a reajuste; solo se modifican con aprobación expresa de MÉTRICA. Incluyen todos los costos, gastos, recursos, impuestos, tasas y la utilidad del Proveedor.',
    ],
  },
];
