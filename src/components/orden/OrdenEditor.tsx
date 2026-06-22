'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { guardarOrden, type DatosOrden, type TipoProveedor } from '@/actions/ordenes';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { type Moneda } from '@/lib/calculos';

export type OrdenEditorProps = {
  ordenId: string;
  codigo: string;
  estado: string;
  fichaId: string;
  fichaCodigo: string;
  cotizacionId: string | null;
  cotizacionCodigo: string;
  inicial: DatosOrden;
};

export function OrdenEditor(props: OrdenEditorProps) {
  const router = useRouter();
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [d, setD] = useState<DatosOrden>(props.inicial);

  const editable = props.estado === 'borrador';
  const fijar = <K extends keyof DatosOrden>(k: K, v: DatosOrden[K]) =>
    setD((x) => ({ ...x, [k]: v }));

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

      {!editable && (
        <div className="mb-5 rounded-[10px] border border-azul/30 bg-azul-fondo p-3.5 text-[12.5px] text-azul">
          {props.estado === 'emitida'
            ? 'Esta orden ya fue emitida. Es solo lectura.'
            : 'Esta orden está anulada. Es solo lectura.'}
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

        {editable && (
          <div className="flex justify-end">
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
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
