import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { EMPRESA } from '@/config/empresa';
import {
  calcularTotales,
  formatearMonto,
  type Moneda,
} from '@/lib/calculos';
import {
  C,
  EncabezadoPdf,
  PiePdf,
  FranjaPreliminar,
  SelloAnulado,
} from '@/lib/pdf-marca';

export type DatosPdf = {
  codigo: string;
  proyecto: string;
  moneda: Moneda;
  feePorcentaje: number;
  fechaEnvioCliente: string | null;
  cliente: { nombre: string; razonSocial: string; ruc: string };
  ejecutivo: string;
  lineas: {
    orden: number;
    proveedor: string;
    descripcion: string;
    cantidad: number;
    precio: number;
    subtotal: number;
  }[];
  // true = vista para revisión de administración (aún sin aprobar).
  preliminar?: boolean;
  // true = pinta el sello "ANULADO".
  anulada?: boolean;
};

const s = StyleSheet.create({
  pagina: {
    paddingTop: 42,
    paddingBottom: 60,
    paddingHorizontal: 44,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: C.tinta,
    lineHeight: 1.4,
  },
  // Datos
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
  dato: { width: '50%', marginBottom: 9, paddingRight: 12 },
  datoK: { fontSize: 7.5, color: C.gris, textTransform: 'uppercase', letterSpacing: 0.6 },
  datoV: { fontSize: 10, color: C.navy, marginTop: 2, fontFamily: 'Helvetica-Bold' },
  // Tabla
  tabla: { borderWidth: 1, borderColor: C.linea, borderRadius: 5, overflow: 'hidden' },
  filaCab: { flexDirection: 'row', backgroundColor: C.fondoCab },
  fila: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.linea },
  cab: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  celda: { paddingVertical: 7, paddingHorizontal: 8, fontSize: 9 },
  cNum: { width: '5%', color: C.grisClaro, fontFamily: 'Helvetica' },
  cProv: { width: '24%', fontFamily: 'Helvetica-Bold' },
  cDesc: { width: '28%', color: C.navySuave },
  cCant: { width: '8%', textAlign: 'right' },
  cPrecio: { width: '17.5%', textAlign: 'right' },
  cSub: { width: '17.5%', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  mono: { fontFamily: 'Courier' },
  // Totales
  totales: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  caja: { width: 250 },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  totK: { fontSize: 9, color: C.gris },
  totKneto: { fontSize: 9, color: C.navy, fontFamily: 'Helvetica-Bold' },
  totV: { fontSize: 9, color: C.tinta, fontFamily: 'Courier' },
  totNetoBorde: { borderTopWidth: 1, borderTopColor: C.linea },
  granTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.fondoTotal,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 5,
  },
  gtK: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.navy },
  gtV: { fontSize: 13, fontFamily: 'Courier', color: C.navy },
  nota: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: C.linea,
    paddingTop: 10,
    fontSize: 8,
    color: C.gris,
    lineHeight: 1.5,
  },
});

const fechaLarga = (iso: string | null) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

function Documento({ d }: { d: DatosPdf }) {
  const t = calcularTotales(
    d.lineas.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precio })),
    d.feePorcentaje,
  );
  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document
      title={`Cotización ${d.codigo}`}
      author={EMPRESA.razonSocial}
      creator="Métrica · Sistema Operativo"
    >
      <Page size="A4" style={s.pagina}>
        {d.anulada && <SelloAnulado />}
        <EncabezadoPdf tipo="COTIZACIÓN" codigo={d.codigo} fecha={hoy} />
        {d.preliminar && <FranjaPreliminar />}

        <View style={s.rejilla}>
          <Dato k="Cliente" v={`${d.cliente.razonSocial} (${d.cliente.nombre})`} />
          <Dato k="RUC del cliente" v={d.cliente.ruc || '—'} />
          <Dato k="Proyecto / Servicio" v={d.proyecto || '—'} />
          <Dato k="Ejecutivo responsable" v={d.ejecutivo} />
          <Dato k="Moneda" v={d.moneda === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'} />
          <Dato k="Fecha de envío al cliente" v={fechaLarga(d.fechaEnvioCliente)} />
        </View>

        <View style={s.tabla}>
          <View style={s.filaCab}>
            <Text style={[s.cab, s.cNum]}>#</Text>
            <Text style={[s.cab, s.cProv]}>Proveedor</Text>
            <Text style={[s.cab, s.cDesc]}>Descripción</Text>
            <Text style={[s.cab, s.cCant]}>Cant.</Text>
            <Text style={[s.cab, s.cPrecio]}>P. unit.</Text>
            <Text style={[s.cab, s.cSub]}>Subtotal</Text>
          </View>
          {d.lineas.map((l) => (
            <View key={l.orden} style={s.fila} wrap={false}>
              <Text style={[s.celda, s.cNum]}>{l.orden}</Text>
              <Text style={[s.celda, s.cProv]}>{l.proveedor}</Text>
              <Text style={[s.celda, s.cDesc]}>{l.descripcion || '—'}</Text>
              <Text style={[s.celda, s.cCant, s.mono]}>{l.cantidad}</Text>
              <Text style={[s.celda, s.cPrecio, s.mono]}>
                {formatearMonto(l.precio, d.moneda)}
              </Text>
              <Text style={[s.celda, s.cSub, s.mono]}>
                {formatearMonto(l.subtotal, d.moneda)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.totales}>
          <View style={s.caja}>
            <View style={s.filaTotal}>
              <Text style={s.totK}>Subtotal proveedores</Text>
              <Text style={s.totV}>{formatearMonto(t.subtotal, d.moneda)}</Text>
            </View>
            <View style={s.filaTotal}>
              <Text style={s.totK}>Fee intermediación ({d.feePorcentaje}%)</Text>
              <Text style={s.totV}>{formatearMonto(t.fee, d.moneda)}</Text>
            </View>
            <View style={[s.filaTotal, s.totNetoBorde]}>
              <Text style={s.totKneto}>Monto neto</Text>
              <Text style={[s.totV, { fontFamily: 'Courier', color: C.navy }]}>
                {formatearMonto(t.neto, d.moneda)}
              </Text>
            </View>
            <View style={s.filaTotal}>
              <Text style={s.totK}>IGV (18%)</Text>
              <Text style={s.totV}>{formatearMonto(t.igv, d.moneda)}</Text>
            </View>
            <View style={s.granTotal}>
              <Text style={s.gtK}>Total</Text>
              <Text style={s.gtV}>{formatearMonto(t.total, d.moneda)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.nota}>{EMPRESA.notaCotizacion}</Text>

        <PiePdf />
      </Page>
    </Document>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.dato}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV}>{v}</Text>
    </View>
  );
}

export async function generarPdfCotizacion(d: DatosPdf): Promise<Buffer> {
  return await renderToBuffer(<Documento d={d} />);
}
