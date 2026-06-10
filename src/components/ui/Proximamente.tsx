export function Proximamente({
  titulo,
  detalle,
}: {
  titulo: string;
  detalle: string;
}) {
  return (
    <div>
      <h1 className="mb-5 text-lg font-bold tracking-tight">{titulo}</h1>
      <div className="rounded-xl border border-dashed border-linea bg-white p-10 text-center shadow-tarjeta">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-superficie text-tinta-tenue">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-tinta-suave">
          {detalle}
        </p>
      </div>
    </div>
  );
}
