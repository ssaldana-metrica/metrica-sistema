// Spinner pequeño para botones en estado "cargando". Hereda el color del
// texto del botón (currentColor) y gira con animate-spin.
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-[14px] w-[14px] animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
