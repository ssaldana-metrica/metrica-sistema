'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarActivo, cambiarRol } from '@/actions/usuarios';
import { ROLES, type Rol } from '@/lib/roles';
import { useToast } from '@/components/ui/Toast';

export type UsuarioFila = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
};

const ETIQUETA_ROL: Record<Rol, string> = {
  ejecutivo: 'Ejecutivo',
  admin: 'Administración',
  gerencia: 'Gerencia',
};

export function TablaUsuarios({
  usuarios,
  yoId,
}: {
  usuarios: UsuarioFila[];
  yoId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [guardando, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);

  function fijarRol(u: UsuarioFila, rol: Rol) {
    if (rol === u.rol) return;
    setOcupado(u.id);
    startTransition(async () => {
      const r = await cambiarRol(u.id, rol);
      setOcupado(null);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        toast({ texto: `${u.nombre} ahora es ${ETIQUETA_ROL[rol]}.` });
        router.refresh();
      }
    });
  }

  function alternarActivo(u: UsuarioFila) {
    setOcupado(u.id);
    startTransition(async () => {
      const r = await cambiarActivo(u.id, !u.activo);
      setOcupado(null);
      if ('error' in r) toast({ tipo: 'error', texto: r.error });
      else {
        toast({
          tipo: u.activo ? 'info' : 'exito',
          texto: `${u.nombre} ${u.activo ? 'dado de baja' : 'reactivado'}.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-linea bg-white shadow-tarjeta">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-superficie text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="px-5 py-3 font-semibold">Nombre</th>
              <th className="px-5 py-3 font-semibold">Correo</th>
              <th className="px-5 py-3 font-semibold">Rol</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const soyYo = u.id === yoId;
              const fila = ocupado === u.id && guardando;
              return (
                <tr
                  key={u.id}
                  className={`border-t border-linea-suave text-[13px] ${
                    u.activo ? '' : 'bg-superficie/40 text-tinta-tenue'
                  }`}
                >
                  <td className="px-5 py-3 font-medium">
                    {u.nombre}
                    {soyYo && (
                      <span className="ml-2 rounded bg-superficie px-1.5 py-0.5 text-[10px] font-semibold text-tinta-tenue">
                        tú
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] text-tinta-suave">
                    {u.correo}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.rol}
                      disabled={soyYo || fila}
                      onChange={(e) => fijarRol(u, e.target.value as Rol)}
                      className="rounded-md border border-linea bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-petroleo disabled:bg-superficie disabled:text-tinta-tenue"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ETIQUETA_ROL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${
                        u.activo
                          ? 'bg-verde-fondo text-verde'
                          : 'bg-pizarra-fondo text-pizarra'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {u.activo ? 'Activo' : 'De baja'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!soyYo && (
                      <button
                        onClick={() => alternarActivo(u)}
                        disabled={fila}
                        className={`rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-50 ${
                          u.activo
                            ? 'border-rojo/40 text-rojo hover:bg-rojo-fondo'
                            : 'border-verde/40 text-verde hover:bg-verde-fondo'
                        }`}
                      >
                        {u.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
