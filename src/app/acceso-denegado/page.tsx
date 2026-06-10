import Link from "next/link";
import { DOMINIOS_PERMITIDOS } from "@/config/dominios";

const MENSAJES: Record<string, { titulo: string; detalle: string }> = {
  dominio: {
    titulo: "Acceso denegado",
    detalle:
      "Tu correo no pertenece a los dominios autorizados de Métrica. Si crees que es un error, escribe a administración.",
  },
  inactivo: {
    titulo: "Acceso dado de baja",
    detalle:
      "Tu cuenta fue desactivada por gerencia. Si necesitas recuperar el acceso, comunícate con administración.",
  },
  error: {
    titulo: "No pudimos completar el ingreso",
    detalle: "Ocurrió un problema al registrar tu cuenta. Intenta de nuevo.",
  },
};

export default async function AccesoDenegado({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const m = MENSAJES[motivo ?? "dominio"] ?? MENSAJES.dominio;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-linea bg-white p-8 text-center shadow-tarjeta">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rojo-fondo text-rojo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="text-lg font-bold tracking-tight">{m.titulo}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-tinta-suave">
          {m.detalle}
        </p>

        {(motivo ?? "dominio") === "dominio" && (
          <p className="mt-3 text-[11.5px] text-tinta-tenue">
            Dominios permitidos:{" "}
            {DOMINIOS_PERMITIDOS.map((d) => (
              <span key={d} className="font-mono">
                @{d}{" "}
              </span>
            ))}
          </p>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-petroleo px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro"
        >
          Probar con otra cuenta
        </Link>
      </div>
    </main>
  );
}
