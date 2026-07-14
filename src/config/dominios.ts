// Dominios de correo autorizados para entrar al sistema.
// Para agregar un dominio del grupo, añádelo a esta lista y despliega.
export const DOMINIOS_PERMITIDOS = [
  'metrica.pe',
  'metricaperu.com',
];

export function dominioPermitido(correo: string): boolean {
  const dominio = correo.trim().toLowerCase().split('@')[1] ?? '';
  return DOMINIOS_PERMITIDOS.includes(dominio);
}
