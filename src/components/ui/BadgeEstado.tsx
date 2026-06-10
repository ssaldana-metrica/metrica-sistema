const ESTILOS: Record<string, { clase: string; etiqueta: string }> = {
  borrador: { clase: 'bg-pizarra-fondo text-pizarra', etiqueta: 'Borrador' },
  pendiente: { clase: 'bg-ambar-fondo text-ambar', etiqueta: 'Pendiente' },
  aprobada: { clase: 'bg-verde-fondo text-verde', etiqueta: 'Aprobada' },
  observada: { clase: 'bg-azul-fondo text-azul', etiqueta: 'Observada' },
  anulada: { clase: 'bg-rojo-fondo text-rojo', etiqueta: 'Anulada' },
};

export function BadgeEstado({ estado }: { estado: string }) {
  const e = ESTILOS[estado] ?? ESTILOS.borrador;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${e.clase}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {e.etiqueta}
    </span>
  );
}
