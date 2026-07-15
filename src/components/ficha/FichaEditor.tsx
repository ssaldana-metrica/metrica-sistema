'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  cerrarFicha,
  guardarFichaEjecutivo,
  guardarSeguimientoAdmin,
  marcarListaEjecutivo,
  reabrirFicha,
  type DatosEjecutivo,
  type FichaProveedorEntrada,
} from '@/actions/fichas';
import { generarOda } from '@/actions/ordenes';
import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { CCI_LARGO, soloDigitos } from '@/lib/cci';
import { formatearMonto, redondear, type Moneda } from '@/lib/calculos';

const numOnull = (v: string) => (v.trim() ? parseFloat(v) || 0 : null);

// ── Proveedores (parte del ejecutivo) ───────────────────────────────────────
type ProveedorFila = {
  agencia: string;
  influencerProveedor: string;
  ruc: string;
  descripcion: string;
  monto: string;
  banco: string;
  cuenta: string;
  cci: string;
  emailProveedor: string;
};
const filaVacia = (): ProveedorFila => ({
  agencia: '',
  influencerProveedor: '',
  ruc: '',
  descripcion: '',
  monto: '',
  banco: '',
  cuenta: '',
  cci: '',
  emailProveedor: '',
});

// ── Seguimiento (parte del admin): facturas repetibles ──────────────────────
type FacturaClienteFila = {
  numFactura: string;
  oc: string;
  hes: string;
  fechaEmision: string | null;
  total: string;
  fee: string;
};
const facturaClienteVacia = (): FacturaClienteFila => ({
  numFactura: '',
  oc: '',
  hes: '',
  fechaEmision: null,
  total: '',
  fee: '',
});

type FacturaProvFila = {
  numOc: string;
  numFactura: string;
  fechaEmision: string | null;
  total: string;
  monedaTotal: Moneda;
};
const facturaProvVacia = (m: Moneda): FacturaProvFila => ({
  numOc: '',
  numFactura: '',
  fechaEmision: null,
  total: '',
  monedaTotal: m,
});

type SeguimientoProvGrupo = {
  id: string;
  orden: number;
  etiqueta: string;
  facturas: FacturaProvFila[];
};

// Suma de totales por moneda, para mostrar el total de un proveedor.
function totalesPorMoneda(facturas: { total: string; monedaTotal: Moneda }[]) {
  const acc: Record<Moneda, number> = { PEN: 0, USD: 0 };
  for (const f of facturas) acc[f.monedaTotal] += parseFloat(f.total) || 0;
  return (['PEN', 'USD'] as Moneda[])
    .filter((m) => acc[m] > 0)
    .map((m) => formatearMonto(acc[m], m));
}

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
  puedeGenerarOda: boolean;
  odasPorProveedor: Record<string, { id: string; codigo: string; estado: string }>;
  pdfHref: string | null;
  inicial: DatosEjecutivo;
  proveedoresIniciales: ProveedorFila[];
  facturasClienteIniciales: FacturaClienteFila[];
  seguimientoProveedores: SeguimientoProvGrupo[];
};

