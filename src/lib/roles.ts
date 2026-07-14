// Roles del sistema. Vive fuera de las server actions para poder importarse
// tanto en servidor como en cliente (un archivo 'use server' solo puede
// exportar funciones async).
export const ROLES = ['ejecutivo', 'admin', 'gerencia'] as const;

export type Rol = (typeof ROLES)[number];
