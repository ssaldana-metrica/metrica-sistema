import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { EMPRESA } from '@/config/empresa';
import { formatearMonto, type Moneda } from '@/lib/calculos';
import { calcularImpuestos, type TipoProveedorImp } from '@/config/impuestos';
import { CLAUSULAS_ODA } from '@/config/oda';

export type DatosPdfOda = {
  codigo: string;
  fechaEmision: string | null;
  proveedor: {
    razonSocial: string;
    nombreComercial: string;
    ruc: string;
    tipo: TipoProveedorImp;
    banco: string;
    cuentaCci: string;
    email: string;
  };
  descripcion: string;
  monto: number;
  moneda: Moneda;
  condicionesPago: string;
};

const VERDE = '#0E7C66';
const TINTA = '#16201C';
const GRIS = '#828B83';
const LINEA = '#E3E2DA';

const s = StyleSheet.create({
  pagina: { padding: 46, fontSize: 9.5, fontFamily: 'Helvetica', color: TINTA, lineHeight: 1.45 },
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
  seccion: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '50%', marginBottom: 6, paddingRight: 10 },
  datoK: { fontSize: 7.5, color: GRIS, textTransform: 'uppercase', letterSpacing: 0.5 },
  datoV: { fontSize: 9.5, marginTop: 1.5 },
  parrafo: { fontSize: 9.5, marginBottom: 4 },
  totales: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  caja: { width: 240 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
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
    marginTop: 8,
    backgroundColor: '#F6ECD2',
    color: '#8A6414',
    fontSize: 8.5,
    padding: 8,
    borderRadius: 4,
  },
  clausula: { fontSize: 8.5, color: '#4C564F', marginBottom: 4, lineHeight: 1.5 },
  pie: {
    position: 'absolute',
    bottom: 26,
    left: 46,
    right: 46,
    borderTopWidth: 1,
    borderTopColor: LINEA,
    paddingTop: 8,
    fontSize: 7.5,
    color: GRIS,
  },
});

const fechaLarga = (iso: string | null) =>
  (iso ? new Date(iso) : new Date()).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

function Documento({ d }: { d: DatosPdfOda }) {
  const imp = calcularImpuestos(d.monto, d.proveedor.tipo);
  return (
    <Document
      title={`Orden de adquisición ${d.codigo}`}
      author={EMPRESA.razonSocial}
      creator="Métrica · Sistema Operativo"
    >
      <Page size="A4" style={s.pagina}>
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
            <Text>ORDEN DE ADQUISICIÓN</Text>
            <Text style={s.metaCodigo}>{d.codigo}</Text>
            <Text>{fechaLarga(d.fechaEmision)}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Proveedor</Text>
        <View style={s.rejilla}>
          <Dato k="Razón social" v={d.proveedor.razonSocial || '—'} />
          <Dato k="Nombre comercial" v={d.proveedor.nombreComercial || '—'} />
          <Dato k="RUC" v={d.proveedor.ruc || '—'} />
          <Dato
            k="Tipo"
            v={d.proveedor.tipo === 'persona_natural' ? 'Persona natural' : 'Empresa'}
          />
          <Dato k="Banco" v={d.proveedor.banco || '—'} />
          <Dato k="Cuenta / CCI" v={d.proveedor.cuentaCci || '—'} />
          <Dato k="Email" v={d.proveedor.email || '—'} />
        </View>

        <Text style={s.seccion}>Detalle</Text>
        <Text style={s.parrafo}>{d.descripcion || '—'}</Text>

        <View style={s.totales}>
          <View style={s.caja}>
            <View style={s.fila}>
              <Text style={{ color: GRIS }}>
                {imp.modo === 'igv' ? 'Subtotal' : 'Monto (honorarios)'}
              </Text>
              <Text>{formatearMonto(imp.base, d.moneda)}</Text>
            </View>
            <View style={s.fila}>
              <Text style={{ color: GRIS }}>{imp.etiquetaImpuesto}</Text>
              <Text>
                {imp.modo === 'retencion' ? '− ' : ''}
                {formatearMonto(imp.impuesto, d.moneda)}
              </Text>
            </View>
            <View style={s.granTotal}>
              <Text>{imp.etiquetaTotal}</Text>
              <Text>{formatearMonto(imp.total, d.moneda)}</Text>
            </View>
          </View>
        </View>

        {d.proveedor.tipo === 'persona_natural' && (
          <Text style={s.nota}>
            Proveedor persona natural: aplica retención de renta del{' '}
            {imp.porcentaje}% sobre el monto. El neto a pagar ya considera la
            retención.
          </Text>
        )}

        {d.condicionesPago ? (
          <>
            <Text style={s.seccion}>Condiciones de pago</Text>
            <Text style={s.parrafo}>{d.condicionesPago}</Text>
          </>
        ) : null}

        <Text style={s.seccion}>Cláusulas</Text>
        {CLAUSULAS_ODA.map((c, i) => (
          <Text key={i} style={s.clausula}>
            {i + 1}. {c}
          </Text>
        ))}

        <Text style={s.pie} fixed>
          Orden de adquisición emitida por {EMPRESA.razonSocial} · RUC{' '}
          {EMPRESA.ruc}
        </Text>
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

export async function generarPdfOda(d: DatosPdfOda): Promise<Buffer> {
  return await renderToBuffer(<Documento d={d} />);
}
