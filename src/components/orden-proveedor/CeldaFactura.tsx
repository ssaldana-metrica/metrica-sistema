'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { guardarFacturaProveedor } from '@/actions/ordenes-proveedores';

// La factura del proveedor, editable desde la propia lista.
//
// Se edita acá y no en el detalle de la orden porque el trabajo es por lotes:
// llegan varias facturas juntas y hay que cargarlas seguidas. Entrar y salir de
// diez órdenes para escribir dos datos en cada una es el tipo de fricción que
// hace que la gente termine llevando la cuenta en un Excel aparte.
//
// La trazabilidad no se pierde por editar en la tabla: el servidor guarda quién
// y cuándo sin importar desde dónde venga el cambio.
//
// Los dos datos van en una sola columna, en dos líneas, en vez de dos columnas
// estrechas. La tabla ya tenía siete columnas; dos más la habrían empujado al
// desplazamiento horizontal, y una columna que hay que arrastrar para ver es
// una columna que nadie mira.
export function CeldaFactura({
  ordenId,
  emitida,
  numeroInicial,
  fechaInicial,
}: {
  ordenId: string;
  /** Solo se carga la factura de una orden emitida: antes no hay qué facturar. */
  emitida: boolean;
  numeroInicial: string;
  fechaInicial: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [guardando, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(numeroInicial);
  const [fecha, setFecha] = useState(fechaInicial ?? '');

  const fechaLegible = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'];
    return `${m[3]}-${meses[Number(m[2]) - 1]}`;
  };

  function guardar() {
    startTransition(async () => {
      const r = await guardarFacturaProveedor(ordenId, numero, fecha || null);
      if ('error' in r) {
        toast({ tipo: 'error', texto: r.error });
        return;
      }
      setEditando(false);
      toast({ texto: 'Factura guardada.' });
      router.refresh();
    });
  }

  // Una orden que no está emitida no puede tener factura todavía; una anulada
  // conserva la que tuviera, pero ya no se edita.
  if (!emitida) {
    return numeroInicial ? (
      <div className="text-[12.5px]">
        <div className="font-mono">{numeroInicial}</div>
        {fechaInicial && (
          <div className="text-[11px] text-tinta-tenue">
            recibida {fechaLegible(fechaInicial)}
          </div>
        )}
      </div>
    ) : (
      <span className="text-[12px] text-tinta-tenue">—</span>
    );
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Registrar la factura del proveedor"
        className="w-full rounded-md px-2 py-1 text-left transition hover:bg-superficie"
      >
        {numeroInicial ? (
          <>
            <div className="font-mono text-[12.5px]">{numeroInicial}</div>
            {fechaInicial && (
              <div className="text-[11px] text-tinta-tenue">
                recibida {fechaLegible(fechaInicial)}
              </div>
            )}
          </>
        ) : (
          <span className="text-[12px] font-semibold text-petroleo-oscuro">
            + Registrar
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <input
        autoFocus
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="F001-00123"
        className="w-full rounded-md border border-linea px-2 py-1 font-mono text-[12px] outline-none focus:border-petroleo"
      />
      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="w-full rounded-md border border-linea px-2 py-1 text-[11.5px] outline-none focus:border-petroleo"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-petroleo px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setNumero(numeroInicial);
            setFecha(fechaInicial ?? '');
            setEditando(false);
          }}
          disabled={guardando}
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-tinta-tenue transition hover:bg-superficie"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
