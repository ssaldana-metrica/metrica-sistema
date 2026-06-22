// Cláusulas contractuales del PDF de la orden de adquisición.
// Estructura: secciones con título y una o más cláusulas. Editable: ajusta el
// texto, agrega o quita secciones/ítems según lo que defina la empresa.
export type SeccionClausula = { titulo: string; items: string[] };

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
