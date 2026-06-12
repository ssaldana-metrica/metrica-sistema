// Botón compacto para descargar el PDF oficial de una cotización aprobada.
// El href apunta a /cotizaciones/[id]/pdf, que valida el acceso y redirige
// al archivo firmado. Si no hay PDF (no aprobada), muestra un guion.
export function BotonPdf({ href }: { href: string | null }) {
  if (!href)
    return <span className="text-[12px] text-tinta-tenue">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Descargar PDF"
      className="inline-flex items-center gap-1.5 rounded-md border border-linea bg-white px-2 py-1 text-[11.5px] font-semibold text-petroleo-oscuro transition hover:bg-superficie"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-[13px] w-[13px]"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      PDF
    </a>
  );
}
