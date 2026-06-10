import { obtenerSesion } from "@/lib/auth";
import { cerrarSesion } from "@/actions/auth";

const ETIQUETA_ROL: Record<string, string> = {
  ejecutivo: "Ejecutivo",
  admin: "Admin",
  gerencia: "Gerencia",
};

export default async function Panel() {
  const sesion = await obtenerSesion();
  if (!sesion) return null; // el layout ya redirigió
  const { usuario } = sesion;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-linea bg-white p-8 shadow-tarjeta">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-petroleo to-petroleo-oscuro text-lg font-bold text-white">
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[15px] font-bold">{usuario.nombre}</div>
            <div className="font-mono text-[11.5px] text-tinta-tenue">
              {usuario.correo}
            </div>
          </div>
          <span className="ml-auto rounded-full bg-verde-fondo px-3 py-1 text-[11.5px] font-semibold text-verde">
            {ETIQUETA_ROL[usuario.rol]}
          </span>
        </div>

        <div className="rounded-lg border border-linea-suave bg-superficie p-4 text-[13px] text-tinta-suave">
          ✓ Sesión iniciada correctamente. El panel completo (banco de
          códigos, cotizaciones, aprobaciones) llega en el siguiente bloque.
        </div>

        <form action={cerrarSesion} className="mt-6">
          <button className="w-full rounded-lg border border-linea bg-white px-4 py-2.5 text-[13px] font-semibold text-tinta transition hover:bg-superficie">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
