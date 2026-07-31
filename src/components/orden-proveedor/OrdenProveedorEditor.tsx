'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  anularOrdenProveedor,
  eliminarOrdenProveedor,
  emitirOrdenProveedor,
  guardarOrdenProveedor,
  reabrirOrdenProveedor,
  type DatosOrdenProveedor,
} from '@/actions/ordenes-proveedores';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { calcularImpuestos, type TipoComprobante } from '@/config/impuestos';
import { formatearMonto, redondear, type Moneda } from '@/lib/calculos';
import {
  ETIQUETA_TIPO_PROVEEDOR,
  TIPOS_PROVEEDOR_ODA,
  montoAlcanzaMinimo,
  textoMinimo,
  type TipoProveedorOda,
} from '@/config/oda-proveedores';

// Editor de una ODA a proveedores. Es hermano de OrdenEditor pero no el mismo:
// aquí no hay agencia, ni influencer, ni ficha, ni cotización de la que colgar.
// A cambio hay tipo de proveedor y un mínimo que respetar.

type LineaFila = { descripcion: string; cantidad: string; precioUnitario: string };
const lineaVacia = (): LineaFila => ({ descripcion: '', cantidad: '1', precioUnitario: '' });

export type OrdenProveedorEditorProps = {
  ordenId: string;
  codigo: string;
  estado: string;
  pdfHref: string | null;
  motivoAnulacion: string | null;
  inicial: DatosOrdenProveedor;
};