export function FichaEditor(props: FichaEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [pestana, setPestana] = useState<'ejecutivo' | 'admin'>('ejecutivo');
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalReabrir, setModalReabrir] = useState(false);
  const [notaReapertura, setNotaReapertura] = useState('');

  const [datos, setDatos] = useState<DatosEjecutivo>(props.inicial);
  const [provs, setProvs] = useState<ProveedorFila[]>(
    props.proveedoresIniciales.length
      ? props.proveedoresIniciales
      : [filaVacia()],
  );
  const [facCliente, setFacCliente] = useState<FacturaClienteFila[]>(
    props.facturasClienteIniciales.length
      ? props.facturasClienteIniciales
      : [facturaClienteVacia()],
  );
  // Cada proveedor arranca con al menos una fila de factura visible.
  const [segProvs, setSegProvs] = useState<SeguimientoProvGrupo[]>(
    props.seguimientoProveedores.map((g) => ({
      ...g,
      facturas: g.facturas.length
        ? g.facturas
        : [facturaProvVacia(props.inicial.moneda)],
    })),
  );

  const editable = props.puedeEditar;
  const adminEditable = props.esAdmin && props.estado === 'lista_ejecutivo';

  // ── Parte del ejecutivo ──
  const fijar = <K extends keyof DatosEjecutivo>(k: K, v: DatosEjecutivo[K]) =>
    setDatos((d) => ({ ...d, [k]: v }));
  const fijarProv = (i: number, k: keyof ProveedorFila, v: string) =>
    setProvs((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const agregarProv = () => setProvs((ps) => [...ps, filaVacia()]);
  const quitarProv = (i: number) =>
    setProvs((ps) => (ps.length === 1 ? ps : ps.filter((_, j) => j !== i)));

  const sumaMontos = provs.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

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
          p.cuenta,
          p.cci,
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
        cuenta: p.cuenta,
        cci: p.cci,
        emailProveedor: p.emailProveedor,
      }));

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await guardarFichaEjecutivo(props.fichaId, datos, aEntrada());
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Avance guardado.' });
        router.refresh();
      }
    });
  }

  function marcarLista() {
    setError(null);
    // Aviso inmediato: cuenta y CCI obligatorios y CCI de 20 dígitos en cada
    // proveedor con nombre y monto. (El servidor lo revalida igual.)
    const provValidos = provs.filter(
      (p) =>
        (p.agencia.trim() || p.influencerProveedor.trim()) &&
        (parseFloat(p.monto) || 0) > 0,
    );
    for (const p of provValidos) {
      const quien = p.agencia.trim() || p.influencerProveedor.trim();
      if (!p.cuenta.trim()) {
        setError(`Falta el número de cuenta de ${quien}.`);
        return;
      }
      const cci = soloDigitos(p.cci);
      if (cci.length !== CCI_LARGO) {
        setError(
          `El CCI de ${quien} debe tener ${CCI_LARGO} dígitos (tiene ${cci.length}).`,
        );
        return;
      }
    }
    startTransition(async () => {
      const r = await marcarListaEjecutivo(props.fichaId, datos, aEntrada());
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Tu parte quedó lista. Administración hará el seguimiento.' });
        router.refresh();
      }
    });
  }

  // ── Parte del admin: facturas del cliente ──
  const fijarFacCliente = (i: number, k: keyof FacturaClienteFila, v: string) =>
    setFacCliente((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const agregarFacCliente = () =>
    setFacCliente((fs) => [...fs, facturaClienteVacia()]);
  const quitarFacCliente = (i: number) =>
    setFacCliente((fs) => fs.filter((_, j) => j !== i));

  // ── Parte del admin: facturas por proveedor ──
  const fijarFacProv = (
    gi: number,
    fi: number,
    k: keyof FacturaProvFila,
    v: string,
  ) =>
    setSegProvs((gs) =>
      gs.map((g, j) =>
        j === gi
          ? {
              ...g,
              facturas: g.facturas.map((f, m) =>
                m === fi ? { ...f, [k]: v } : f,
              ),
            }
          : g,
      ),
    );
  const agregarFacProv = (gi: number) =>
    setSegProvs((gs) =>
      gs.map((g, j) =>
        j === gi
          ? { ...g, facturas: [...g.facturas, facturaProvVacia(datos.moneda)] }
          : g,
      ),
    );
  const quitarFacProv = (gi: number, fi: number) =>
    setSegProvs((gs) =>
      gs.map((g, j) =>
        j === gi
          ? { ...g, facturas: g.facturas.filter((_, m) => m !== fi) }
          : g,
      ),
    );

  const facturasClientePayload = () =>
    facCliente.map((f) => ({
      numFactura: f.numFactura,
      oc: f.oc,
      hes: f.hes,
      fechaEmision: f.fechaEmision,
      total: numOnull(f.total),
      fee: numOnull(f.fee),
    }));
  const segProvsPayload = () =>
    segProvs.map((g) => ({
      orden: g.orden,
      facturas: g.facturas.map((f) => ({
        numOc: f.numOc,
        numFactura: f.numFactura,
        fechaEmision: f.fechaEmision,
        total: numOnull(f.total),
        monedaTotal: f.monedaTotal,
      })),
    }));

  const totalCliente = facCliente.reduce(
    (a, f) => a + (parseFloat(f.total) || 0),
    0,
  );

  function guardarSeguimiento() {
    setError(null);
    startTransition(async () => {
      const r = await guardarSeguimientoAdmin(
        props.fichaId,
        facturasClientePayload(),
        segProvsPayload(),
      );
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Seguimiento guardado.' });
        router.refresh();
      }
    });
  }

  function cerrar() {
    setError(null);
    startTransition(async () => {
      const r = await cerrarFicha(
        props.fichaId,
        facturasClientePayload(),
        segProvsPayload(),
      );
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Ficha cerrada · PDF generado. Ya puedes descargarlo.' });
        router.refresh();
      }
    });
  }

  function generarOrden(provId: string) {
    setError(null);
    startTransition(async () => {
      const r = await generarOda(provId);
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Orden de adquisición generada.' });
        router.push(`/ordenes/${r.id}`);
      }
    });
  }

  // Reapertura para administración: sin correo ni aviso al ejecutivo.
  function reabrirAdmin() {
    setError(null);
    startTransition(async () => {
      const r = await reabrirFicha(props.fichaId, 'administracion');
      if ('error' in r) setError(r.error);
      else {
        toast({ texto: 'Ficha reabierta para corregir el seguimiento.' });
        router.refresh();
      }
    });
  }

  // Reapertura para el ejecutivo: con nota opcional, se le avisa por correo.
  function reabrirEjecutivo() {
    setError(null);
    startTransition(async () => {
      const r = await reabrirFicha(props.fichaId, 'ejecutivo', notaReapertura);
      if ('error' in r) setError(r.error);
      else {
        setModalReabrir(false);
        setNotaReapertura('');
        toast({ texto: 'Ficha reabierta · se avisó al ejecutivo por correo.' });
        router.refresh();
      }
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
          {props.pdfHref && (
            <a
              href={props.pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-linea bg-white px-3.5 py-2 text-[12.5px] font-semibold transition hover:bg-superficie"
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

      {pestana === 'ejecutivo' ? (
        <div className="space-y-5">
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
              <Campo label="Razón social">
                <input
                  type="text"
                  value={datos.clienteRazonSocial}
                  disabled={!editable}
                  placeholder="Nombre legal del cliente"
                  onChange={(e) => fijar('clienteRazonSocial', e.target.value)}
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
                onChange={(e) => fijar('observacionesEjecutivo', e.target.value)}
                className={inputCls}
              />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Proveedores que cobran">
            <p className="-mt-1 mb-3 text-[12px] text-tinta-tenue">
              Quien factura no siempre es quien se cotizó. Llena aquí a quienes
              realmente van a cobrar. Montos en {monedaTexto(datos.moneda)}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse">
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
                    <th className="px-2 py-2 font-semibold">Cuenta</th>
                    <th className="px-2 py-2 font-semibold">CCI (20 díg.)</th>
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
                          inputMode="numeric"
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(
                              i,
                              'ruc',
                              soloDigitos(e.target.value).slice(0, 11),
                            )
                          }
                          className={`${celdaCls} font-mono`}
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
                          value={p.cuenta}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'cuenta', e.target.value)
                          }
                          className={celdaCls}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          inputMode="numeric"
                          value={p.cci}
                          disabled={!editable}
                          onChange={(e) =>
                            fijarProv(i, 'cci', soloDigitos(e.target.value).slice(0, CCI_LARGO))
                          }
                          className={`${celdaCls} font-mono ${
                            p.cci && soloDigitos(p.cci).length !== CCI_LARGO
                              ? 'border-ambar'
                              : ''
                          }`}
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
                          onClick={() => quitarProv(i)}
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
                onClick={agregarProv}
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
                {guardando && <Spinner />}
                {guardando ? 'Procesando…' : 'Mi parte está lista'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {props.estado === 'en_proceso' && (
            <div className="rounded-[10px] border border-ambar/30 bg-ambar-fondo px-4 py-3 text-[12.5px] text-ambar">
              El seguimiento se habilita cuando el ejecutivo marque su parte
              como lista.
            </div>
          )}
          {props.estado === 'completa' && (
            <div className="rounded-[10px] border border-verde/30 bg-verde-fondo px-4 py-3 text-[12.5px] text-verde">
              Ficha completa. El seguimiento es solo lectura; para cambiarlo,
              reabre la ficha.
            </div>
          )}

          {/* Facturas del cliente (repetibles) */}
          <Tarjeta titulo="Seguimiento del cliente">
            <p className="-mt-1 mb-3 text-[12px] text-tinta-tenue">
              Agrega una entrada por cada factura emitida al cliente. Totales en{' '}
              {monedaTexto(datos.moneda)}.
            </p>
            <div className="space-y-3">
              {facCliente.map((f, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-linea-suave p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-tinta-tenue">
                      Factura {i + 1}
                    </span>
                    {adminEditable && facCliente.length > 1 && (
                      <button
                        onClick={() => quitarFacCliente(i)}
                        title="Quitar factura"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-rojo transition hover:bg-rojo-fondo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Campo label="N° factura al cliente">
                      <input
                        value={f.numFactura}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'numFactura', e.target.value)
                        }
                        className={inputCls}
                      />
                    </Campo>
                    <Campo label="OC del cliente">
                      <input
                        value={f.oc}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'oc', e.target.value)
                        }
                        className={inputCls}
                      />
                    </Campo>
                    <Campo label="HES">
                      <input
                        value={f.hes}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'hes', e.target.value)
                        }
                        className={inputCls}
                      />
                    </Campo>
                    <Campo label="Fecha de emisión">
                      <input
                        type="date"
                        value={f.fechaEmision ?? ''}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'fechaEmision', e.target.value)
                        }
                        className={inputCls}
                      />
                    </Campo>
                    <Campo label={`Total (${monedaTexto(datos.moneda)})`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={f.total}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'total', e.target.value)
                        }
                        className={`${inputCls} text-right font-mono`}
                      />
                    </Campo>
                    <Campo label={`Fee (${monedaTexto(datos.moneda)})`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={f.fee}
                        disabled={!adminEditable}
                        onChange={(e) =>
                          fijarFacCliente(i, 'fee', e.target.value)
                        }
                        className={`${inputCls} text-right font-mono`}
                      />
                    </Campo>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              {adminEditable ? (
                <button
                  onClick={agregarFacCliente}
                  className="rounded-lg border border-linea bg-white px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-superficie"
                >
                  + Agregar factura del cliente
                </button>
              ) : (
                <span />
              )}
              <div className="text-[13px]">
                <span className="text-tinta-tenue">Total facturado: </span>
                <span className="font-mono font-semibold">
                  {formatearMonto(redondear(totalCliente), datos.moneda)}
                </span>
              </div>
            </div>
          </Tarjeta>

          {/* Facturas por proveedor (repetibles, moneda por línea) */}
          <Tarjeta titulo="Seguimiento por proveedor">
            {segProvs.length === 0 ? (
              <p className="text-[13px] text-tinta-suave">
                Esta ficha aún no tiene proveedores cargados por el ejecutivo.
              </p>
            ) : (
              <div className="space-y-4">
                {segProvs.map((g, gi) => (
                  <div
                    key={g.id}
                    className="rounded-lg border border-linea-suave p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">
                        {g.etiqueta}
                      </span>
                      {props.odasPorProveedor[g.id] ? (
                        <Link
                          href={`/ordenes/${props.odasPorProveedor[g.id].id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-petroleo/30 bg-verde-fondo px-2.5 py-1 text-[11.5px] font-semibold text-petroleo-oscuro transition hover:bg-verde-fondo/70"
                        >
                          {props.odasPorProveedor[g.id].codigo} · Ver orden →
                        </Link>
                      ) : props.puedeGenerarOda ? (
                        <button
                          onClick={() => generarOrden(g.id)}
                          disabled={guardando}
                          className="inline-flex items-center gap-1.5 rounded-md bg-petroleo px-2.5 py-1 text-[11.5px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
                        >
                          {guardando ? 'Generando…' : '+ Generar ODA'}
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {g.facturas.map((f, fi) => (
                        <div
                          key={fi}
                          className="rounded-md border border-linea-suave bg-superficie/40 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11.5px] font-semibold text-tinta-tenue">
                              Factura {fi + 1}
                            </span>
                            {adminEditable && g.facturas.length > 1 && (
                              <button
                                onClick={() => quitarFacProv(gi, fi)}
                                title="Quitar factura"
                                className="flex h-6 w-6 items-center justify-center rounded-md text-rojo transition hover:bg-rojo-fondo"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Campo label="N° ODA">
                              <input
                                value={f.numOc}
                                disabled={!adminEditable}
                                onChange={(e) =>
                                  fijarFacProv(gi, fi, 'numOc', e.target.value)
                                }
                                className={inputCls}
                              />
                            </Campo>
                            <Campo label="N° factura">
                              <input
                                value={f.numFactura}
                                disabled={!adminEditable}
                                onChange={(e) =>
                                  fijarFacProv(
                                    gi,
                                    fi,
                                    'numFactura',
                                    e.target.value,
                                  )
                                }
                                className={inputCls}
                              />
                            </Campo>
                            <Campo label="Fecha de emisión">
                              <input
                                type="date"
                                value={f.fechaEmision ?? ''}
                                disabled={!adminEditable}
                                onChange={(e) =>
                                  fijarFacProv(
                                    gi,
                                    fi,
                                    'fechaEmision',
                                    e.target.value,
                                  )
                                }
                                className={inputCls}
                              />
                            </Campo>
                            <Campo label="Total">
                              <MontoMoneda
                                valor={f.total}
                                moneda={f.monedaTotal}
                                disabled={!adminEditable}
                                onValor={(v) =>
                                  fijarFacProv(gi, fi, 'total', v)
                                }
                                onMoneda={(m) =>
                                  fijarFacProv(gi, fi, 'monedaTotal', m)
                                }
                              />
                            </Campo>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {adminEditable ? (
                        <button
                          onClick={() => agregarFacProv(gi)}
                          className="rounded-lg border border-linea bg-white px-3 py-1.5 text-[12px] font-semibold transition hover:bg-superficie"
                        >
                          + Agregar factura
                        </button>
                      ) : (
                        <span />
                      )}
                      <div className="text-[13px]">
                        <span className="text-tinta-tenue">Total: </span>
                        <span className="font-mono font-semibold">
                          {totalesPorMoneda(g.facturas).join('  +  ') || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>

          {props.esAdmin &&
            ['lista_ejecutivo', 'completa'].includes(props.estado) && (
              <div className="flex flex-wrap justify-end gap-2.5">
                <div className="mr-auto flex flex-wrap gap-2.5">
                  {props.estado === 'completa' && (
                    <button
                      onClick={reabrirAdmin}
                      disabled={guardando}
                      title="Reabre la ficha para corregir el seguimiento, sin avisar al ejecutivo"
                      className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
                    >
                      Reabrir para administración
                    </button>
                  )}
                  <button
                    onClick={() => setModalReabrir(true)}
                    disabled={guardando}
                    className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
                  >
                    Reabrir para el ejecutivo
                  </button>
                </div>
                {adminEditable && (
                  <>
                    <button
                      onClick={guardarSeguimiento}
                      disabled={guardando}
                      className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie disabled:opacity-60"
                    >
                      {guardando ? 'Guardando…' : 'Guardar seguimiento'}
                    </button>
                    <button
                      onClick={cerrar}
                      disabled={guardando}
                      className="flex items-center gap-2 rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
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
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      {guardando ? 'Procesando…' : 'Cerrar ficha y generar PDF'}
                    </button>
                  </>
                )}
              </div>
            )}
        </div>
      )}

      {/* Modal: reabrir para el ejecutivo con mensaje opcional */}
      {modalReabrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">
              Reabrir para el ejecutivo
            </h3>
            <p className="mt-1 text-[12.5px] text-tinta-suave">
              La ficha volverá a {props.ejecutivo} (estado en proceso) y le
              llegará un correo. Puedes escribirle un mensaje (opcional).
            </p>
            <textarea
              value={notaReapertura}
              onChange={(e) => setNotaReapertura(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Ej. Corrige el RUC del proveedor 2 y vuelve a marcar tu parte como lista."
              className="mt-4 w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-petroleo"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => setModalReabrir(false)}
                disabled={guardando}
                className="rounded-lg border border-linea bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-superficie"
              >
                Cancelar
              </button>
              <button
                onClick={reabrirEjecutivo}
                disabled={guardando}
                className="rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
              >
                {guardando ? 'Enviando…' : 'Reabrir y avisar'}
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
const celdaCls =
  'w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave';

const monedaTexto = (m: Moneda) => (m === 'PEN' ? 'soles' : 'dólares');

// Monto con su propio selector de moneda (para el seguimiento del admin,
// donde el monto real puede ser PEN o USD distinto a la moneda general).
function MontoMoneda({
  valor,
  moneda,
  disabled,
  onValor,
  onMoneda,
}: {
  valor: string;
  moneda: Moneda;
  disabled: boolean;
  onValor: (v: string) => void;
  onMoneda: (m: Moneda) => void;
}) {
  return (
    <div className="mt-1 flex gap-2">
      <select
        value={moneda}
        disabled={disabled}
        onChange={(e) => onMoneda(e.target.value as Moneda)}
        className="rounded-md border border-linea bg-white px-2 py-2 text-[12.5px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave"
      >
        <option value="PEN">S/</option>
        <option value="USD">$</option>
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        value={valor}
        disabled={disabled}
        onChange={(e) => onValor(e.target.value)}
        className="w-full rounded-md border border-linea bg-white px-3 py-2 text-right font-mono text-[13px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-suave"
      />
    </div>
  );
}

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
