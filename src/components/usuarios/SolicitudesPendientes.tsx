'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import {
  aprobarSolicitudRol,
  rechazarSolicitudRol,
  type SolicitudPendiente,
} from '@/actions/usuarios';

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administración',
  ejecutivo: 'Ejecutivo',
  gerencia: 'Gerencia',
};

// Solicitudes de rol esperando decisión. Van ARRIBA de la tabla de usuarios y
// solo aparecen si hay alguna: un bloque vacío permanente se vuelve invisible
// a los pocos días, y estas hay que atenderlas.
export function SolicitudesPendientes({
  solicitudes,
  yoId,
}: {
  solicitudes: SolicitudPendiente[];
  yoId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (solicitudes.length === 0) return null;

  function resolver(s: SolicitudPendiente, aprobar: boolean) {
    setOcupado(s.id);
    startTransition(async () => {
      const r = aprobar
        ? await aprobarSolicitudRol(s.id)
        : await rechazarSolicitudRol(s.id);
      setOcupado(null);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        toast({
          tipo: aprobar ? 'exito' : 'info',
          texto: aprobar
            ? `${s.nombre} ahora es ${ETIQUETA_ROL[s.rolSolicitado]}.`
            : `Solicitud rechazada. ${s.nombre} sigue como Ejecutivo.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-ambar/30 bg-ambar-fondo shadow-tarjeta">
      <div className="border-b border-ambar/20 px-5 py-3.5">
        <h2 className="text-[14px] font-bold text-ambar">
          {solicitudes.length === 1
            ? '1 solicitud de rol pendiente'
            : `${solicitudes.length} solicitudes de rol pendientes`}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-ambar/90">
          Mientras esperan, estas personas trabajan como Ejecutivo y no pueden
          aprobar cotizaciones.
        </p>
      </div>

      <ul className="divide-y divide-ambar/20">
        {solicitudes.map((s) => {
          const esMia = s.usuarioId === yoId;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 bg-white/60 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{s.nombre}</div>
                <div className="text-[12px] text-tinta-suave">{s.correo}</div>
              </div>

              <div className="shrink-0 text-[12.5px]">
                Pide{' '}
                <span className="font-semibold">
                  {ETIQUETA_ROL[s.rolSolicitado] ?? s.rolSolicitado}
                </span>
              </div>

              <div className="shrink-0 font-mono text-[11px] text-tinta-tenue">
                {new Date(s.creadaEn).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'America/Lima',
                })}
              </div>

              {esMia ? (
                // El servidor y la base también lo impiden; acá se explica por
                // qué no hay botones, en vez de mostrarlos y que fallen.
                <span className="shrink-0 text-[12px] font-semibold text-tinta-tenue">
                  Es tu solicitud · la resuelve otra persona
                </span>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => resolver(s, false)}
                    className="rounded-lg border border-linea bg-white px-3 py-1.5 text-[12px] font-semibold text-tinta-suave transition hover:bg-superficie disabled:opacity-40"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => resolver(s, true)}
                    className="rounded-lg bg-petroleo px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-40"
                  >
                    {ocupado === s.id ? 'Guardando…' : 'Aprobar'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
