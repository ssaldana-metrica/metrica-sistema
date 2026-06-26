import Image from "next/image";
import { DOMINIOS_PERMITIDOS } from "@/config/dominios";
import { BotonGoogle } from "./boton-google";

export default function PaginaLogin() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-linea bg-white p-8 shadow-tarjeta">
          <div className="mb-7">
            <Image
              src="/marca/logo-metrica.png"
              alt="Métrica"
              width={734}
              height={372}
              priority
              className="h-9 w-auto"
            />
            <div className="mt-2 text-[11px] tracking-wide text-tinta-tenue">
              Sistema Operativo
            </div>
          </div>

          <h1 className="text-lg font-bold tracking-tight">Inicia sesión</h1>
          <p className="mb-6 mt-1 text-[13px] text-tinta-suave">
            Usa tu cuenta de Google de Métrica para entrar.
          </p>

          <BotonGoogle />

          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-tinta-tenue">
            Solo correos{" "}
            {DOMINIOS_PERMITIDOS.map((d, i) => (
              <span key={d} className="font-mono">
                @{d}
                {i < DOMINIOS_PERMITIDOS.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] text-tinta-tenue">
          métrica · comunicación estratégica
        </p>
      </div>
    </main>
  );
}
