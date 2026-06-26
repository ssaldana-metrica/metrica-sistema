import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { EMPRESA } from '@/config/empresa';
import { logoMetrica } from '@/lib/logo';

// Paleta de marca para los PDF (navy Métrica + neutros + estado).
export const C = {
  navy: '#001830',
  navySuave: '#3E4D63',
  gris: '#7C8898',
  grisClaro: '#9AA4B2',
  tinta: '#16243A',
  linea: '#E2E6EC',
  fondoTotal: '#EBEEF2',
  fondoCab: '#001830',
  rojo: '#B23A2C',
  ambarFondo: '#F6ECD2',
  ambarTexto: '#8A6414',
};

const h = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 56, height: 28 },
  empresa: { fontSize: 7.5, color: C.gris, marginTop: 7 },
  meta: { textAlign: 'right' },
  tipo: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.gris,
    letterSpacing: 1,
  },
  codigo: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navy, marginVertical: 3 },
  fecha: { fontSize: 8.5, color: C.navySuave },
  divisor: { height: 2, backgroundColor: C.navy, marginTop: 12, marginBottom: 16 },
});

// Encabezado de marca: logo a la izquierda, tipo/código/fecha a la derecha,
// línea divisoria navy debajo. Igual en los tres documentos.
export function EncabezadoPdf({
  tipo,
  codigo,
  fecha,
}: {
  tipo: string;
  codigo: string;
  fecha: string;
}) {
  return (
    <View>
      <View style={h.fila}>
        <View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoMetrica()} style={h.logo} />
          <Text style={h.empresa}>
            {EMPRESA.razonSocial} · RUC {EMPRESA.ruc}
          </Text>
        </View>
        <View style={h.meta}>
          <Text style={h.tipo}>{tipo}</Text>
          <Text style={h.codigo}>{codigo}</Text>
          <Text style={h.fecha}>{fecha}</Text>
        </View>
      </View>
      <View style={h.divisor} />
    </View>
  );
}

const p = StyleSheet.create({
  linea: {
    position: 'absolute',
    bottom: 36,
    left: 44,
    right: 44,
    height: 1,
    backgroundColor: C.linea,
  },
  izq: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 110,
    fontSize: 7,
    color: C.gris,
  },
  der: {
    position: 'absolute',
    bottom: 22,
    right: 44,
    fontSize: 7,
    color: C.gris,
    textAlign: 'right',
  },
});

// Pie fijo (se repite en cada página): datos de Métrica + número de página.
// Se usan <Text fixed> con posición absoluta — patrón que react-pdf sí ancla
// al fondo de forma fiable.
export function PiePdf() {
  return (
    <>
      <View style={p.linea} fixed />
      <Text style={p.izq} fixed>
        {EMPRESA.razonSocial} · RUC {EMPRESA.ruc} · {EMPRESA.direccion}
      </Text>
      <Text
        style={p.der}
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </>
  );
}

const f = StyleSheet.create({
  preliminar: {
    backgroundColor: C.ambarFondo,
    color: C.ambarTexto,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 14,
  },
});

// Franja de "vista preliminar" para la cotización antes de aprobar.
export function FranjaPreliminar() {
  return (
    <Text style={f.preliminar}>
      Vista preliminar · pendiente de aprobación — no es el documento oficial
    </Text>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.12,
  },
  txt: {
    fontSize: 120,
    fontFamily: 'Helvetica-Bold',
    color: C.rojo,
    transform: 'rotate(-28deg)',
  },
});

// Sello "ANULADO" en diagonal, tenue, sin tapar la información.
export function SelloAnulado() {
  return (
    <View style={s.wrap} fixed>
      <Text style={s.txt}>ANULADO</Text>
    </View>
  );
}
