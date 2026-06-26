'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { anularProceso, guardarControlLote } from '@/actions/control';
import {
  ESTILO_PROC,
  fechaCorta,
  type ControlFila,
  type EstadoProc,
} from '@/lib/control';

export type FilaVista = {
  provId: string;
  fichaId: string;
  agencia: string;
  influencer: string;
  nOda: string;
  control: ControlFila;
};

export type ProcesoVista = {
  fichaId: string;
  estado: EstadoProc;
  codigoFA: string;
  codigoCOT: string;
  cliente: string;
  politica: string;
  proyecto: string;
  inicio: string | null;
  fin: string | null;
  filas: FilaVista[];
};

const celda = 'px-3 py-2 align-top';
const inp =
  'w-full rounded-md border border-linea bg-white px-2 py-1.5 text-[12px] outline-none focus:border-petroleo';

export function TablaControl({ procesos }: { procesos: ProcesoVista[] }) {
  const router = useRouter();
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const fichaDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of procesos)
      for (const f of p.filas) m.set(f.provId, f.fichaId);
    return m;
  }, [procesos]);

  const [valores, setValores] = useState<Record<string, ControlFila>>(() => {
    const m: Record<string, ControlFila> = {};
    for (const p of procesos) for (const f of p.filas) m[f.provId] = { ...f.control };
    return m;
  });
  const [sucios, setSucios] = useState<Set<string>>(new Set());
  const [anularDe, setAnularDe] = useState<{
    fichaId: string;
    codigo: string;
  } | null>(null);
  const [motivo, setMotivo] = useState('');

  const fijar = (provId: string, k: keyof ControlFila, v: string) => {
    setValores((vs) => ({
      ...vs,
      [provId]: { ...vs[provId], [k]: v || (k.startsWith('fecha') ? null : '') },
    }));
    setSucios((s) => new Set(s).add(provId));
  };

  function guardar() {
    setError(null);
    setAviso(null);
    const cambios = [...sucios]
      .filter((id) => valores[id] && fichaDe.has(id))
      .map((id) => ({
        fichaId: fichaDe.get(id)!,
        fichaProveedorId: id,
        datos: valores[id],
      }));
    startTransition(async () => {
      const r = await guardarControlLote(cambios);
      if ('error' in r) setError(r.error);
      else {
        setSucios(new Set());
        setAviso('Cambios guardados.');
        router.refresh();
      }
    });
  }

  function anular() {
    if (!anularDe) return;
    setError(null);
    startTransition(async () => {
      const r = await anularProceso(anularDe.fichaId, motivo);
      if ('error' in r) setError(r.error);
      else {
        setAnularDe(null);
        setMotivo('');
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex h-9 items-center justify-end gap-3">
        {error && (
          <span className="rounded-md border border-rojo/30 bg-rojo-fondo px-3 py-1.5 text-[12.5px] text-rojo">
            {error}
          </span>
        )}
        {aviso && sucios.size === 0 && (
          <span className="text-[12.5px] text-verde">{aviso}</span>
        )}
        {sucios.size > 0 && (
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-petroleo px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-60"
          >
            {guardando
              ? 'Guardando…'
              : `Guardar cambios (${sucios.size})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-linea bg-white shadow-tarjeta">
        <table className="w-full min-w-[1400px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-superficie text-left text-[10.5px] uppercase tracking-wide text-tinta-tenue">
              <th className="px-3 py-2.5 font-semibold">Estado</th>
              <th className="px-3 py-2.5 font-semibold">N° Ficha</th>
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 font-semibold">Política de pago</th>
              <th className="px-3 py-2.5 font-semibold">Proyecto</th>
              <th className="px-3 py-2.5 font-semibold">Agencia</th>
              <th className="px-3 py-2.5 font-semibold">Influencer</th>
              <th className="px-3 py-2.5 font-semibold">Inicio</th>
              <th className="px-3 py-2.5 font-semibold">Término</th>
              <th className="border-l-2 border-linea px-3 py-2.5 font-semibold">
                N° Contrato
              </th>
              <th className="px-3 py-2.5 font-semibold">N° ODA</th>
              <th className="px-3 py-2.5 font-semibold">Factura prov.</th>
              <th className="px-3 py-2.5 font-semibold">OC/OS cliente</th>
              <th className="px-3 py-2.5 font-semibold">Factura cliente</th>
              <th className="px-3 py-2.5 font-semibold">F. facturación</th>
              <th className="px-3 py-2.5 font-semibold">F. cobro</th>
              <th className="border-l-2 border-linea px-3 py-2.5 font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {procesos.map((p) => {
              const e = ESTILO_PROC[p.estado];
              if (p.filas.length === 0) {
                return (
                  <tr
                    key={p.fichaId}
                    className="border-t-2 border-linea text-tinta-suave"
                  >
                    <ProcesoCeldas p={p} estilo={e} />
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className={celda} />
                    <td className={celda} />
                    <td className="border-l-2 border-linea px-3 py-2 text-tinta-tenue">
                      —
                    </td>
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className={celda}>—</td>
                    <td className="border-l-2 border-linea px-3 py-2">
                      {p.estado !== 'anulado' && (
                        <BotonAnular
                          onClick={() =>
                            setAnularDe({ fichaId: p.fichaId, codigo: p.codigoFA })
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              }
              return p.filas.map((fila, i) => {
                const v = valores[fila.provId];
                return (
                  <tr
                    key={fila.provId}
                    className={`text-tinta-suave ${i === 0 ? 'border-t-2 border-linea' : 'border-t border-linea-suave'}`}
                  >
                    {i === 0 ? (
                      <ProcesoCeldas p={p} estilo={e} />
                    ) : (
                      <>
                        <td className={celda} />
                        <td className={celda} />
                        <td className={celda} />
                        <td className={celda} />
                        <td className={celda} />
                      </>
                    )}
                    <td className={celda}>{fila.agencia || '—'}</td>
                    <td className={celda}>{fila.influencer || '—'}</td>
                    <td className={celda}>{i === 0 ? fechaCorta(p.inicio) : ''}</td>
                    <td className={celda}>{i === 0 ? fechaCorta(p.fin) : ''}</td>
                    {/* Zona derecha editable */}
                    <td className="border-l-2 border-linea px-2 py-1.5">
                      <input
                        value={v.nContrato}
                        onChange={(ev) =>
                          fijar(fila.provId, 'nContrato', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className={`${celda} font-mono text-[11.5px]`}>
                      {fila.nOda}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={v.facturaProveedor}
                        onChange={(ev) =>
                          fijar(fila.provId, 'facturaProveedor', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={v.ocOsCliente}
                        onChange={(ev) =>
                          fijar(fila.provId, 'ocOsCliente', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={v.facturaCliente}
                        onChange={(ev) =>
                          fijar(fila.provId, 'facturaCliente', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={v.fechaFacturacion ?? ''}
                        onChange={(ev) =>
                          fijar(fila.provId, 'fechaFacturacion', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={v.fechaCobro ?? ''}
                        onChange={(ev) =>
                          fijar(fila.provId, 'fechaCobro', ev.target.value)
                        }
                        className={inp}
                      />
                    </td>
                    <td className="border-l-2 border-linea px-3 py-2">
                      {i === 0 && p.estado !== 'anulado' && (
                        <BotonAnular
                          onClick={() =>
                            setAnularDe({ fichaId: p.fichaId, codigo: p.codigoFA })
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              });
            })}
            {procesos.length === 0 && (
              <tr>
                <td
                  colSpan={17}
                  className="px-5 py-10 text-center text-[13px] text-tinta-tenue"
                >
                  Ningún proceso coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: anular proceso (cascada) con motivo obligatorio */}
      {anularDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lateral/45 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-flotante">
            <h3 className="text-[15px] font-bold">
              Anular el proceso{' '}
              <span className="font-mono">{anularDe.codigo}</span>
            </h3>
            <p className="mt-2 rounded-[10px] border border-rojo/30 bg-rojo-fondo px-3.5 py-3 text-[12.5px] text-rojo">
              Esto anulará <b>a la vez</b> la cotización, la ficha de apertura y
              <b> todas las ODA</b> de este proceso. No se borra nada, pero los
              códigos quedan anulados y no se reutilizan. No se puede deshacer.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Motivo de la anulación (obligatorio)."
              className="mt-4 w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-petroleo"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setAnularDe(null);
                  setMotivo('');
                }}
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
                {guardando ? 'Anulando…' : 'Anular proceso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonAnular({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-rojo/40 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-rojo transition hover:bg-rojo-fondo"
    >
      Anular
    </button>
  );
}

function ProcesoCeldas({
  p,
  estilo,
}: {
  p: ProcesoVista;
  estilo: { clase: string; etiqueta: string };
}) {
  return (
    <>
      <td className={celda}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${estilo.clase}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {estilo.etiqueta}
        </span>
      </td>
      <td className={`${celda} font-mono text-[11.5px] font-semibold text-tinta`}>
        {p.codigoFA}
      </td>
      <td className={`${celda} text-tinta`}>{p.cliente}</td>
      <td className={celda}>{p.politica}</td>
      <td className={celda}>{p.proyecto}</td>
    </>
  );
}
