'use client';

import { useState, useTransition } from 'react';
import { ingresar } from '@/actions/onboarding';

// El alta es siempre como Ejecutivo. Administración y Gerencia las asigna
// Gerencia desde el módulo de Usuarios (ya no se autoeligen aquí).
export function SelectorRol() {
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await ingresar();
      if (r?.error) setError(r.error); // si todo va bien, la acción redirige
    });
  }

  return (
    <div>
      <div className="rounded-xl border border-linea bg-superficie p-4">
        <div className="text-[14px] font-bold">Ejecutivo</div>
        <p className="mt-1.5 text-[12px] leading-snug text-tinta-suave">
          Crea y envía cotizaciones a aprobación, y llena tu parte de la ficha de
          apertura. Es el rol con el que ingresan todas las cuentas nuevas.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[12.5px] text-rojo">
          {error}
        </div>
      )}

      <button
        onClick={confirmar}
        disabled={guardando}
        className="mt-5 w-full rounded-lg bg-petroleo px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
      >
        {guardando ? 'Entrando…' : 'Entrar al sistema'}
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-tinta-tenue">
        Los roles de Administración y Gerencia los asigna Gerencia desde el módulo
        de Usuarios. Si necesitas otro rol, pídeselo a dirección.
      </p>
    </div>
  );
}
