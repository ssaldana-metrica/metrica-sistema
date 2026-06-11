import { BadgeEstado } from '@/components/ui/BadgeEstado';
import { calcularTotales, formatearMonto, type Moneda } from '@/lib/calculos';

export type CotizacionDetalle = {
  codigo: string;
  estado: string;
  proyecto: string;
  moneda: Moneda;
  feePorcentaje: number;
  fechaEnvioCliente: string | null;
  cliente: string;
  ejecutivo: string;
  observacionAdmin: string | null;
  aprobadaPor: string | null;
  fechaAprobacion: string | null;
  anuladaPor: string | null;
  motivoAnulacion: string | null;
  lineas: {
    orden: number;
    proveedor: string;
    descripcion: string;
    cantidad: number;
    precio: number;
    subtotal: number;
  }[];
};

const fechaCorta = (iso: string | null) => {
  if (!iso) return '—';
  // Las fechas sin hora (AAAA-MM-DD) se anclan al mediodía para que el
  // huso horario de Lima no las corra un día hacia atrás.
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Date(valor).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export function VistaCotizacion({
  cot,
  pdfHref,
}: {
  cot: CotizacionDetalle;
  pdfHref?: string | null;
}) {
  const totales = calcularTotales(
    cot.lineas.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precio })),
    cot.feePorcentaje,
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Cotización{' '}
            <span className="ml-2 font-mono text-[15px] text-petroleo-oscuro">
              {cot.codigo}
            </span>
          </h1>
          <p className="mt-0.5 text-[13px] text-tinta-tenue">
            {cot.cliente} · {cot.proyecto || 'Sin proyecto'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pdfHref && (
            <a
              href={pdfHref}
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
          <BadgeEstado estado={cot.estado} />
        </div>
      </div>

      {cot.estado === 'pendiente' && (
        <Banner color="ambar">
          En cola de aprobación. Administración la revisará y recibirás un
          correo con el resultado.
        </Banner>
      )}
      {cot.estado === 'aprobada' && (
        <Banner color="verde">
          Aprobada por {cot.aprobadaPor ?? 'administración'} el{' '}
          {fechaCorta(cot.fechaAprobacion)}.
        </Banner>
      )}
      {cot.estado === 'anulada' && (
        <Banner color="rojo">
          Anulada por {cot.anuladaPor ?? '—'}
          {cot.motivoAnulacion ? ` — "${cot.motivoAnulacion}"` : ''}. Su código
          nunca se reutilizará.
        </Banner>
      )}
      {cot.estado === 'observada' && cot.observacionAdmin && (
        <Banner color="ambar">
          Observada: {cot.observacionAdmin}
        </Banner>
      )}

      <div className="rounded-xl border border-linea bg-white p-6 shadow-tarjeta">
        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-4">
          <Dato k="Cliente" v={cot.cliente} />
          <Dato k="Proyecto" v={cot.proyecto || '—'} />
          <Dato k="Ejecutivo" v={cot.ejecutivo} />
          <Dato k="Envío al cliente" v={fechaCorta(cot.fechaEnvioCliente)} />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-tinta-tenue">
              <th className="w-9 px-2 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Proveedor</th>
              <th className="px-2 py-2 font-semibold">Descripción</th>
              <th className="px-2 py-2 text-right font-semibold">Cant.</th>
              <th className="px-2 py-2 text-right font-semibold">P. unit.</th>
              <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cot.lineas.map((l) => (
              <tr key={l.orden} className="border-b border-linea-suave text-[13px]">
                <td className="px-2 py-2.5 text-center font-mono text-[12px] text-tinta-tenue">
                  {l.orden}
                </td>
                <td className="px-2 py-2.5">{l.proveedor}</td>
                <td className="px-2 py-2.5 text-tinta-suave">
                  {l.descripcion || '—'}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">{l.cantidad}</td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {formatearMonto(l.precio, cot.moneda)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold">
                  {formatearMonto(l.subtotal, cot.moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <div className="w-80">
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>Subtotal proveedores</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.subtotal, cot.moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>Fee intermediación ({cot.feePorcentaje}%)</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.fee, cot.moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px] font-semibold">
              <span>Monto neto</span>
              <span className="font-mono">
                {formatearMonto(totales.neto, cot.moneda)}
              </span>
            </div>
            <div className="flex justify-between border-b border-linea-suave py-2 text-[13px]">
              <span>IGV (18%)</span>
              <span className="font-mono font-semibold">
                {formatearMonto(totales.igv, cot.moneda)}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-tinta pt-3 text-[16px] font-bold">
              <span>Total</span>
              <span className="font-mono">
                {formatearMonto(totales.total, cot.moneda)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-tinta-tenue">
        {k}
      </div>
      <div className="mt-0.5 font-medium">{v}</div>
    </div>
  );
}

function Banner({
  color,
  children,
}: {
  color: 'verde' | 'ambar' | 'rojo';
  children: React.ReactNode;
}) {
  const clases = {
    verde: 'border-verde/30 bg-verde-fondo text-verde',
    ambar: 'border-ambar/30 bg-ambar-fondo text-ambar',
    rojo: 'border-rojo/30 bg-rojo-fondo text-rojo',
  }[color];
  return (
    <div className={`mb-5 rounded-[10px] border p-3.5 text-[12.5px] ${clases}`}>
      {children}
    </div>
  );
}
