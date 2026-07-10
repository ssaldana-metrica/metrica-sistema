'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  guardarCotizacion,
  type EntradaCotizacion,
} from '@/actions/cotizaciones';
import {
  calcularTotales,
  formatearMonto,
  redondear,
  type Moneda,
} from '@/lib/calculos';
import { NUEVO_CLIENTE } from '@/lib/util';
import { Spinner } from '@/components/ui/Spinner';

type LineaUI = {
  proveedor: string;
  descripcion: string;
  cantidad: string; // como texto para permitir el campo vacío al escribir
  precio: string;
};

export type CotizacionInicial = {
  clienteId: string;
  proyecto: string;
  moneda: Moneda;
  feePorcentaje: number;
  fechaEnvioCliente: string | null;
  estado: string;
  observacionAdmin: string | null;
  lineas: {
    proveedor: string;
    descripcion: string;
    cantidad: number;
    precio: number;
  }[];
};

const MAX_LINEAS = 40;
const LINEA_VACIA: LineaUI = { proveedor: '', descripcion: '', cantidad: '1', precio: '' };

export function FormularioCotizacion({
  codigo,
  ejecutivoNombre,
  clientes,
  proveedores,
  inicial,
}: {
  codigo: string;
  ejecutivoNombre: string;
  clientes: { id: string; nombre: string }[];
  proveedores: string[];
  inicial: CotizacionInicial | null;
}) {
  const [clienteId, setClienteId] = useState(inicial?.clienteId ?? '');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaRazon, setNuevaRazon] = useState('');
  const [nuevoRuc, setNuevoRuc] = useState('');
  const [proyecto, setProyecto] = useState(inicial?.proyecto ?? '');
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? 'PEN');
  const [fee, setFee] = useState(
    inicial ? String(inicial.feePorcentaje) : '12',
  );
  const [fecha, setFecha] = useState(inicial?.fechaEnvioCliente ?? '');
  const [lineas, setLineas] = useState<LineaUI[]>(
    inicial && inicial.lineas.length > 0
      ? inicial.lineas.map((l) => ({
          proveedor: l.proveedor,
          descripcion: l.descripcion,
          cantidad: String(l.cantidad),
          precio: String(l.precio),
        }))
      : [{ ...LINEA_VACIA }],
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  const totales = useMemo(
    () =>
      calcularTotales(
        lineas.map((l) => ({
          cantidad: parseFloat(l.cantidad) || 0,
          precioUnitario: parseFloat(l.precio) || 0,
        })),
        parseFloat(fee) || 0,
      ),
    [lineas, fee],
  );

  function actualizar(i: number, campo: keyof LineaUI, valor: string) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    if (lineas.length >= MAX_LINEAS) return;
    setLineas((ls) => [...ls, { ...LINEA_VACIA }]);
  }

  function quitarLinea(i: number) {
    setLineas((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)));
  }

  function guardar(enviar: boolean) {
    setError(null);
    const entrada: EntradaCotizacion = {
      codigo,
      clienteId,
      clienteNuevo:
        clienteId === NUEVO_CLIENTE
          ? { nombre: nuevoNombre, razonSocial: nuevaRazon, ruc: nuevoRuc }
          : undefined,
      proyecto,
      moneda,
      feePorcentaje: parseFloat(fee) || 0,
      fechaEnvioCliente: fecha || null,
      lineas: lineas.map((l) => ({
        proveedorNombre: l.proveedor,
        descripcion: l.descripcion,
        cantidad: parseFloat(l.cantidad) || 0,
        precioUnitario: parseFloat(l.precio) || 0,
      })),
    };
    startTransition(async () => {
      const r = await guardarCotizacion(entrada, enviar);
      if (r?.error) setError(r.error); // si todo va bien, la acción redirige
    });
  }

  const labelClase =
    'mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-tinta-suave';
  const inputClase =
    'w-full rounded-lg border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo';

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            {inicial ? 'Editar cotización' : 'Nueva cotización'}{' '}
            {codigo ? (
              <span className="ml-2 font-mono text-[15px] text-petroleo-oscuro">
                {codigo}
              </span>
            ) : (
              <span className="ml-2 text-[12.5px] font-normal text-tinta-tenue">
                · el código se asigna al guardar
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            {inicial?.estado === 'observada'
              ? 'Corrige lo observado y reenvía — el código se conserva.'
              : 'Llena los datos y guarda: el banco le asignará el código correlativo.'}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => guardar(false)}
            disabled={guardando}
            className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => guardar(true)}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white shadow-tarjeta transition hover:bg-petroleo-oscuro disabled:opacity-60"
          >
            {guardando ? (
              <Spinner />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-[15px] w-[15px]"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
            {guardando
              ? 'Procesando…'
              : inicial?.estado === 'observada'
                ? 'Reenviar a aprobación'
                : 'Enviar a aprobación'}
          </button>
        </div>
      </div>

      {/* Observación del admin (cuando regresa observada) */}
      {inicial?.estado === 'observada' && inicial.observacionAdmin && (
        <div className="mb-5 flex gap-2.5 rounded-[10px] border border-ambar/30 bg-ambar-fondo p-3.5 text-[12.5px] text-ambar">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-px h-[17px] w-[17px] shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <span className="font-bold">Observación de administración: </span>
            {inicial.observacionAdmin}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-4 py-3 text-[13px] text-rojo">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-linea bg-white p-6 shadow-tarjeta">
        {/* Datos generales */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClase}>Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={inputClase}
            >
              <option value="">— Selecciona —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
              <option value={NUEVO_CLIENTE}>＋ Registrar cliente nuevo…</option>
            </select>
          </div>
          <div>
            <label className={labelClase}>Proyecto / Servicio</label>
            <input
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              placeholder="Ej. Campaña Día de la Madre"
              className={inputClase}
            />
          </div>
          <div>
            <label className={labelClase}>Ejecutivo</label>
            <input
              value={ejecutivoNombre}
              readOnly
              className={`${inputClase} bg-superficie font-mono text-tinta-tenue`}
            />
          </div>
          <div>
            <label className={labelClase}>Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Moneda)}
              className={inputClase}
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div>
            <label className={labelClase}>Fee de intermediación (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={inputClase}
            />
          </div>
          <div>
            <label className={labelClase}>Fecha de envío al cliente</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputClase}
            />
          </div>
        </div>

        {clienteId === NUEVO_CLIENTE && (
          <div className="mb-6 rounded-[10px] border border-petroleo/25 bg-verde-fondo/40 p-4">
            <div className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-petroleo-oscuro">
              Datos del cliente nuevo
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClase}>Nombre comercial *</label>
                <input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej. Cementos Lima"
                  className={inputClase}
                />
              </div>
              <div>
                <label className={labelClase}>Razón social</label>
                <input
                  value={nuevaRazon}
                  onChange={(e) => setNuevaRazon(e.target.value)}
                  placeholder="Si se deja vacío, usa el nombre"
                  className={inputClase}
                />
              </div>
              <div>
                <label className={labelClase}>RUC</label>
                <input
                  value={nuevoRuc}
                  onChange={(e) => setNuevoRuc(e.target.value)}
                  placeholder="Opcional, se puede completar luego"
                  className={inputClase}
                />
              </div>
            </div>
          </div>
        )}

        {/* Líneas de proveedor */}
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-[14px] font-bold">Proveedores</h2>
            <p className="text-[12px] text-tinta-tenue">
              {lineas.length} de {MAX_LINEAS} líneas
            </p>
          </div>
          <button
            onClick={agregarLinea}
            disabled={lineas.length >= MAX_LINEAS}
            className="flex items-center gap-1.5 rounded-lg border border-linea bg-white px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-superficie disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar línea
          </button>
        </div>

        <datalist id="lista-proveedores">
          {proveedores.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="w-9 px-2 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Proveedor</th>
              <th className="px-2 py-2 font-semibold">Descripción</th>
              <th className="w-20 px-2 py-2 font-semibold">Cant.</th>
              <th className="w-28 px-2 py-2 font-semibold">P. unit.</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">
                Subtotal
              </th>
              <th className="w-9 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i} className="border-b border-linea-suave">
                <td className="px-2 py-1.5 text-center font-mono text-[12px] text-tinta-tenue">
                  {i + 1}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    list="lista-proveedores"
                    value={l.proveedor}
                    onChange={(e) => actualizar(i, 'proveedor', e.target.value)}
                    placeholder="Nombre del proveedor"
                    className="w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={l.descripcion}
                    onChange={(e) =>
                      actualizar(i, 'descripcion', e.target.value)
                    }
                    placeholder="Servicio / entregable"
                    className="w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min="0"
                    value={l.cantidad}
                    onChange={(e) => actualizar(i, 'cantidad', e.target.value)}
                    className="w-full rounded-md border border-linea bg-white px-2 py-1.5 text-right font-mono text-[12.5px] outline-none focus:border-petroleo"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.precio}
                    onChange={(e) => actualizar(i, 'precio', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-linea bg-white px-2 py-1.5 text-right font-mono text-[12.5px] outline-none focus:border-petroleo"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-[12.5px] font-semibold">
                  {formatearMonto(
                    redondear(
                      (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0),
                    ),
                    moneda,
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    onClick={() => quitarLinea(i)}
                    disabled={lineas.length === 1}
                    title="Quitar línea"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-rojo transition hover:bg-rojo-fondo disabled:opacity-30"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-[15px] w-[15px]"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-5 flex justify-end">
          <div className="w-80">
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>Subtotal proveedores</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.subtotal, moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>Fee intermediación ({parseFloat(fee) || 0}%)</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.fee, moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px] font-semibold">
              <span>Monto neto</span>
              <span className="font-mono">
                {formatearMonto(totales.neto, moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>IGV (18%)</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.igv, moneda)}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-tinta pt-3 text-[16px] font-bold">
              <span>Total</span>
              <span className="font-mono">
                {formatearMonto(totales.total, moneda)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
