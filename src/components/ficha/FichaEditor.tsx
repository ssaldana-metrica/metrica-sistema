'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  guardarFichaEjecutivo,
  marcarListaEjecutivo,
  type DatosEjecutivo,
  type FichaProveedorEntrada,
} from '@/actions/fichas';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { formatearMonto, redondear, type Moneda } from '@/lib/calculos';

type ProveedorFila = {
  agencia: string;
  influencerProveedor: string;
  ruc: string;
  descripcion: string;
  monto: string;
  banco: string;
  cuentaCci: string;
  emailProveedor: string;
};

const filaVacia = (): ProveedorFila => ({
  agencia: '',
  influencerProveedor: '',
  ruc: '',
  descripcion: '',
  monto: '',
  banco: '',
  cuentaCci: '',
  emailProveedor: '',
});

export type FichaEditorProps = {
  fichaId: string;
  codigo: string;
  estado: string;
  cotizacionId: string;
  cotizacionCodigo: string;
  proyecto: string;
  ejecutivo: string;
  puedeEditar: boolean;
  esAdmin: boolean;
  inicial: DatosEjecutivo;
  proveedoresIniciales: ProveedorFila[];
};

export function FichaEditor(props: FichaEditorProps) {
  const router = useRouter();
  const [pestana, setPestana] = useState<'ejecutivo' | 'admin'>('ejecutivo');
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [datos, setDatos] = useState<DatosEjecutivo>(props.inicial);
  const [provs, setProvs] = useState<ProveedorFila[]>(
    props.proveedoresIniciales.length
      ? props.proveedoresIniciales
      : [filaVacia()],
  );

  const editable = props.puedeEditar;

  const fijar = <K extends keyof DatosEjecutivo>(k: K, v: DatosEjecutivo[K]) =>
    setDatos((d) => ({ ...d, [k]: v }));
  const fijarProv = (i: number, k: keyof ProveedorFila, v: string) =>
    setProvs((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const agregar = () => setProvs((ps) => [...ps, filaVacia()]);
  const quitar = (i: number) =>
    setProvs((ps) => (ps.length === 1 ? ps : ps.filter((_, j) => j !== i)));

  const sumaMontos = provs.reduce(
    (s, p) => s + (parseFloat(p.monto) || 0),
    0,
  );

  const aEntrada = (): FichaProveedorEntrada[] =>
    provs
      .filter((p) =>
        [
          p.agencia,
          p.influencerProveedor,
          p.ruc,
          p.descripcion,
          p.monto,
          p.banco,
          p.cuentaCci,
          p.emailProveedor,
        ].some((v) => v.trim()),
      )
      .map((p) => ({
        agencia: p.agencia,
        influencerProveedor: p.influencerProveedor,
        ruc: p.ruc,
        descripcion: p.descripcion,
        monto: parseFloat(p.monto) || 0,
        banco: p.banco,
        cuentaCci: p.cuentaCci,
        emailProveedor: p.emailProveedor,
      }));

  function guardar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await guardarFichaEjecutivo(props.fichaId, datos, aEntrada());
      if ('error' in r) setError(r.error);
      else {
        setAviso('Avance guardado.');
        router.refresh();
      }
    });
  }

  function marcarLista() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await marcarListaEjecutivo(props.fichaId, datos, aEntrada());
      if ('error' in r) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Ficha de apertura{' '}
            <span className="ml-2 font-mono text-[15px] text-petroleo-oscuro">
              {props.codigo}
            </span>
          </h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            {datos.clienteNombre || '—'} · {props.proyecto || 'Sin proyecto'} ·
            ejecutivo {props.ejecutivo}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/cotizaciones/${props.cotizacionId}`}
            className="text-[12.5px] font-semibold text-petroleo-oscuro hover:underline"
          >
            Ver cotización {props.cotizacionCodigo}
          </Link>
          <BadgeEstado estado={props.estado} />
        </div>
      </div>

      {!editable && (
        <div className="mb-5 rounded-[10px] border border-azul/30 bg-azul-fondo p-3.5 text-[12.5px] text-azul">
          {props.estado === 'lista_ejecutivo'
            ? 'Tu parte ya está marcada como lista. Administración hace el seguimiento; si necesitas cambiar algo, pide que la reabran.'
            : props.estado === 'completa'
              ? 'Esta ficha está completa (cerrada por administración). Es solo lectura.'
              : 'Esta ficha es solo lectura para ti.'}
        </div>
      )}

      {/* Pestañas */}
      <div className="mb-5 flex gap-1 border-b border-linea">
        <Tab
          activa={pestana === 'ejecutivo'}
          onClick={() => setPestana('ejecutivo')}
        >
          Ejecutivo
        </Tab>
        {props.esAdmin && (
          <Tab activa={pestana === 'admin'} onClick={() => setPestana('admin')}>
            Admin · seguimiento
          </Tab>
        )}
      </div>

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

      {pestana === 'ejecutivo' ? (
        <div className="space-y-5">
          {/* Datos del cliente */}
          <Tarjeta titulo="Datos del cliente">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Cliente">
                <input
                  type="text"
                  value={datos.clienteNombre}
                  disabled={!editable}
                  onChange={(e) => fijar('clienteNombre', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="RUC">
                <input
                  type="text"
                  value={datos.clienteRuc}
                  disabled={!editable}
                  onChange={(e) => fijar('clienteRuc', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Política de pago">
                <input
                  type="text"
                  value={datos.politicaPago}
                  disabled={!editable}
                  placeholder="Ej. 50% adelanto, 50% contra entrega"
                  onChange={(e) => fijar('politicaPago', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Contacto de aprobación">
                <input
                  type="text"
                  value={datos.contactoAprobacion}
                  disabled={!editable}
                  onChange={(e) => fijar('contactoAprobacion', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Correo del contacto">
                <input
                  type="email"
                  value={datos.correoContacto}
                  disabled={!editable}
                  onChange={(e) => fijar('correoContacto', e.target.value)}
                  className={inputCls}
                />
              </Campo>
            </div>
          </Tarjeta>

          {/* Datos del servicio */}
          <Tarjeta titulo="Datos del servicio">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Inicio de acciones">
                <input
                  type="date"
                  value={datos.inicioAcciones ?? ''}
                  disabled={!editable}
                  onChange={(e) => fijar('inicioAcciones', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Fin de acciones">
                <input
                  type="date"
                  value={datos.finAcciones ?? ''}
                  disabled={!editable}
                  onChange={(e) => fijar('finAcciones', e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Moneda general">
                <select
                  value={datos.moneda}
                  disabled={!editable}
                  onChange={(e) => fijar('moneda', e.target.value as Moneda)}
                  className={inputCls}
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </Campo>
              <Campo label="Facturación">
                <label className="mt-1.5 flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={datos.facturarAntesDelFin}
                    disabled={!editable}
                    onChange={(e) =>
                      fijar('facturarAntesDelFin', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-linea"
                  />
                  Facturar antes del fin de acciones
                </label>
              </Campo>
            </div>
            <Campo label="Observaciones">
              <textarea
                value={datos.observacionesEjecutivo}
                disabled={!editable}
                rows={3}
                onChange={(e) =>
                  fijar('observacionesEjecutivo', e.target.value)
                }
                className={inputCls}
              />
            </Campo>
          </Tarjeta>

          {/* Proveedores (se llena de cero) */}
          <Tarjeta titulo="Proveedores que cobran">
            <p className="-mt-1 mb-3 text-[12px] text-tinta-tenue">
              Quien factura no siempre es quien se cotizó. Llena aquí a quienes
              realmente van a cobrar. Montos en {monedaTexto(datos.moneda)}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-tinta-tenue">
                    <th className="px-2 py-2 font-semibold">Agencia</th>
                    <th className="px-2 py-2 font-semibold">
                      Influencer / proveedor
                    </th>
                    <th className="px-2 py-2 font-semibold">RUC</th>
                    <th className="px-2 py-2 font-semibold">Descripción</th>
                    <th className="px-2 py-2 text-right font-semibold">Monto</th>
                    <th className="px-2 py-2 font-semibold">Banco</th>
                    <th className="px-2 py-2 font-semibold">Cuenta / CCI</th>
                    <th className="px-2 py-2 font-semibold">Email</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {provs.map((p, i) => (
                    <tr key={i} className="border-t border-linea-suave">
                      <td className="px-1 py-1">
                        <input
                          value={p.agencia}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'agencia', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={p.influencerProveedor}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'influencerProveedor', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={p.ruc}
                          disabled={!editable}
                          onChange={(e) => fijarProv(i, 'ruc', e.target.value)}
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={p.descripcion}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'descripcion', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.monto}
                          disabled={!editable}
                          onChange={(e) => fijarProv(i, 'monto', e.target.value)}
                          className={`${celdaCls} text-right font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={p.banco}
                          disabled={!editable}
                          onChange={(e) => fijarProv(i, 'banco', e.target.value)}
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={p.cuentaCci}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'cuentaCci', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="email"
                          value={p.emailProveedor}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'emailProveedor', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          onClick={() => quitar(i)}
                          disabled={!editable || provs.length === 1}
                          title="Quitar fila"
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
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={agregar}
                disabled={!editable}
                className="rounded-lg border border-linea bg-white px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-superficie disabled:opacity-50"
              >
                + Agregar proveedor
              </button>
              <div className="text-[13px]">
                <span className="text-tinta-tenue">Suma de montos: </span>
                <span className="font-mono font-semibold">
                  {formatearMonto(redondear(sumaMontos), datos.moneda)}
                </span>
              </div>
            </div>
          </Tarjeta>

          {editable && (
            <div className="flex justify-end gap-2.5">
              <button
                onClick={guardar}
                disabled={guardando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={marcarLista}
                disabled={guardando}
                className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
              >
                {guardando ? 'Procesando…' : 'Mi parte está lista'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <Tarjeta titulo="Seguimiento de administración">
          <p className="text-[13px] text-tinta-suave">
            El seguimiento (N° de factura, OC, HES, importes por proveedor y el
            cierre de la ficha) se construye en el siguiente bloque.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}

const inputCls =
  'mt-1 w-full rounded-md border border-linea bg-white px-3 py-2 text-[13px] outline-none transition focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';
const celdaCls =
  'w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';

const monedaTexto = (m: Moneda) => (m === 'PEN' ? 'soles' : 'dólares');

function Tab({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition ${
        activa
          ? 'border-petroleo text-petroleo-oscuro'
          : 'border-transparent text-tinta-tenue hover:text-tinta'
      }`}
    >
      {children}
    </button>
  );
}

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
