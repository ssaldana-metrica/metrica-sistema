'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import {
  agregarDestinatario,
  alternarDestinatario,
  eliminarDestinatario,
} from '@/actions/automatizaciones';

export type DestinatarioFila = {
  id: string;
  correo: string;
  nombre: string | null;
  activo: boolean;
  cuenta: string | null; // null = recibe todo
};

export type CuentaOpcion = { id: string; nombre: string };

export function ListaDestinatarios({
  destinatarios,
  cuentas,
}: {
  destinatarios: DestinatarioFila[];
  cuentas: CuentaOpcion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [cuentaId, setCuentaId] = useState('');

  function ejecutar(clave: string, fn: () => Promise<{ ok: true } | { error: string }>, exito: string) {
    setOcupado(clave);
    startTransition(async () => {
      const r = await fn();
      setOcupado(null);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        toast({ texto: exito });
        router.refresh();
      }
    });
  }

  function alta(e: React.FormEvent) {
    e.preventDefault();
    const destino = cuentaId || null;
    ejecutar('alta', async () => {
      const r = await agregarDestinatario(correo, nombre, destino);
      if (!('error' in r)) {
        setCorreo('');
        setNombre('');
        setCuentaId('');
      }
      return r;
    }, 'Destinatario agregado.');
  }

  const activos = destinatarios.filter((d) => d.activo).length;

  return (
    <section className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
      <h2 className="text-[15px] font-bold tracking-tight">Quién recibe los avisos</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-tinta-suave">
        {activos} {activos === 1 ? 'persona activa' : 'personas activas'} de {destinatarios.length}.
        No hace falta que tengan cuenta en el sistema: basta su correo.
      </p>

      <ul className="mt-4 divide-y divide-linea border-y border-linea">
        {destinatarios.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-semibold ${d.activo ? '' : 'text-tinta-tenue line-through'}`}>
                {d.nombre || d.correo}
              </div>
              {d.nombre && (
                <div className="text-[12px] text-tinta-suave">{d.correo}</div>
              )}
            </div>

            <span className="shrink-0 rounded-md bg-superficie px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-tinta-suave">
              {d.cuenta ?? 'todo'}
            </span>

            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() =>
                ejecutar(
                  d.id,
                  () => alternarDestinatario(d.id, !d.activo),
                  d.activo ? 'Ya no recibirá avisos.' : 'Volverá a recibir avisos.',
                )
              }
              className="shrink-0 rounded-lg border border-linea px-2.5 py-1.5 text-[11.5px] font-semibold text-tinta-suave transition hover:bg-superficie disabled:opacity-40"
            >
              {d.activo ? 'Pausar' : 'Reanudar'}
            </button>

            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => {
                // Confirmación porque borrar es definitivo. Para quitar a
                // alguien temporalmente está "Pausar", que es reversible.
                if (!confirm(`¿Eliminar a ${d.correo} de la lista?\n\nSi solo quieres que deje de recibir avisos por un tiempo, usa Pausar.`)) return;
                ejecutar(d.id, () => eliminarDestinatario(d.id), 'Destinatario eliminado.');
              }}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-rojo transition hover:bg-rojo-fondo disabled:opacity-40"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={alta} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-tinta-suave">Correo</span>
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre@metrica.pe"
            className="w-full rounded-lg border border-linea px-3 py-2 text-[13px] outline-none focus:border-petroleo"
          />
        </label>
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-tinta-suave">Nombre (opcional)</span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-lg border border-linea px-3 py-2 text-[13px] outline-none focus:border-petroleo"
          />
        </label>
        <label>
          <span className="mb-1 block text-[11.5px] font-semibold text-tinta-suave">Recibe</span>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="rounded-lg border border-linea px-3 py-2 text-[13px] outline-none focus:border-petroleo"
          >
            <option value="">Todo</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                Solo {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={ocupado !== null}
          className="rounded-lg bg-petroleo px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
        >
          {ocupado === 'alta' ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
    </section>
  );
}
