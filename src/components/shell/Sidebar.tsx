'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONOS: Record<string, React.ReactNode> = {
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  banco: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 4v16" />
    </svg>
  ),
  cotizaciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  ),
  aprobaciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  ),
  fichas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 2h6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2 2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2 2 2 0 0 0 2-2 2 2 0 0 1 2-2z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  ordenes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  control: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  ),
  usuarios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: keyof typeof ICONOS;
  badge?: number;
};

export type GrupoNav = { titulo: string; items: ItemNav[] };

export function Sidebar({
  grupos,
  onNavegar,
}: {
  grupos: GrupoNav[];
  onNavegar?: () => void;
}) {
  const ruta = usePathname();

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto bg-lateral py-6">
      <div className="mx-6 mb-5 border-b border-white/10 pb-6">
        <Image
          src="/marca/logo-metrica-blanco.png"
          alt="Métrica"
          width={734}
          height={372}
          priority
          className="h-7 w-auto"
        />
        <div className="mt-2 text-[10.5px] tracking-wide text-lateral-texto">
          Sistema Operativo
        </div>
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="mb-1.5 px-3.5">
          <div className="px-2.5 pb-2 pt-3.5 text-[10px] uppercase tracking-[0.12em] text-lateral-texto/60">
            {grupo.titulo}
          </div>
          {grupo.items.map((item) => {
            const activo =
              ruta === item.href || ruta.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavegar}
                className={`relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium transition ${
                  activo
                    ? 'bg-lateral-claro text-lateral-activo'
                    : 'text-lateral-texto hover:bg-lateral-claro hover:text-lateral-activo'
                }`}
              >
                {activo && (
                  <span className="absolute -left-3.5 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r bg-petroleo" />
                )}
                <span className="h-[17px] w-[17px] shrink-0 opacity-85 [&_svg]:h-full [&_svg]:w-full">
                  {ICONOS[item.icono]}
                </span>
                {item.etiqueta}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto rounded-full bg-terracota px-[7px] py-px font-mono text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mx-6 mt-auto border-t border-white/10 pt-4">
        <div className="font-mono text-[11px] text-lateral-texto">
          métrica.com.pe
        </div>
        <div className="mt-1 font-mono text-[11px] text-lateral-texto/50">
          fase 4 · tabla de control
        </div>
      </div>
    </aside>
  );
}
