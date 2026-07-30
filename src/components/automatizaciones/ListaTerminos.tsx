'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { agregarTermino, eliminarTermino } from '@/actions/automatizaciones';

export type TerminoFila = {
  id: string;
  termino: string;
  sinonimos: string[];
};

export type CuentaConTerminos = {
  id: string;
  nombre: string;
  terminos: TerminoFila[];
};

export function ListaTerminos({ cuentas }: { cuentas: CuentaConTerminos[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nuevos, setNuevos] = useState<Record<string, string>>({});

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

  return (
    <section className="rounded-2xl border border-linea bg-white p-6 shadow-tarjeta">
      <h2 className="text-[15px] font-bold tracking-tight">Qué se vigila</h2>
      <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-tinta-suave">
        Una norma se marca cuando alguna de estas palabras aparece en su resumen, en la
        entidad que la publica, en su tipo o en su número. No distingue mayúsculas ni
        tildes. Un mismo término puede estar en varias cuentas: si coincide, la norma se
        etiqueta con todas.
      </p>

      <div className="mt-5 space-y-6">
        {cuentas.map((c) => (
          <div key={c.id}>
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="rounded-md bg-petroleo px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-white">
                {c.nombre}
              </span>
              <span className="text-[11.5px] text-tinta-tenue">
                {c.terminos.length} {c.terminos.length === 1 ? 'término' : 'términos'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {c.terminos.map((t) => (
                <span
                  key={t.id}
                  className="group inline-flex items-center gap-1.5 rounded-lg border border-linea bg-superficie py-1 pl-2.5 pr-1 text-[12px]"
                  // Los sinónimos no se listan para no llenar la pantalla, pero
                  // conviene poder verlos: si alguien se pregunta por qué entró
                  // una norma de "Organismo Supervisor…", la respuesta está acá.
                  title={
                    t.sinonimos.length > 0
                      ? `También detecta: ${t.sinonimos.join(', ')}`
                      : undefined
                  }
                >
                  {t.termino}
                  {t.sinonimos.length > 0 && (
                    <span className="font-mono text-[9px] text-tinta-tenue">
                      +{t.sinonimos.length}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Quitar ${t.termino}`}
                    disabled={ocupado !== null}
                    onClick={() => ejecutar(t.id, () => eliminarTermino(t.id), 'Término quitado.')}
                    className="rounded px-1 text-tinta-tenue transition hover:bg-rojo-fondo hover:text-rojo disabled:opacity-40"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const valor = nuevos[c.id] ?? '';
                ejecutar(`alta-${c.id}`, async () => {
                  const r = await agregarTermino(c.id, valor);
                  if (!('error' in r)) setNuevos((n) => ({ ...n, [c.id]: '' }));
                  return r;
                }, `Término agregado a ${c.nombre}.`);
              }}
              className="mt-2.5 flex gap-2"
            >
              <input
                type="text"
                required
                value={nuevos[c.id] ?? ''}
                onChange={(e) => setNuevos((n) => ({ ...n, [c.id]: e.target.value }))}
                placeholder={`Agregar término a ${c.nombre}…`}
                className="min-w-0 flex-1 rounded-lg border border-linea px-3 py-1.5 text-[12.5px] outline-none focus:border-petroleo"
              />
              <button
                type="submit"
                disabled={ocupado !== null}
                className="shrink-0 rounded-lg border border-linea px-3 py-1.5 text-[12px] font-semibold text-tinta-suave transition hover:bg-superficie disabled:opacity-40"
              >
                {ocupado === `alta-${c.id}` ? 'Agregando…' : 'Agregar'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
