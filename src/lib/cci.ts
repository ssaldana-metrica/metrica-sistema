// Un CCI (Código de Cuenta Interbancario) válido tiene exactamente 20 dígitos.
// Se comparte entre la validación de servidor y la de pantalla.
export const CCI_LARGO = 20;

export const soloDigitos = (v: string) => v.replace(/\D/g, '');

export const cciValido = (v: string) => soloDigitos(v).length === CCI_LARGO;
