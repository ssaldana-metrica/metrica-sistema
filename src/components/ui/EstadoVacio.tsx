import Link from 'next/link';

// Estado vacío amable: ícono + título + descripción, y opcionalmente una
// acción. Reemplaza las tablas/listas en blanco en toda la app.
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  accion?: { href: string; etiqueta: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-linea bg-white p-12 text-center shadow-tarjeta">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-superficie text-tinta-tenue [&_svg]:h-6 [&_svg]:w-6">
        {icono}
      </div>
      <h2 className="text-[15px] font-bold">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-tinta-suave">
        {descripcion}
      </p>
      {accion && (
        <Link
          href={accion.href}
          className="mt-4 inline-block rounded-lg bg-petroleo px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro"
        >
          {accion.etiqueta}
        </Link>
      )}
    </div>
  );
}

// Íconos comunes para estados vacíos (línea, heredan tamaño del contenedor).
export const IconosVacio = {
  documento: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  ),
  busqueda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  carrito: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  tabla: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  ),
};
