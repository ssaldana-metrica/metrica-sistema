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
  // true = vista para revisión de administración (aún sin aprobar):
  // lleva una franja que la distingue del documento oficial.
  preliminar?: boolean;
};

const VERDE = '#0E7C66';
const TINTA = '#16201C';
const GRIS = '#828B83';
const LINEA = '#E3E2DA';

const s = StyleSheet.create({
  pagina: {
    padding: 48,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: TINTA,
    lineHeight: 1.4,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: TINTA,
    paddingBottom: 14,
    marginBottom: 16,
  },
  logo: { fontSize: 20, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  logoAcento: { color: VERDE },
  sub: { fontSize: 8, color: GRIS, marginTop: 7 },
  meta: { textAlign: 'right', fontSize: 8.5, color: '#4C564F' },
  metaCodigo: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: TINTA, marginVertical: 2 },
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dato: { width: '50%', marginBottom: 6 },
  datoK: { fontSize: 7.5, color: GRIS, textTransform: 'uppercase', letterSpacing: 0.5 },
  datoV: { fontSize: 9.5, marginTop: 1.5 },
  tabla: { borderWidth: 1, borderColor: LINEA, borderRadius: 4 },
  filaCab: {
    flexDirection: 'row',
    backgroundColor: '#F4F3EC',
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
  },
  fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINEA },
  filaUltima: { flexDirection: 'row' },
  celdaCab: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#4C564F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  celda: { paddingVertical: 6, paddingHorizontal: 8 },
  cNum: { width: '5%' },
  cProv: { width: '24%' },
  cDesc: { width: '29%' },
  cCant: { width: '7%', textAlign: 'right' },
  cPrecio: { width: '17.5%', textAlign: 'right' },
  cSub: { width: '17.5%', textAlign: 'right' },
  totales: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  cajaTotales: { width: 220 },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3.5,
  },
  granTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: TINTA,
    marginTop: 4,
    paddingTop: 7,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  nota: {
    marginTop: 26,
    borderTopWidth: 1,
    borderTopColor: LINEA,
    paddingTop: 10,
    fontSize: 8,
    color: GRIS,
    lineHeight: 1.5,
  },
  pieIzq: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    fontSize: 7.5,
    color: GRIS,
  },
  pieDer: {
    position: 'absolute',
    bottom: 28,
    right: 48,
    fontSize: 7.5,
    color: GRIS,
  },
  franjaPreliminar: {
    backgroundColor: '#F6ECD2',
    color: '#8A6414',
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

const fechaLarga = (iso: string | null) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

function DocumentoCotizacion({ d }: { d: DatosPdf }) {
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
        {/* Pie fijo: se repite en cada página */}
        <Text style={s.pieIzq} fixed>
          Documento generado por el Sistema Operativo de {EMPRESA.nombre} ·
          uso interno
        </Text>
        <Text
          style={s.pieDer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />

        {d.preliminar && (
          <Text style={s.franjaPreliminar}>
            Vista preliminar · pendiente de aprobación — no es el documento
            oficial
          </Text>
        )}

        <View style={s.cabecera}>
          <View>
            <Text style={s.logo}>
              Métri<Text style={s.logoAcento}>ca</Text>
            </Text>
            <Text style={s.sub}>
              {EMPRESA.razonSocial} · RUC {EMPRESA.ruc}
            </Text>
          </View>
          <View style={s.meta}>
            <Text>COTIZACIÓN</Text>
            <Text style={s.metaCodigo}>{d.codigo}</Text>
            <Text>{hoy}</Text>
          </View>
        </View>

        <View style={s.rejilla}>
          <View style={s.dato}>
            <Text style={s.datoK}>Cliente</Text>
            <Text style={s.datoV}>
              {d.cliente.razonSocial} ({d.cliente.nombre})
            </Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoK}>RUC del cliente</Text>
            <Text style={s.datoV}>{d.cliente.ruc || '—'}</Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoK}>Proyecto / Servicio</Text>
            <Text style={s.datoV}>{d.proyecto || '—'}</Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoK}>Ejecutivo responsable</Text>
            <Text style={s.datoV}>{d.ejecutivo}</Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoK}>Moneda</Text>
            <Text style={s.datoV}>
              {d.moneda === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}
            </Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoK}>Fecha de envío al cliente</Text>
            <Text style={s.datoV}>{fechaLarga(d.fechaEnvioCliente)}</Text>
          </View>
        </View>

        <View style={s.tabla}>
          <View style={s.filaCab}>
            <Text style={[s.celdaCab, s.cNum]}>#</Text>
            <Text style={[s.celdaCab, s.cProv]}>Proveedor</Text>
            <Text style={[s.celdaCab, s.cDesc]}>Descripción</Text>
            <Text style={[s.celdaCab, s.cCant]}>Cant.</Text>
            <Text style={[s.celdaCab, s.cPrecio]}>P. unit.</Text>
            <Text style={[s.celdaCab, s.cSub]}>Subtotal</Text>
          </View>
          {d.lineas.map((l, i) => (
            <View
              key={l.orden}
              style={i === d.lineas.length - 1 ? s.filaUltima : s.fila}
              wrap={false}
            >
              <Text style={[s.celda, s.cNum]}>{l.orden}</Text>
              <Text style={[s.celda, s.cProv]}>{l.proveedor}</Text>
              <Text style={[s.celda, s.cDesc]}>{l.descripcion || '—'}</Text>
              <Text style={[s.celda, s.cCant]}>{l.cantidad}</Text>
              <Text style={[s.celda, s.cPrecio]}>
                {formatearMonto(l.precio, d.moneda)}
              </Text>
              <Text style={[s.celda, s.cSub]}>
                {formatearMonto(l.subtotal, d.moneda)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.totales}>
          <View style={s.cajaTotales}>
            <View style={s.filaTotal}>
              <Text style={{ color: GRIS }}>Subtotal proveedores</Text>
              <Text>{formatearMonto(t.subtotal, d.moneda)}</Text>
            </View>
            <View style={s.filaTotal}>
              <Text style={{ color: GRIS }}>
                Fee intermediación ({d.feePorcentaje}%)
              </Text>
              <Text>{formatearMonto(t.fee, d.moneda)}</Text>
            </View>
            <View style={[s.filaTotal, { borderTopWidth: 1, borderTopColor: LINEA }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Monto neto</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                {formatearMonto(t.neto, d.moneda)}
              </Text>
            </View>
            <View style={s.filaTotal}>
              <Text style={{ color: GRIS }}>IGV (18%)</Text>
              <Text>{formatearMonto(t.igv, d.moneda)}</Text>
            </View>
            <View style={s.granTotal}>
              <Text>Total</Text>
              <Text>{formatearMonto(t.total, d.moneda)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.nota}>• {EMPRESA.notaCotizacion}</Text>
      </Page>
    </Document>
  );
}

export async function generarPdfCotizacion(d: DatosPdf): Promise<Buffer> {
  return await renderToBuffer(<DocumentoCotizacion d={d} />);
}
