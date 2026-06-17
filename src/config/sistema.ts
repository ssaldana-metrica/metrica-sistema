// URL base del sistema, para construir enlaces dentro de los correos.
// En desarrollo apunta a localhost; en producción define URL_SISTEMA con el
// dominio real (sin barra final). Solo se usa en el servidor.
export const urlSistema = () =>
  (process.env.URL_SISTEMA || 'http://localhost:3000').replace(/\/+$/, '');
