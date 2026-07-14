'use client';

import { useState, useTransition } from 'react';
import { elegirRol } from '@/actions/onboarding';

type Rol = 'admin' | 'ejecutivo';

const OPCIONES: {
  rol: Rol;
  titulo: string;
  descripcion: string;
}[] = [
  {
    rol: 'ejecutivo',
    titulo: 'Ejecutivo',
    descripcion:
      'Crea y envía cotizaciones a aprobación, y llena tu parte de la ficha de apertura.',
  },
  {
    rol: 'admin',
    titulo: 'Administración',
    descripcion:
      'Aprueba cotizaciones, hace el seguimiento y cierre de fichas, genera las ODA y ve la tabla de control.',
  },
];

export function SelectorRol() {
  const [elegido, setElegido] = useState<Rol | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function confirmar() {
    if (!elegido) return;
    setError(null);
    startTransition(async () => {
      const r = await elegirRol(elegido);
      if (r?.error) setError(r.error); // si todo va bien, la acción redirige
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPCIONES.map((o) => {
          const activo = elegido === o.rol;
          return (
            <button
              key={o.rol}
              onClick={() => setElegido(o.rol)}
              className={`rounded-xl border p-4 text-left transition ${
                activo
                  ? 'border-petroleo bg-verde-fondo shadow-tarjeta'
                  : 'border-linea bg-white hover:border-petroleo/40 hover:bg-superficie'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold">{o.titulo}</span>
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    activo ? 'border-petroleo bg-petroleo' : 'border-linea'
                  }`}
                >
                  {activo && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-tinta-suave">
                {o.descripcion}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[12.5px] text-rojo">
          {error}
        </div>
      )}

      <button
        onClick={confirmar}
        disabled={!elegido || guardando}
        className="mt-5 w-full rounded-lg bg-petroleo px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
      >
        {guardando ? 'Entrando…' : 'Entrar al sistema'}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-tinta-tenue">
        Gerencia se asigna por dirección, no aquí. Si te equivocas, un usuario de
        gerencia puede corregir tu rol.
      </p>
    </div>
  );
}
