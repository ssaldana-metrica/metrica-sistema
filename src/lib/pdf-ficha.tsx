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

export type DatosPdfFicha = {
  codigo: string;
  cliente: {
    nombre: string;
    ruc: string;
    politicaPago: string;
    contacto: string;
    correo: string;
  };
  servicio: {
    inicio: string | null;
    fin: string | null;
    facturarAntes: boolean;
    moneda: Moneda;
    observaciones: string;
  };
  seguimientoCliente: {
    numFactura: string;
    oc: string;
    hes: string;
    fechaEmision: string | null;
    total: number | null;
  };
  proveedores: {
    orden: number;
    agencia: string;
    influencer: string;
    ruc: string;
    descripcion: string;
    monto: number;
    banco: string;
    cuentaCci: string;
    numOc: string;
    numFactura: string;
    total: number | null;
    monedaTotal: Moneda;
    importe: number | null;
    monedaImporte: Moneda;
    pagoFraccionado: boolean;
  }[];
};

const VERDE = '#0E7C66';
const TINTA = '#16201C';
const GRIS = '#828B83';
const LINEA = '#E3E2DA';

const s = StyleSheet.create({
  pagina: { padding: 42, fontSize: 9, fontFamily: 'Helvetica', color: TINTA, lineHeight: 1.4 },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: TINTA,
    paddingBottom: 12,
    marginBottom: 14,
  },
  logo: { fontSize: 19, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  logoAcento: { color: VERDE },
  sub: { fontSize: 7.5, color: GRIS, marginTop: 6 },
  meta: { textAlign: 'right', fontSize: 8, color: '#4C564F' },
  metaCodigo: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: TINTA, marginVertical: 2 },
  seccion: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  dato: { width: '50%', marginBottom: 6, paddingRight: 10 },
  datoK: { fontSize: 7, color: GRIS, textTransform: 'uppercase', letterSpacing: 0.4 },
  datoV: { fontSize: 9, marginTop: 1.5 },
  tabla: { borderWidth: 1, borderColor: LINEA, borderRadius: 4, marginTop: 2 },
  filaCab: { flexDirection: 'row', backgroundColor: '#F4F3EC', borderBottomWidth: 1, borderBottomColor: LINEA },
  fila: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINEA },
  filaUltima: { flexDirection: 'row' },
  cab: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#4C564F',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  celda: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 7.8 },
  cProv: { width: '20%' },
  cDesc: { width: '20%' },
  cBanco: { width: '20%' },
  cMonto: { width: '13%', textAlign: 'right' },
  cFact: { width: '14%' },
  cImporte: { width: '13%', textAlign: 'right' },
  pie: {
    position: 'absolute',
    bottom: 24,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: LINEA,
    paddingTop: 8,
    fontSize: 7,
    color: GRIS,
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

const montoOpt = (n: number | null, m: Moneda) =>
  n != null ? formatearMonto(n, m) : '—';

function Documento({ d }: { d: DatosPdfFicha }) {
  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return (
    <Document title={`Ficha ${d.codigo}`} author={EMPRESA.razonSocial} creator="Métrica · Sistema Operativo">
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
            <Text>FICHA DE APERTURA</Text>
            <Text style={s.metaCodigo}>{d.codigo}</Text>
            <Text>{hoy}</Text>
          </View>
        </View>

        <Text style={s.seccion}>Cliente</Text>
        <View style={s.rejilla}>
          <Dato k="Cliente" v={d.cliente.nombre} />
          <Dato k="RUC" v={d.cliente.ruc || '—'} />
          <Dato k="Política de pago" v={d.cliente.politicaPago || '—'} />
          <Dato k="Contacto de aprobación" v={d.cliente.contacto || '—'} />
          <Dato k="Correo del contacto" v={d.cliente.correo || '—'} />
        </View>

        <Text style={s.seccion}>Servicio</Text>
        <View style={s.rejilla}>
          <Dato k="Inicio de acciones" v={fechaLarga(d.servicio.inicio)} />
          <Dato k="Fin de acciones" v={fechaLarga(d.servicio.fin)} />
          <Dato k="Moneda general" v={d.servicio.moneda === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'} />
          <Dato k="Facturar antes del fin" v={d.servicio.facturarAntes ? 'Sí' : 'No'} />
          {d.servicio.observaciones ? (
            <View style={{ width: '100%', marginBottom: 6 }}>
              <Text style={s.datoK}>Observaciones</Text>
              <Text style={s.datoV}>{d.servicio.observaciones}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.seccion}>Seguimiento del cliente</Text>
        <View style={s.rejilla}>
          <Dato k="N° factura al cliente" v={d.seguimientoCliente.numFactura || '—'} />
          <Dato k="OC del cliente" v={d.seguimientoCliente.oc || '—'} />
          <Dato k="HES" v={d.seguimientoCliente.hes || '—'} />
          <Dato k="Fecha de emisión" v={fechaLarga(d.seguimientoCliente.fechaEmision)} />
          <Dato
            k="Total"
            v={montoOpt(d.seguimientoCliente.total, d.servicio.moneda)}
          />
        </View>

        <Text style={s.seccion}>Proveedores que cobran</Text>
        <View style={s.tabla}>
          <View style={s.filaCab}>
            <Text style={[s.cab, s.cProv]}>Proveedor</Text>
            <Text style={[s.cab, s.cDesc]}>Descripción</Text>
            <Text style={[s.cab, s.cBanco]}>Banco / CCI</Text>
            <Text style={[s.cab, s.cMonto]}>Monto</Text>
            <Text style={[s.cab, s.cFact]}>N° factura</Text>
            <Text style={[s.cab, s.cImporte]}>Importe</Text>
          </View>
          {d.proveedores.map((p, i) => {
            const nombre = [p.agencia, p.influencer].filter(Boolean).join(' · ') || '—';
            const banco = [p.banco, p.cuentaCci].filter(Boolean).join(' · ') || '—';
            return (
              <View
                key={p.orden}
                style={i === d.proveedores.length - 1 ? s.filaUltima : s.fila}
                wrap={false}
              >
                <Text style={[s.celda, s.cProv]}>
                  {nombre}
                  {p.ruc ? `\nRUC ${p.ruc}` : ''}
                </Text>
                <Text style={[s.celda, s.cDesc]}>{p.descripcion || '—'}</Text>
                <Text style={[s.celda, s.cBanco]}>{banco}</Text>
                <Text style={[s.celda, s.cMonto]}>
                  {formatearMonto(p.monto, d.servicio.moneda)}
                </Text>
                <Text style={[s.celda, s.cFact]}>
                  {p.numFactura || '—'}
                  {p.pagoFraccionado ? '\n(fraccionado)' : ''}
                </Text>
                <Text style={[s.celda, s.cImporte]}>
                  {montoOpt(p.importe, p.monedaImporte)}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={s.pie} fixed>
          Ficha de apertura generada por el Sistema Operativo de {EMPRESA.nombre} ·
          documento de uso interno
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

export async function generarPdfFicha(d: DatosPdfFicha): Promise<Buffer> {
  return await renderToBuffer(<Documento d={d} />);
}
