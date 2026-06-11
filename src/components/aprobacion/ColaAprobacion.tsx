'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  aprobarCotizacion,
  observarCotizacion,
} from '@/actions/aprobaciones';
import { calcularTotales, formatearMonto, type Moneda } from '@/lib/calculos';
import { EMPRESA } from '@/config/empresa';

export type PendienteAprobacion = {
  id: string;
  codigo: string;
  proyecto: string;
  moneda: Moneda;
  feePorcentaje: number;
  fechaEnvioCliente: string | null;
  cliente: string;
  clienteRazon: string;
  ejecutivo: string;
  lineas: {
    orden: number;
    proveedor: string;
    descripcion: string;
    cantidad: number;
    precio: number;
    subtotal: number;
  }[];
};

type Resuelta =
  | { tipo: 'aprobada'; codigo: string; correo: string; url: string | null }
  | { tipo: 'observada'; codigo: string; correo: string };

export function ColaAprobacion({
  pendientes,
}: {
  pendientes: PendienteAprobacion[];
}) {
  const router = useRouter();
  const [resuelta, setResuelta] = useState<Resuelta | null>(null);
  const [observando, setObservando] = useState(false);
  const [textoObs, setTextoObs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [procesando, startTransition] = useTransition();

  // Siempre se atiende la primera de la cola; al resolverla, el refresh
  // del servidor trae la siguiente automáticamente.
  const actual = pendientes[0];

  if (!actual) {
    return (
      <div className="rounded-xl border border-dashed border-linea bg-white p-12 text-center shadow-tarjeta">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-verde-fondo text-verde">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-6 w-6"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-[15px] font-bold">Bandeja vacía</h2>
        <p className="mx-auto mt-1 max-w-xs text-[13px] text-tinta-suave">
          No hay cotizaciones pendientes de aprobar. Buen trabajo.
        </p>
      </div>
    );
  }

  const totales = calcularTotales(
    actual.lineas.map((l) => ({
      cantidad: l.cantidad,
      precioUnitario: l.precio,
    })),
    actual.feePorcentaje,
  );

  function aprobar() {
    setError(null);
    startTransition(async () => {
      const r = await aprobarCotizacion(actual.id);
      if ('error' in r) setError(r.error);
      else
        setResuelta({
          tipo: 'aprobada',
          codigo: r.codigo,
          correo: r.correo,
          url: r.urlDescarga,
        });
    });
  }

  function observar() {
    setError(null);
    startTransition(async () => {
      const r = await observarCotizacion(actual.id, textoObs);
      if ('error' in r) setError(r.error);
      else {
        setObservando(false);
        setTextoObs('');
        setResuelta({ tipo: 'observada', codigo: r.codigo, correo: r.correo });
      }
    });
  }

  function siguiente() {
    setResuelta(null);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12.5px] text-tinta-tenue">
          Revisando <b>1</b> de <b>{pendientes.length}</b> pendiente
          {pendientes.length > 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[13px] text-rojo">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
        <div className="flex items-center justify-between border-b border-linea-suave px-5 py-4">
          <h2 className="text-[14.5px] font-bold">
            <span className="font-mono">{actual.codigo}</span> ·{' '}
            {actual.cliente}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-fondo px-2.5 py-[3px] text-[11.5px] font-semibold text-ambar">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Por aprobar
          </span>
        </div>

        {/* Vista previa del documento (así se verá el PDF) */}
        <div className="p-6">
          <div className="rounded-lg border border-linea bg-white p-7">
            <div className="flex items-start justify-between border-b-2 border-tinta pb-4">
              <div>
                <div className="text-xl font-extrabold tracking-tight">
                  Métri<span className="text-petroleo">ca</span>
                </div>
                <div className="mt-1 text-[11px] text-tinta-tenue">
                  {EMPRESA.razonSocial} · RUC {EMPRESA.ruc}
                </div>
              </div>
              <div className="text-right font-mono text-[11.5px] text-tinta-suave">
                COTIZACIÓN
                <div className="text-[14px] font-semibold text-tinta">
                  {actual.codigo}
                </div>
              </div>
            </div>

            <div className="my-4 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="text-tinta-tenue">Cliente: </span>
                {actual.clienteRazon}
              </div>
              <div>
                <span className="text-tinta-tenue">Proyecto: </span>
                {actual.proyecto || '—'}
              </div>
              <div>
                <span className="text-tinta-tenue">Ejecutivo: </span>
                {actual.ejecutivo}
              </div>
              <div>
                <span className="text-tinta-tenue">Envío al cliente: </span>
                {actual.fechaEnvioCliente
                  ? new Date(
                      `${actual.fechaEnvioCliente}T12:00:00`,
                    ).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </div>
            </div>

            <table className="w-full border-collapse overflow-hidden rounded-md border border-linea text-[11.5px]">
              <thead>
                <tr className="bg-superficie text-left text-[10px] uppercase tracking-wide text-tinta-tenue">
                  <th className="px-3 py-2 font-semibold">Proveedor</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {actual.lineas.map((l) => (
                  <tr key={l.orden} className="border-t border-linea-suave">
                    <td className="px-3 py-2">{l.proveedor}</td>
                    <td className="px-3 py-2 text-tinta-suave">
                      {l.descripcion || '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {l.cantidad}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatearMonto(l.subtotal, actual.moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end text-[13px]">
              <div className="w-60">
                <div className="flex justify-between py-1">
                  <span className="text-tinta-tenue">Subtotal</span>
                  <span className="font-mono">
                    {formatearMonto(totales.subtotal, actual.moneda)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-tinta-tenue">
                    Fee ({actual.feePorcentaje}%)
                  </span>
                  <span className="font-mono">
                    {formatearMonto(totales.fee, actual.moneda)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-tinta-tenue">IGV (18%)</span>
                  <span className="font-mono">
                    {formatearMonto(totales.igv, actual.moneda)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t-2 border-tinta pt-2 font-bold">
                  <span>Total</span>
                  <span className="font-mono">
                    {formatearMonto(totales.total, actual.moneda)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-linea pt-3 text-[10.5px] leading-relaxed text-tinta-tenue">
              • {EMPRESA.notaCotizacion}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-linea px-6 py-4">
          <button
            onClick={() => setObservando(true)}
            disabled={procesando}
            className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
          >
            Devolver con observaciones
          </button>
          <button
            onClick={aprobar}
            disabled={procesando}
            className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-[15px] w-[15px]"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {procesando ? 'Procesando…' : 'Aprobar y generar PDF'}
          </button>
        </div>
      </div>

      {/* Modal: escribir observación */}
      {observando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">
              Observar <span className="font-mono">{actual.codigo}</span>
            </h3>
            <p className="mt-1 text-[12.5px] text-tinta-suave">
              La cotización volverá a {actual.ejecutivo} con tu observación
              (conserva su código). Le llegará un correo interno.
            </p>
            <textarea
              value={textoObs}
              onChange={(e) => setTextoObs(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Ej. El precio de la línea 2 supera lo acordado con el proveedor…"
              className="mt-4 w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-petroleo"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => setObservando(false)}
                disabled={procesando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
              >
                Cancelar
              </button>
              <button
                onClick={observar}
                disabled={procesando || !textoObs.trim()}
                className="rounded-lg bg-terracota px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-terracota-oscuro disabled:opacity-60"
              >
                {procesando ? 'Enviando…' : 'Devolver al ejecutivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: resultado (checklist como el prototipo) */}
      {resuelta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-flotante">
            <div className="p-6">
              <div
                className={`mb-4 flex items-center gap-3.5 rounded-[10px] p-4 ${
                  resuelta.tipo === 'aprobada' ? 'bg-verde-fondo' : 'bg-ambar-fondo'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white ${
                    resuelta.tipo === 'aprobada' ? 'bg-verde' : 'bg-ambar'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-5 w-5"
                  >
                    {resuelta.tipo === 'aprobada' ? (
                      <path d="M20 6 9 17l-5-5" />
                    ) : (
                      <path d="M3 12h18M13 6l6 6-6 6" />
                    )}
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-bold">
                    <span className="font-mono">{resuelta.codigo}</span>{' '}
                    {resuelta.tipo === 'aprobada'
                      ? 'aprobada'
                      : 'devuelta al ejecutivo'}
                  </div>
                  <div className="text-[12px] text-tinta-suave">
                    El sistema hizo esto automáticamente:
                  </div>
                </div>
              </div>

              <ul className="space-y-2.5 text-[13px]">
                {resuelta.tipo === 'aprobada' ? (
                  <>
                    <li className="flex gap-2.5">
                      <span className="text-verde">✓</span> Generó el PDF con
                      formato Métrica
                    </li>
                    <li className="flex gap-2.5">
                      <span className="text-verde">✓</span> Lo guardó en el
                      archivo del sistema
                    </li>
                    <li className="flex gap-2.5">
                      <span className="text-verde">✓</span> Marcó la cotización
                      como aprobada
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-2.5">
                      <span className="text-verde">✓</span> Registró tu
                      observación
                    </li>
                    <li className="flex gap-2.5">
                      <span className="text-verde">✓</span> Devolvió la
                      cotización al ejecutivo (mismo código)
                    </li>
                  </>
                )}
                <li className="flex gap-2.5">
                  <span
                    className={
                      resuelta.correo.startsWith('Correo enviado')
                        ? 'text-verde'
                        : 'text-ambar'
                    }
                  >
                    {resuelta.correo.startsWith('Correo enviado') ? '✓' : '⚠'}
                  </span>
                  {resuelta.correo}
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-linea px-6 py-4">
              {resuelta.tipo === 'aprobada' && resuelta.url && (
                <a
                  href={resuelta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-[15px] w-[15px]"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar PDF
                </a>
              )}
              <button
                onClick={siguiente}
                className="rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro"
              >
                {pendientes.length > 1 ? 'Siguiente pendiente →' : 'Listo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
