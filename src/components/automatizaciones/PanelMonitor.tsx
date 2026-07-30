'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import {
  cambiarEstadoAutomatizacion,
  cambiarModoPrueba,
  correrAhora,
} from '@/actions/automatizaciones';

export type EstadoMonitor = {
  nombre: string;
  descripcion: string;
  activa: boolean;
  modoPrueba: boolean;
  ultimaCorridaEn: string | null;
  ultimoEstado: string | null;
  ultimoDetalle: string;
};

function Interruptor({
  encendido,
  onCambiar,
  deshabilitado,
  etiqueta,
}: {
  encendido: boolean;
  onCambiar: () => void;
  deshabilitado: boolean;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={onCambiar}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
        encendido ? 'bg-verde' : 'bg-linea'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          encendido ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function PanelMonitor({
  estado,
  puedeAdministrar,
}: {
  estado: EstadoMonitor;
  puedeAdministrar: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);

  function accion(clave: string, fn: () => Promise<{ ok: true; detalle?: string } | { error: string }>, exito: string) {
    setOcupado(clave);
    startTransition(async () => {
      const r = await fn();
      setOcupado(null);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        toast({ texto: r.detalle ?? exito });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-bold tracking-tight">{estado.nombre}</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${
                estado.activa ? 'bg-verde-fondo text-verde' : 'bg-pizarra-fondo text-pizarra'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {estado.activa ? 'Encendida' : 'Apagada'}
            </span>
            {estado.modoPrueba && (
              <span className="inline-flex items-center rounded-full bg-ambar-fondo px-2.5 py-[3px] text-[11.5px] font-semibold text-ambar">
                Modo prueba
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-tinta-suave">
            {estado.descripcion}
          </p>
        </div>

        {puedeAdministrar && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() =>
              accion('correr', () => correrAhora(), 'Corrida terminada.')
            }
            className="shrink-0 rounded-lg bg-petroleo px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
          >
            {ocupado === 'correr' ? 'Revisando El Peruano…' : 'Correr ahora'}
          </button>
        )}
      </div>

      {/* Última corrida: lo primero que quiere saber quien entra a mirar. */}
      <div className="mt-5 rounded-xl bg-superficie px-4 py-3">
        {estado.ultimaCorridaEn ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="font-semibold text-tinta">Última corrida</span>
              <span className="text-tinta-suave">
                {new Date(estado.ultimaCorridaEn).toLocaleString('es-PE', {
                  timeZone: 'America/Lima',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              {estado.ultimoEstado && (
                <span
                  className={`font-mono text-[11px] uppercase tracking-wide ${
                    estado.ultimoEstado === 'error' ? 'text-rojo' : 'text-verde'
                  }`}
                >
                  {estado.ultimoEstado === 'error' ? 'con error' : estado.ultimoEstado}
                </span>
              )}
            </div>
            {estado.ultimoDetalle && (
              <p className="mt-1 text-[12px] leading-relaxed text-tinta-suave">
                {estado.ultimoDetalle}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-tinta-suave">
            Todavía no ha corrido ninguna vez.
          </p>
        )}
      </div>

      {puedeAdministrar && (
        <div className="mt-5 space-y-3 border-t border-linea pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold">Automatización encendida</div>
              <p className="text-[12px] leading-relaxed text-tinta-suave">
                Apagada no revisa nada ni envía correos, aunque la tarea programada la llame.
              </p>
            </div>
            <Interruptor
              etiqueta="Encender o apagar la automatización"
              encendido={estado.activa}
              deshabilitado={ocupado !== null}
              onCambiar={() =>
                accion(
                  'activa',
                  () => cambiarEstadoAutomatizacion(!estado.activa),
                  estado.activa ? 'Automatización apagada.' : 'Automatización encendida.',
                )
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold">Modo prueba</div>
              <p className="text-[12px] leading-relaxed text-tinta-suave">
                Encendido, los avisos llegan <strong>solo a gerencia</strong> y la lista de
                destinatarios ni se consulta. Apágalo cuando quieras que lleguen a todos.
              </p>
            </div>
            <Interruptor
              etiqueta="Activar o desactivar el modo prueba"
              encendido={estado.modoPrueba}
              deshabilitado={ocupado !== null}
              onCambiar={() =>
                accion(
                  'prueba',
                  () => cambiarModoPrueba(!estado.modoPrueba),
                  estado.modoPrueba
                    ? 'Modo prueba apagado: los avisos irán a toda la lista.'
                    : 'Modo prueba encendido: los avisos van solo a gerencia.',
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
