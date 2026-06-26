'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  emitirOrden,
  guardarOrden,
  reabrirOrden,
  type DatosOrden,
  type TipoProveedor,
} from '@/actions/ordenes';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { Spinner } from '@/components/ui/Spinner';
import { calcularImpuestos } from '@/config/impuestos';
import { formatearMonto, redondear, type Moneda } from '@/lib/calculos';

type LineaFila = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
};
const lineaVacia = (): LineaFila => ({
  descripcion: '',
  cantidad: '1',
  precioUnitario: '',
});

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
  const [lineas, setLineas] = useState<LineaFila[]>(
    props.inicial.detalles.length
      ? props.inicial.detalles.map((x) => ({
          descripcion: x.descripcion,
          cantidad: x.cantidad ? String(x.cantidad) : '1',
          precioUnitario: x.precioUnitario ? String(x.precioUnitario) : '',
        }))
      : [lineaVacia()],
  );
  const editable = props.estado === 'borrador';
  const fijar = <K extends keyof DatosOrden>(k: K, v: DatosOrden[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const fijarLinea = (i: number, k: keyof LineaFila, v: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const agregarLinea = () => setLineas((ls) => [...ls, lineaVacia()]);
  const quitarLinea = (i: number) =>
    setLineas((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)));

  const totalLinea = (l: LineaFila) =>
    redondear((parseFloat(l.cantidad) || 0) * (parseFloat(l.precioUnitario) || 0));
  const total = lineas.reduce((a, l) => a + totalLinea(l), 0);
  const imp = calcularImpuestos(redondear(total), d.tipoProveedor);

  const payload = (): DatosOrden => ({
    ...d,
    detalles: lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: parseFloat(l.cantidad) || 0,
      precioUnitario: parseFloat(l.precioUnitario) || 0,
    })),
  });

  function guardar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await guardarOrden(props.ordenId, payload());
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
      const g = await guardarOrden(props.ordenId, payload());
      if ('error' in g) {
        setError(g.error);
        return;
      }
      const r = await emitirOrden(props.ordenId);
      if ('error' in r) setError(r.error);
      else {
        setAviso('Orden emitida · PDF generado. Ya puedes descargarlo.');
        router.refresh();
      }
    });
  }

  function reabrir() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await reabrirOrden(props.ordenId);
      if ('error' in r) setError(r.error);
      else {
        setAviso('Orden reabierta. Corrige lo necesario y vuelve a emitir.');
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
          Esta orden ya fue emitida. Es solo lectura; si necesitas corregir
          algo, pulsa <b>Reabrir</b> para volver a editarla y emitirla de nuevo.
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

        <Tarjeta titulo="Detalle de la compra">
          <div className="mb-4 sm:w-1/2">
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-tinta-tenue">
                  <th className="w-10 px-1 py-1 font-semibold">N°</th>
                  <th className="px-1 py-1 font-semibold">Descripción</th>
                  <th className="w-20 px-1 py-1 text-right font-semibold">Cant.</th>
                  <th className="w-32 px-1 py-1 text-right font-semibold">
                    P. unitario
                  </th>
                  <th className="w-32 px-1 py-1 text-right font-semibold">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-t border-linea-suave">
                    <td className="px-1 py-1 text-center font-mono text-[12.5px] text-tinta-tenue">
                      {i + 1}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={l.descripcion}
                        disabled={!editable}
                        placeholder="Ej. Producción de 3 reels"
                        onChange={(e) =>
                          fijarLinea(i, 'descripcion', e.target.value)
                        }
                        className={celdaCls}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.cantidad}
                        disabled={!editable}
                        onChange={(e) =>
                          fijarLinea(i, 'cantidad', e.target.value)
                        }
                        className={`${celdaCls} text-right font-mono`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.precioUnitario}
                        disabled={!editable}
                        onChange={(e) =>
                          fijarLinea(i, 'precioUnitario', e.target.value)
                        }
                        className={`${celdaCls} text-right font-mono`}
                      />
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-[12.5px] font-semibold">
                      {formatearMonto(totalLinea(l), d.moneda)}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => quitarLinea(i)}
                        disabled={!editable || lineas.length === 1}
                        title="Quitar línea"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rojo transition hover:bg-rojo-fondo disabled:opacity-30"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable && (
            <button
              onClick={agregarLinea}
              className="mt-3 rounded-lg border border-linea bg-white px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-superficie"
            >
              + Detalle de compra
            </button>
          )}

          {/* Total + impuestos */}
          <div className="mt-5 flex justify-end">
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

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {props.estado === 'emitida' && (
            <button
              onClick={reabrir}
              disabled={guardando}
              title="Vuelve la orden a borrador para corregir y volver a emitir"
              className="mr-auto rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
            >
              {guardando ? 'Reabriendo…' : 'Reabrir'}
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
                {guardando ? (
                  <Spinner />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[15px] w-[15px]">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {guardando ? 'Procesando…' : 'Emitir y generar PDF'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'mt-1 w-full rounded-md border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';
const celdaCls =
  'w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';

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
