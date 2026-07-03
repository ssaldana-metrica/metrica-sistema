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
import {
  calcularImpuestos,
  type TipoProveedorImp,
  type TipoComprobante,
} from '@/config/impuestos';
import { CLAUSULAS_ODA } from '@/config/oda';
import { C, EncabezadoPdf, PiePdf, SelloAnulado } from '@/lib/pdf-marca';

export type DatosPdfOda = {
  codigo: string;
  fechaEmision: string | null;
  comprobante: TipoComprobante;
  proveedor: {
    razonSocial: string;
    nombreComercial: string;
    ruc: string;
    tipo: TipoProveedorImp;
    banco: string;
    cuenta: string;
    cci: string;
    email: string;
  };
  detalles: {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }[];
  moneda: Moneda;
  condicionesPago: string;
  anulada?: boolean;
};

const s = StyleSheet.create({
  pagina: {
    paddingTop: 42,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: C.tinta,
    lineHeight: 1.45,
  },
  seccion: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 16,
    marginBottom: 7,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '50%', marginBottom: 7, paddingRight: 12 },
  datoK: { fontSize: 7.5, color: C.gris, textTransform: 'uppercase', letterSpacing: 0.5 },
  datoV: { fontSize: 9.5, color: C.navy, marginTop: 2, fontFamily: 'Helvetica-Bold' },
  parrafo: { fontSize: 9.5, marginBottom: 4, color: C.tinta },
  mono: { fontFamily: 'Courier' },
  tabla: { borderWidth: 1, borderColor: C.linea, borderRadius: 5, overflow: 'hidden' },
  filaCab: { flexDirection: 'row', backgroundColor: C.fondoCab },
  fila: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.linea },
  cab: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  celda: { paddingVertical: 7, paddingHorizontal: 8, fontSize: 8.5 },
  cNro: { width: '7%', textAlign: 'center', color: C.grisClaro },
  cDesc: { width: '45%' },
  cCant: { width: '12%', textAlign: 'right', fontFamily: 'Courier' },
  cUnit: { width: '18%', textAlign: 'right', fontFamily: 'Courier' },
  cMonto: { width: '18%', textAlign: 'right', fontFamily: 'Courier' },
  // Detalle de facturación (a nombre de quién factura el proveedor)
  factNota: { fontSize: 8, color: C.gris, marginBottom: 5 },
  factTabla: { borderWidth: 1, borderColor: C.linea, borderRadius: 5, overflow: 'hidden' },
  factFila: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.linea },
  factK: {
    width: '24%',
    backgroundColor: C.fondoTotal,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },
  factV: {
    width: '76%',
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },
  // Totales
  totales: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  caja: { width: 250 },
  filaTot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  totK: { fontSize: 9, color: C.gris },
  totV: { fontSize: 9, fontFamily: 'Courier', color: C.tinta },
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
    marginTop: 10,
    backgroundColor: C.ambarFondo,
    color: C.ambarTexto,
    fontSize: 8.5,
    padding: 9,
    borderRadius: 4,
  },
  // Viñetas de las cláusulas.
  intro: { flexDirection: 'row', marginBottom: 4 },
  introBullet: { width: 12, fontSize: 8.5, color: C.navy },
  introTexto: { flex: 1, fontSize: 8.5, color: C.navySuave, lineHeight: 1.5 },
});

const fechaLarga = (iso: string | null) =>
  (iso ? new Date(iso) : new Date()).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

