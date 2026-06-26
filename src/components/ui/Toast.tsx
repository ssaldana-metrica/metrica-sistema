'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type Tipo = 'exito' | 'error' | 'info';
type Toast = { id: number; tipo: Tipo; texto: string };

// El contexto expone una función para mostrar un toast desde cualquier pantalla.
const ToastCtx = createContext<(t: { tipo?: Tipo; texto: string }) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastCtx);
}

const ESTILO: Record<Tipo, { borde: string; fondo: string; texto: string; icono: ReactNode }> = {
  exito: {
    borde: 'border-verde/30',
    fondo: 'bg-verde-fondo',
    texto: 'text-verde',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  error: {
    borde: 'border-rojo/30',
    fondo: 'bg-rojo-fondo',
    texto: 'text-rojo',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
  },
  info: {
    borde: 'border-azul/30',
    fondo: 'bg-azul-fondo',
    texto: 'text-azul',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
};

// Vive en el layout (por encima de las pantallas), así el toast sobrevive a los
// refrescos y remontajes de los editores. Auto-cierre a los 4.5 s.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((t: { tipo?: Tipo; texto: string }) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, tipo: t.tipo ?? 'exito', texto: t.texto }]);
    setTimeout(
      () => setToasts((ts) => ts.filter((x) => x.id !== id)),
      4500,
    );
  }, []);

  const cerrar = (id: number) =>
    setToasts((ts) => ts.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const e = ESTILO[t.tipo];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border ${e.borde} ${e.fondo} ${e.texto} px-4 py-3 shadow-flotante`}
            >
              <span className="mt-px shrink-0">{e.icono}</span>
              <span className="flex-1 text-[13px] font-medium leading-snug">
                {t.texto}
              </span>
              <button
                onClick={() => cerrar(t.id)}
                className="shrink-0 opacity-50 transition hover:opacity-100"
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
