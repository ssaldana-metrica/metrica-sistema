'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reabrirCotizacion } from '@/actions/aprobaciones';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

// Botón para reabrir una cotización aprobada (solo administración). La devuelve
// a estado editable y avisa al ejecutivo por correo.
export function BotonReabrirCotizacion({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, startTransition] = useTransition();

  function reabrir() {
    startTransition(async () => {
      const r = await reabrirCotizacion(id);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        setConfirmar(false);
        toast({
          texto: 'Cotización reabierta. Se avisó al ejecutivo por correo.',
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-[10px] border border-linea bg-white px-4 py-3">
      <span className="text-[12.5px] text-tinta-suave">
        ¿Necesitas corregir algo? Puedes reabrir esta cotización para editarla y
        reenviarla a aprobación.
      </span>
      <button
        onClick={() => setConfirmar(true)}
        className="shrink-0 rounded-lg border border-terracota/40 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-terracota transition hover:bg-terracota/5"
      >
        Reabrir cotización
      </button>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">Reabrir cotización</h3>
            <p className="mt-2 rounded-[10px] border border-ambar/30 bg-ambar-fondo px-3.5 py-3 text-[12.5px] text-ambar">
              La cotización dejará de estar aprobada y volverá a ser editable. Se
              avisará al ejecutivo por correo para que la corrija y la reenvíe. El
              PDF aprobado quedará obsoleto (se regenera al reaprobar).
            </p>
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmar(false)}
                disabled={guardando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
              >
                Cancelar
              </button>
              <button
                onClick={reabrir}
                disabled={guardando}
                className="inline-flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
              >
                {guardando && <Spinner />}
                {guardando ? 'Reabriendo…' : 'Reabrir y avisar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
