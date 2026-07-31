'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { crearOrdenProveedor } from '@/actions/ordenes-proveedores';

// Crea la orden en el servidor y lleva directo a su ficha. No abre un
// formulario en blanco antes: el código correlativo se asigna al crear, así que
// la orden tiene que existir en la base para poder mostrar su número — y
// mostrar un número antes de reservarlo permitiría que dos personas vieran el
// mismo.
export function BotonNuevaOda() {
  const router = useRouter();
  const toast = useToast();
  const [creando, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={creando}
      onClick={() =>
        startTransition(async () => {
          const r = await crearOrdenProveedor();
          if ('error' in r) {
            toast({ tipo: 'error', texto: r.error });
            return;
          }
          router.push(`/ordenes/proveedores/${r.id}`);
        })
      }
      className="shrink-0 rounded-lg bg-petroleo px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-petroleo-oscuro disabled:opacity-50"
    >
      {creando ? 'Creando…' : '+ Nueva ODA'}
    </button>
  );
}