export function OrdenProveedorEditor(props: OrdenProveedorEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [ocupado, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<DatosOrdenProveedor>(props.inicial);
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
  const fijar = <K extends keyof DatosOrdenProveedor>(k: K, v: DatosOrdenProveedor[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  const fijarLinea = (i: number, k: keyof LineaFila, v: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const agregarLinea = () => setLineas((ls) => [...ls, lineaVacia()]);
  const quitarLinea = (i: number) =>
    setLineas((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)));

  const totalLinea = (l: LineaFila) =>
    redondear((parseFloat(l.cantidad) || 0) * (parseFloat(l.precioUnitario) || 0));
  const total = redondear(lineas.reduce((a, l) => a + totalLinea(l), 0));
  const imp = calcularImpuestos(total, d.tipoComprobante);

  // El mínimo se mide sobre la base SIN IGV. El aviso aparece apenas el monto
  // queda corto, para no descubrirlo recién al pulsar Emitir; la barrera de
  // verdad está en el servidor.
  const alcanza = montoAlcanzaMinimo(total, d.moneda);
  const faltaMonto = total > 0 && !alcanza;

  const payload = (): DatosOrdenProveedor => ({
    ...d,
    detalles: lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: parseFloat(l.cantidad) || 0,
      precioUnitario: parseFloat(l.precioUnitario) || 0,
    })),
  });

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await guardarOrdenProveedor(props.ordenId, payload());
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Cambios guardados.' });
        router.refresh();
      }
    });
  }

  function emitir() {
    setError(null);
    startTransition(async () => {
      // Guarda primero para emitir con lo que está en pantalla.
      const g = await guardarOrdenProveedor(props.ordenId, payload());
      if ('error' in g) {
        setError(g.error);
        return;
      }
      const r = await emitirOrdenProveedor(props.ordenId);
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Orden emitida · PDF generado. Ya puedes descargarlo.' });
        router.refresh();
      }
    });
  }

  function reabrir() {
    setError(null);
    startTransition(async () => {
      const r = await reabrirOrdenProveedor(props.ordenId);
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Orden reabierta. Corrige lo necesario y vuelve a emitir.' });
        router.refresh();
      }
    });
  }

  function anular() {
    const motivo = prompt(
      'Anular esta orden. El código no se reutiliza nunca.\n\n¿Motivo?',
    );
    if (motivo === null) return;
    setError(null);
    startTransition(async () => {
      const r = await anularOrdenProveedor(props.ordenId, motivo);
      if ('error' in r) setError(r.error);
      else {
        toast({ tipo: 'info', texto: 'Orden anulada.' });
        router.refresh();
      }
    });
  }

  function borrar() {
    // Confirmación con el código escrito: borrar no tiene vuelta atrás, y
    // conviene que quien pulsa vea qué orden va a desaparecer.
    if (
      !confirm(
        `Borrar la orden ${props.codigo} por completo.\n\n` +
          'Desaparece del sistema con todo su detalle y no se puede recuperar. ' +
          'El número no se reutiliza.\n\n' +
          'Si la orden ya salió al proveedor, usa Anular en vez de Borrar: así queda registrada con su motivo.',
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarOrdenProveedor(props.ordenId);
      if ('error' in r) setError(r.error);
      else {
        toast({ tipo: 'info', texto: `Orden ${props.codigo} borrada.` });
        router.push('/ordenes/proveedores');
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Orden a proveedor{' '}
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
            href="/ordenes/proveedores"
            className="text-[12.5px] font-semibold text-petroleo-oscuro hover:underline"
          >
            Volver a la lista
          </Link>
          <BadgeEstado estado={props.estado} />
        </div>
      </div>

      {props.estado === 'emitida' && (
        <div className="mb-5 rounded-[10px] border border-azul/30 bg-azul-fondo p-3.5 text-[12.5px] text-azul">
          Esta orden ya fue emitida. Es solo lectura; si necesitas corregir algo,
          pulsa <b>Reabrir</b> para volver a editarla y emitirla de nuevo.
        </div>
      )}
      {props.estado === 'anulada' && (
        <div className="mb-5 rounded-[10px] border border-rojo/30 bg-rojo-fondo p-3.5 text-[12.5px] text-rojo">
          Orden anulada
          {props.motivoAnulacion ? ` — "${props.motivoAnulacion}"` : ''}. Su código no
          se reutiliza.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[13px] text-rojo">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <Tarjeta titulo="Proveedor">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Razón social (nombre legal)">
              <input
                value={d.razonSocial}
                disabled={!editable}
                placeholder="Ej. Andina Suscripciones S.A.C."
                onChange={(e) => fijar('razonSocial', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Nombre comercial">
              <input
                value={d.nombreComercial}
                disabled={!editable}
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
                  fijar('tipoProveedor', e.target.value as TipoProveedorOda)
                }
                className={inputCls}
              >
                {TIPOS_PROVEEDOR_ODA.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO_PROVEEDOR[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Tipo de comprobante">
              <select
                value={d.tipoComprobante}
                disabled={!editable}
                onChange={(e) =>
                  fijar('tipoComprobante', e.target.value as TipoComprobante)
                }
                className={inputCls}
              >
                <option value="factura">Factura (con IGV)</option>
                <option value="rxh">Recibo por Honorarios (sin IGV)</option>
              </select>
            </Campo>
            <Campo label="Condiciones de pago">
              <input
                value={d.condicionesPago}
                disabled={!editable}
                placeholder="Ej. Pago mensual por adelantado"
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
                  <th className="w-32 px-1 py-1 text-right font-semibold">P. unitario</th>
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
                        placeholder="Ej. Suscripción anual a base de datos"
                        onChange={(e) => fijarLinea(i, 'descripcion', e.target.value)}
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
                        onChange={(e) => fijarLinea(i, 'cantidad', e.target.value)}
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
                        onChange={(e) => fijarLinea(i, 'precioUnitario', e.target.value)}
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

          <div className="mt-5 flex justify-end">
            <div className="w-72">
              {imp.conIgv && (
                <>
                  <div className="flex justify-between border-b border-linea-suave py-1.5 text-[13px]">
                    <span className="text-tinta-tenue">Subtotal</span>
                    <span className="font-mono">{formatearMonto(imp.base, d.moneda)}</span>
                  </div>
                  <div className="flex justify-between border-b border-linea-suave py-1.5 text-[13px]">
                    <span className="text-tinta-tenue">IGV ({imp.porcentaje}%)</span>
                    <span className="font-mono">{formatearMonto(imp.igv, d.moneda)}</span>
                  </div>
                </>
              )}
              <div className="mt-1 flex justify-between border-t-2 border-tinta pt-2 text-[15px] font-bold">
                <span>Total</span>
                <span className="font-mono">{formatearMonto(imp.total, d.moneda)}</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11.5px] text-tinta-tenue">
            {imp.conIgv
              ? `Comprobante factura: se agrega IGV (${imp.porcentaje}%).`
              : 'Recibo por Honorarios: sin IGV; se muestra únicamente el total.'}
          </p>

          {/* El aviso del mínimo. Aparece apenas el monto queda corto para que
              no se descubra recién al intentar emitir, con la orden ya escrita. */}
          {faltaMonto && editable && (
            <div className="mt-3 rounded-[10px] border border-ambar/30 bg-ambar-fondo px-4 py-3 text-[12.5px] text-ambar">
              Estas órdenes se emiten desde <b>{textoMinimo(d.moneda)}</b> sin IGV, y
              esta suma {formatearMonto(total, d.moneda)}. Puedes guardarla como
              borrador, pero no emitirla.
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Datos de pago">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Banco">
              <input
                value={d.banco}
                disabled={!editable}
                onChange={(e) => fijar('banco', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="Cuenta">
              <input
                value={d.cuenta}
                disabled={!editable}
                onChange={(e) => fijar('cuenta', e.target.value)}
                className={inputCls}
              />
            </Campo>
            <Campo label="CCI">
              <input
                value={d.cci}
                disabled={!editable}
                onChange={(e) => fijar('cci', e.target.value)}
                className={`${inputCls} font-mono`}
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
          {/* Borrar y Anular resuelven cosas distintas y por eso conviven:
              anular deja constancia de una orden que existió y salió; borrar
              hace desaparecer la que nunca debió crearse. */}
          <button
            onClick={borrar}
            disabled={ocupado}
            title="Elimina la orden por completo. Úsalo solo si nunca salió al proveedor."
            className="mr-auto rounded-lg px-3 py-2 text-[13px] font-semibold text-tinta-tenue transition hover:bg-rojo-fondo hover:text-rojo disabled:opacity-60"
          >
            Borrar
          </button>
          {props.estado !== 'anulada' && (
            <button
              onClick={anular}
              disabled={ocupado}
              title="Deja la orden sin efecto pero la conserva a la vista, con su motivo."
              className="rounded-lg border border-rojo/30 bg-white px-4 py-2 text-[13px] font-semibold text-rojo transition hover:bg-rojo-fondo disabled:opacity-60"
            >
              Anular
            </button>
          )}
          {props.estado === 'emitida' && (
            <button
              onClick={reabrir}
              disabled={ocupado}
              title="Vuelve la orden a borrador para corregir y volver a emitir"
              className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
            >
              {ocupado ? 'Reabriendo…' : 'Reabrir'}
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
                disabled={ocupado}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
              >
                {ocupado ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                onClick={emitir}
                // Deshabilitado si no alcanza el mínimo: el título explica por
                // qué, para que el botón apagado no parezca un fallo.
                disabled={ocupado || !alcanza}
                title={
                  alcanza
                    ? undefined
                    : `Estas órdenes se emiten desde ${textoMinimo(d.moneda)} sin IGV.`
                }
                className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-40"
              >
                {ocupado ? (
                  <Spinner />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[15px] w-[15px]">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {ocupado ? 'Procesando…' : 'Emitir y generar PDF'}
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

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-linea bg-white p-6 shadow-tarjeta">
      <h2 className="mb-4 text-[14.5px] font-bold">{titulo}</h2>
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-tinta-tenue">
        {label}
      </span>
      {children}
    </label>
  );
}