function Documento({ d }: { d: DatosPdfOda }) {
  const totalDetalles = d.detalles.reduce((a, x) => a + (x.total || 0), 0);
  const imp = calcularImpuestos(totalDetalles, d.comprobante);
  return (
    <Document
      title={`Orden de adquisición ${d.codigo}`}
      author={EMPRESA.razonSocial}
      creator="Métrica · Sistema Operativo"
    >
      <Page size="A4" style={s.pagina}>
        {d.anulada && <SelloAnulado />}
        <EncabezadoPdf
          tipo="ORDEN DE ADQUISICIÓN"
          codigo={d.codigo}
          fecha={fechaLarga(d.fechaEmision)}
        />

        <Text style={s.seccion}>Proveedor</Text>
        <View style={s.rejilla}>
          <Dato k="Razón social" v={d.proveedor.razonSocial || '—'} />
          <Dato k="Nombre comercial" v={d.proveedor.nombreComercial || '—'} />
          <Dato k="RUC" v={d.proveedor.ruc || '—'} />
          <Dato
            k="Tipo"
            v={d.proveedor.tipo === 'persona_natural' ? 'Persona natural' : 'Empresa'}
          />
          <Dato
            k="Comprobante"
            v={d.comprobante === 'rxh' ? 'Recibo por Honorarios' : 'Factura'}
          />
          <Dato k="Banco" v={d.proveedor.banco || '—'} />
          <Dato k="Cuenta" v={d.proveedor.cuenta || '—'} />
          <Dato k="CCI" v={d.proveedor.cci || '—'} />
          <Dato k="Email" v={d.proveedor.email || '—'} />
        </View>

        <Text style={s.seccion}>Detalle de facturación</Text>
        <Text style={s.factNota}>
          El proveedor debe emitir su comprobante a nombre de:
        </Text>
        <View style={s.factTabla}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={s.factK}>Razón social</Text>
            <Text style={s.factV}>{EMPRESA.razonSocial}</Text>
          </View>
          <View style={s.factFila}>
            <Text style={s.factK}>RUC</Text>
            <Text style={s.factV}>{EMPRESA.ruc}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Detalle de la compra</Text>
        <View style={s.tabla}>
          <View style={s.filaCab}>
            <Text style={[s.cab, s.cNro]}>N°</Text>
            <Text style={[s.cab, s.cDesc]}>Descripción</Text>
            <Text style={[s.cab, s.cCant]}>Cant.</Text>
            <Text style={[s.cab, s.cUnit]}>P. unit.</Text>
            <Text style={[s.cab, s.cMonto]}>Total</Text>
          </View>
          {(d.detalles.length
            ? d.detalles
            : [{ descripcion: '—', cantidad: 0, precioUnitario: 0, total: 0 }]
          ).map((x, i) => (
            <View key={i} style={s.fila} wrap={false}>
              <Text style={[s.celda, s.cNro]}>{i + 1}</Text>
              <Text style={[s.celda, s.cDesc]}>{x.descripcion || '—'}</Text>
              <Text style={[s.celda, s.cCant]}>{x.cantidad}</Text>
              <Text style={[s.celda, s.cUnit]}>
                {formatearMonto(x.precioUnitario || 0, d.moneda)}
              </Text>
              <Text style={[s.celda, s.cMonto]}>
                {formatearMonto(x.total || 0, d.moneda)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.totales}>
          <View style={s.caja}>
            {imp.conIgv && (
              <>
                <View style={s.filaTot}>
                  <Text style={s.totK}>Subtotal</Text>
                  <Text style={s.totV}>{formatearMonto(imp.base, d.moneda)}</Text>
                </View>
                <View style={s.filaTot}>
                  <Text style={s.totK}>IGV ({imp.porcentaje}%)</Text>
                  <Text style={s.totV}>{formatearMonto(imp.igv, d.moneda)}</Text>
                </View>
              </>
            )}
            <View style={s.granTotal}>
              <Text style={s.gtK}>Total</Text>
              <Text style={s.gtV}>{formatearMonto(imp.total, d.moneda)}</Text>
            </View>
          </View>
        </View>

        {d.comprobante === 'rxh' && (
          <Text style={s.nota}>
            Recibo por Honorarios: el importe no lleva IGV. De corresponder, se
            aplicará la retención de renta según la normativa vigente.
          </Text>
        )}

        {d.condicionesPago ? (
          <>
            <Text style={s.seccion}>Condiciones de pago</Text>
            <Text style={s.parrafo}>{d.condicionesPago}</Text>
          </>
        ) : null}

        <Text style={s.seccion}>Cláusulas</Text>
        {CLAUSULAS_ODA.map((t, i) => (
          <View key={i} style={s.intro} wrap={false}>
            <Text style={s.introBullet}>•</Text>
            <Text style={s.introTexto}>{t}</Text>
          </View>
        ))}

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

export async function generarPdfOda(d: DatosPdfOda): Promise<Buffer> {
  return await renderToBuffer(<Documento d={d} />);
}
