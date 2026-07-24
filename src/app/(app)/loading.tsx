// Esqueleto que aparece AL INSTANTE al navegar entre secciones, mientras el
// servidor renderiza la página real. Sin esto, al hacer clic la pantalla vieja
// se quedaba congelada hasta terminar el render (y las rutas dinámicas ni se
// pre-cargaban). Es genérico a propósito: da feedback en cualquier sección.
export default function Cargando() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-6">
        <div className="h-5 w-52 rounded bg-superficie" />
        <div className="mt-2.5 h-3.5 w-72 rounded bg-linea" />
      </div>

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-linea bg-white px-5 py-4 shadow-tarjeta"
          >
            <div className="mb-3.5 h-3 w-28 rounded bg-linea" />
            <div className="h-7 w-16 rounded bg-superficie" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
        <div className="flex items-center justify-between border-b border-linea-suave px-5 py-4">
          <div className="h-4 w-44 rounded bg-superficie" />
          <div className="h-8 w-36 rounded-lg bg-linea" />
        </div>
        <div className="divide-y divide-linea-suave">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-3.5 w-24 rounded bg-superficie" />
              <div className="h-3.5 w-40 rounded bg-linea" />
              <div className="hidden h-3.5 w-28 rounded bg-linea sm:block" />
              <div className="ml-auto h-3.5 w-20 rounded bg-superficie" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
