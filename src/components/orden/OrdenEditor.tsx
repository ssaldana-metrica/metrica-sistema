'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  anularOrden,
  emitirOrden,
  guardarOrden,
  type DatosOrden,
  type TipoProveedor,
} from '@/actions/ordenes';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { calcularImpuestos } from '@/config/impuestos';
import { formatearMonto, type Moneda } from '@/lib/calculos';

export type OrdenEditorProps = {
  ordenId: string;
  codigo: string;
  estado: string;
  fichaId: string;
  fichaCodigo: string;
  cotizacionId: string | null;
  cotizacionCodigo: string;
  pdfHref: string | null;
  motivoAnulacion: string | null;
  inicial: DatosOrden;
};

export function OrdenEditor(props: OrdenEditorProps) {
  const router = useRouter();
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [d, setD] = useState<DatosOrden>(props.inicial);
  const [modalAnular, setModalAnular] = useState(false);
  const [motivo, setMotivo] = useState('');

  const editable = props.estado === 'borrador';
  const anulable = props.estado === 'borrador' || props.estado === 'emitida';
  const fijar = <K extends keyof DatosOrden>(k: K, v: DatosOrden[K]) =>
    setD((x) => ({ ...x, [k]: v }));

  const imp = calcularImpuestos(d.monto, d.tipoProveedor);

  function guardar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await guardarOrden(props.ordenId, d);
      if ('error' in r) setError(r.error);
      else {
        setAviso('Cambios guardados.');
        router.refresh();
      }
    });
  }

  function emitir() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      // Guarda primero para emitir con los datos en pantalla.
      const g = await guardarOrden(props.ordenId, d);
      if ('error' in g) {
        setError(g.error);
        return;
      }
      const r = await emitirOrden(props.ordenId);
      if ('error' in r) setError(r.error);
      else router.refresh();
    });
  }

  function anular() {
    setError(null);
    startTransition(async () => {
      const r = await anularOrden(props.ordenId, motivo);
      if ('error' in r) setError(r.error);
      else {
        setModalAnular(false);
        setMotivo('');
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Orden de adquisición{' '}
            <span className="ml-2 font-mono text-[15px] text-petroleo-oscuro">
              {props.codigo}
            </span>
          </h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            {d.razonSocial || d.nombreComercial || 'Proveedor sin nombre'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/fichas/${props.fichaId}`}
            className="text-[12.5px] font-semibold text-petroleo-oscuro hover:underline"
          >
            Volver a la ficha
          </Link>
          {props.cotizacionId && (
            <Link
              href={`/cotizaciones/${props.cotizacionId}`}
              className="text-[12.5px] font-semibold text-petroleo-oscuro hover:underline"
            >
              Ver cotización {props.cotizacionCodigo}
            </Link>
          )}
          <BadgeEstado estado={props.estado} />
        </div>
      </div>

      {props.estado === 'emitida' && (
        <div className="mb-5 rounded-[10px] border border-azul/30 bg-azul-fondo p-3.5 text-[12.5px] text-azul">
          Esta orden ya fue emitida. Es solo lectura (puedes anularla si hace
          falta).
        </div>
      )}
      {props.estado === 'anulada' && (
        <div className="mb-5 rounded-[10px] border border-rojo/30 bg-rojo-fondo p-3.5 text-[12.5px] text-rojo">
          Orden anulada
          {props.motivoAnulacion ? ` — "${props.motivoAnulacion}"` : ''}. Su
          código no se reutiliza.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[13px] text-rojo">
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-[10px] border border-verde/30 bg-verde-fondo px-4 py-3 text-[13px] text-verde">
          {aviso}
        </div>
      )}

      <div className="space-y-5">
        <Tarjeta titulo="Proveedor">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Razón social (nombre legal)">
              <input
                value={d.razonSocial}
                disabled={!editable}
                placeholder="Ej. Lima Films S.A.C."
                onChange={(e) => fijar('razonSocial', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Nombre comercial">
              <input
                value={d.nombreComercial}
                disabled={!editable}
                placeholder="Ej. Lima Films"
                onChange={(e) => fijar('nombreComercial', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="RUC">
              <input
                value={d.ruc}
                disabled={!editable}
                onChange={(e) => fijar('ruc', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Tipo de proveedor">
              <select
                value={d.tipoProveedor}
                disabled={!editable}
                onChange={(e) =>
                  fijar('tipoProveedor', e.target.value as TipoProveedor)
                }
                className={inputCls}
              >
                <option value="empresa">Empresa</option>
                <option value="persona_natural">Persona natural</option>
              </select>
            </Campo>
            <Campo label="Agencia">
              <input
                value={d.agencia}
                disabled={!editable}
                onChange={(e) => fijar('agencia', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Influencer / proveedor">
              <input
                value={d.influencerProveedor}
                disabled={!editable}
                onChange={(e) => fijar('influencerProveedor', e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Detalle de la compra">
          <Campo label="Descripción">
            <textarea
              value={d.descripcion}
              disabled={!editable}
              rows={2}
              onChange={(e) => fijar('descripcion', e.target.value)}
              className={inputCls}
            />
          </Campo>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Monto">
              <input
                type="number"
                min="0"
                step="0.01"
                value={String(d.monto)}
                disabled={!editable}
                onChange={(e) =>
                  fijar('monto', parseFloat(e.target.value) || 0)
                }
                className={`${inputCls} text-right font-mono`}
              />
            </Campo>
            <Campo label="Moneda">
              <select
                value={d.moneda}
                disabled={!editable}
                onChange={(e) => fijar('moneda', e.target.value as Moneda)}
                className={inputCls}
              >
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </Campo>
          </div>
          <div className="mt-4">
            <Campo label="Condiciones de pago">
              <input
                value={d.condicionesPago}
                disabled={!editable}
                placeholder="Ej. 50% adelanto, 50% contra entrega"
                onChange={(e) => fijar('condicionesPago', e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Datos de pago">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo label="Banco">
              <input
                value={d.banco}
                disabled={!editable}
                onChange={(e) => fijar('banco', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Cuenta / CCI">
              <input
                value={d.cuentaCci}
                disabled={!editable}
                onChange={(e) => fijar('cuentaCci', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Email del proveedor">
              <input
                type="email"
                value={d.emailProveedor}
                disabled={!editable}
                onChange={(e) => fijar('emailProveedor', e.target.value)}
                className={inputCls}
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Importe">
          <div className="flex justify-end">
            <div className="w-72">
              <div className="flex justify-between border-b border-linea-suave py-1.5 text-[13px]">
                <span className="text-tinta-tenue">
                  {imp.modo === 'igv' ? 'Subtotal' : 'Monto (honorarios)'}
                </span>
                <span className="font-mono">{formatearMonto(imp.base, d.moneda)}</span>
              </div>
              <div className="flex justify-between border-b border-linea-suave py-1.5 text-[13px]">
                <span className="text-tinta-tenue">{imp.etiquetaImpuesto}</span>
                <span className="font-mono">
                  {imp.modo === 'retencion' ? '− ' : ''}
                  {formatearMonto(imp.impuesto, d.moneda)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t-2 border-tinta pt-2 text-[15px] font-bold">
                <span>{imp.etiquetaTotal}</span>
                <span className="font-mono">{formatearMonto(imp.total, d.moneda)}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-tinta-tenue">
            {imp.modo === 'igv'
              ? 'Proveedor empresa: se agrega IGV.'
              : 'Proveedor persona natural: se retiene renta (sin IGV).'}{' '}
            Los porcentajes están pendientes de confirmar con contabilidad.
          </p>
        </Tarjeta>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {anulable && (
            <button
              onClick={() => setModalAnular(true)}
              disabled={guardando}
              className="mr-auto rounded-lg border border-rojo/40 bg-white px-4 py-2 text-[13px] font-semibold text-rojo transition hover:bg-rojo-fondo disabled:opacity-60"
            >
              Anular
            </button>
          )}
          {props.pdfHref && (
            <a
              href={props.pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[15px] w-[15px]">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar PDF
            </a>
          )}
          {editable && (
            <>
              <button
                onClick={guardar}
                disabled={guardando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                onClick={emitir}
                disabled={guardando}
                className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[15px] w-[15px]">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {guardando ? 'Procesando…' : 'Emitir y generar PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal: anular con motivo */}
      {modalAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">
              Anular <span className="font-mono">{props.codigo}</span>
            </h3>
            <p className="mt-1 text-[12.5px] text-tinta-suave">
              La orden quedará anulada (no se borra) y su código no se
              reutiliza. Indica el motivo.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ej. El proveedor canceló el servicio."
              className="mt-4 w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-petroleo"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => setModalAnular(false)}
                disabled={guardando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
              >
                Cancelar
              </button>
              <button
                onClick={anular}
                disabled={guardando || !motivo.trim()}
                className="rounded-lg bg-rojo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rojo/90 disabled:opacity-60"
              >
                {guardando ? 'Anulando…' : 'Anular orden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'mt-1 w-full rounded-md border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-linea bg-white p-6 shadow-tarjeta">
      <h2 className="mb-4 text-[14.5px] font-bold">{titulo}</h2>
      {children}
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-tinta-tenue">
        {label}
      </span>
      {children}
    </label>
  );
}
