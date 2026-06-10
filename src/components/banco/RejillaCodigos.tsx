'use client';

import { useState, useTransition } from 'react';
import { tomarCodigo } from '@/actions/codigos';
import { BadgeEstado } from '@/components/ui/BadgeEstado';

export type CeldaCodigo = {
  codigo: string;
  estado: 'disponible' | 'en_uso' | 'anulado';
  tomadoPor: string | null;
  tomadoEn: string | null;
  cot: {
    proyecto: string;
    estado: string;
    cliente: string;
    ejecutivo: string;
    motivo: string | null;
  } | null;
};

export function RejillaCodigos({ celdas }: { celdas: CeldaCodigo[] }) {
  const [detalle, setDetalle] = useState<CeldaCodigo | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tomando, startTransition] = useTransition();

  function tomar() {
    setError(null);
    startTransition(async () => {
      const r = await tomarCodigo();
      // Si todo va bien, tomarCodigo redirige y esta línea nunca corre.
      if (r?.error) {
        setError(r.error);
        setConfirmar(null);
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
        {celdas.map((c) => {
          if (c.estado === 'disponible') {
            return (
              <button
                key={c.codigo}
                onClick={() => setConfirmar(c.codigo)}
                className="rounded-[10px] border border-dashed border-petroleo/40 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-petroleo hover:bg-verde-fondo hover:shadow-tarjeta"
              >
                <div className="font-mono text-[12.5px] font-semibold text-petroleo-oscuro">
                  {c.codigo}
                </div>
                <div className="mt-1 text-[10.5px] text-tinta-tenue">
                  Disponible · clic para usar
                </div>
              </button>
            );
          }
          if (c.estado === 'anulado') {
            return (
              <button
                key={c.codigo}
                onClick={() => setDetalle(c)}
                className="rounded-[10px] bg-rojo-fondo p-3 text-left opacity-85 transition hover:opacity-100"
              >
                <div className="font-mono text-[12.5px] font-semibold text-rojo line-through">
                  {c.codigo}
                </div>
                <span className="mt-2 inline-block rounded-[5px] bg-rojo/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-rojo">
                  Anulado
                </span>
              </button>
            );
          }
          return (
            <button
              key={c.codigo}
              onClick={() => setDetalle(c)}
              className="rounded-[10px] border border-linea bg-superficie p-3 text-left transition hover:bg-white hover:shadow-tarjeta"
            >
              <div className="font-mono text-[12.5px] font-semibold">
                {c.codigo}
              </div>
              <div className="mt-1 truncate text-[10.5px] text-tinta-tenue">
                {c.cot?.cliente ?? c.tomadoPor ?? '—'}
              </div>
              <span className="mt-2 inline-block rounded-[5px] bg-azul-fondo px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-azul">
                En uso
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-5 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[13px] text-rojo">
          {error}
        </div>
      )}

      {/* Confirmación para tomar un código disponible */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">Tomar código del banco</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-tinta-suave">
              Se abrirá una nueva cotización. El banco entregará el primer
              código disponible (puede no ser exactamente{' '}
              <span className="font-mono font-semibold">{confirmar}</span> si
              alguien lo toma en este instante — nunca se duplican).
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmar(null)}
                disabled={tomando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
              >
                Cancelar
              </button>
              <button
                onClick={tomar}
                disabled={tomando}
                className="rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
              >
                {tomando ? 'Tomando…' : 'Tomar y cotizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de un código en uso o anulado */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6"
          onClick={() => setDetalle(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-flotante"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-linea px-6 py-4">
              <h3 className="font-mono text-[15px] font-bold">
                {detalle.codigo}
              </h3>
              <button
                onClick={() => setDetalle(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-tinta-tenue transition hover:bg-crema"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 px-6 py-5 text-[13px]">
              {detalle.estado === 'anulado' ? (
                <>
                  <div className="flex items-center gap-2">
                    <BadgeEstado estado="anulada" />
                    <span className="text-[12px] text-tinta-tenue">
                      Este código nunca se reutilizará.
                    </span>
                  </div>
                  {detalle.cot && (
                    <>
                      <Fila k="Cliente" v={detalle.cot.cliente} />
                      <Fila k="Proyecto" v={detalle.cot.proyecto} />
                      <Fila k="Ejecutivo" v={detalle.cot.ejecutivo} />
                      <div className="rounded-lg bg-rojo-fondo p-3 text-rojo">
                        <span className="font-semibold">Motivo: </span>
                        {detalle.cot.motivo ?? 'No registrado'}
                      </div>
                    </>
                  )}
                </>
              ) : detalle.cot ? (
                <>
                  <div>
                    <BadgeEstado estado={detalle.cot.estado} />
                  </div>
                  <Fila k="Cliente" v={detalle.cot.cliente} />
                  <Fila k="Proyecto" v={detalle.cot.proyecto} />
                  <Fila k="Ejecutivo" v={detalle.cot.ejecutivo} />
                  <Fila k="Tomado" v={detalle.tomadoEn ?? '—'} />
                </>
              ) : (
                <>
                  <Fila k="Tomado por" v={detalle.tomadoPor ?? '—'} />
                  <Fila k="Fecha" v={detalle.tomadoEn ?? '—'} />
                  <p className="text-[12px] text-tinta-tenue">
                    La cotización de este código aún está en preparación o
                    pertenece a otro ejecutivo.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-tinta-tenue">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
