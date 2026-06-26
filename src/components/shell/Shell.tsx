'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar, type GrupoNav } from './Sidebar';

// Marco de la zona protegida. En escritorio el sidebar es fijo; en pantallas
// chicas se convierte en un cajón que se abre con el botón de menú y se cierra
// al navegar o al tocar el fondo. El escritorio (lg:) queda idéntico a antes.
export function Shell({
  grupos,
  encabezado,
  children,
}: {
  grupos: GrupoNav[];
  encabezado: ReactNode;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar: estático en escritorio, cajón deslizante en móvil */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar grupos={grupos} onNavegar={() => setAbierto(false)} />
      </div>

      {/* Fondo oscuro detrás del cajón (solo móvil) */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-tinta/40 lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-linea bg-superficie px-4 py-3 sm:px-8">
          {/* Botón de menú: solo en pantallas chicas */}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-linea bg-white text-tinta-suave transition hover:bg-crema lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-4">{encabezado}</div>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
