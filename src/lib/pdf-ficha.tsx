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

export type FacturaClientePdf = {
  numFactura: string;
  oc: string;
  hes: string;
  fechaEmision: string | null;
  total: number | null;
};

export type FacturaProveedorPdf = {
  numOc: string;
  numFactura: string;
  fechaEmision: string | null;
  total: number | null;
  monedaTotal: Moneda;
};

// Suma de montos agrupada por moneda (los totales pueden venir en S/ o $).
function totalesPorMoneda(items: { total: number | null; moneda: Moneda }[]) {
  const acc: Record<Moneda, number> = { PEN: 0, USD: 0 };
  for (const it of items) if (it.total != null) acc[it.moneda] += it.total;
  return (['PEN', 'USD'] as Moneda[])
    .filter((m) => acc[m] > 0)
    .map((m) => formatearMonto(acc[m], m));
}

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
  facturasCliente: FacturaClientePdf[];
  proveedores: {
    orden: number;
    agencia: string;
    influencer: string;
    ruc: string;
    descripcion: string;
    monto: number;
    banco: string;
    cuentaCci: string;
    facturas: FacturaProveedorPdf[];
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
  // Tabla de facturas del cliente
  fcFact: { width: '24%' },
  fcOc: { width: '20%' },
  fcHes: { width: '18%' },
  fcFecha: { width: '20%' },
  fcTotal: { width: '18%', textAlign: 'right' },
  // Proveedor
  provBloque: { borderWidth: 1, borderColor: LINEA, borderRadius: 4, marginBottom: 8, padding: 8 },
  provNombre: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  provMeta: { fontSize: 7.6, color: GRIS, marginTop: 2 },
  provMonto: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  // Sub-tabla de facturas del proveedor
  pfOc: { width: '26%' },
  pfFact: { width: '28%' },
  pfFecha: { width: '24%' },
  pfTotal: { width: '22%', textAlign: 'right' },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINEA,
  },
  totalEtq: { fontSize: 8, color: GRIS, textTransform: 'uppercase', letterSpacing: 0.4 },
  totalVal: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  resumen: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: TINTA,
    borderRadius: 4,
    backgroundColor: '#F4F3EC',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  resumenEtq: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  resumenVal: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  vacio: { fontSize: 7.8, color: GRIS, fontStyle: 'italic', marginTop: 4 },
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
        month: 'short',
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

        <Text style={s.seccion}>Facturas al cliente</Text>
        {d.facturasCliente.length === 0 ? (
          <Text style={s.vacio}>Sin facturas registradas.</Text>
        ) : (
          <>
            <View style={s.tabla}>
              <View style={s.filaCab}>
                <Text style={[s.cab, s.fcFact]}>N° factura</Text>
                <Text style={[s.cab, s.fcOc]}>OC</Text>
                <Text style={[s.cab, s.fcHes]}>HES</Text>
                <Text style={[s.cab, s.fcFecha]}>Emisión</Text>
                <Text style={[s.cab, s.fcTotal]}>Total</Text>
              </View>
              {d.facturasCliente.map((fc, i) => (
                <View
                  key={i}
                  style={i === d.facturasCliente.length - 1 ? s.filaUltima : s.fila}
                  wrap={false}
                >
                  <Text style={[s.celda, s.fcFact]}>{fc.numFactura || '—'}</Text>
                  <Text style={[s.celda, s.fcOc]}>{fc.oc || '—'}</Text>
                  <Text style={[s.celda, s.fcHes]}>{fc.hes || '—'}</Text>
                  <Text style={[s.celda, s.fcFecha]}>{fechaLarga(fc.fechaEmision)}</Text>
                  <Text style={[s.celda, s.fcTotal]}>
                    {montoOpt(fc.total, d.servicio.moneda)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.totalFila}>
              <Text style={s.totalEtq}>Total facturado al cliente</Text>
              <Text style={s.totalVal}>
                {formatearMonto(
                  d.facturasCliente.reduce((a, fc) => a + (fc.total ?? 0), 0),
                  d.servicio.moneda,
                )}
              </Text>
            </View>
          </>
        )}

        <Text style={s.seccion}>Proveedores que cobran</Text>
        {d.proveedores.map((p) => {
          const nombre = [p.agencia, p.influencer].filter(Boolean).join(' · ') || '—';
          const banco = [p.banco, p.cuentaCci].filter(Boolean).join(' · ') || '—';
          return (
            <View key={p.orden} style={s.provBloque} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.provNombre}>{nombre}</Text>
                  <Text style={s.provMeta}>
                    {p.ruc ? `RUC ${p.ruc} · ` : ''}
                    {p.descripcion || 'Sin descripción'}
                  </Text>
                  <Text style={s.provMeta}>{banco}</Text>
                </View>
                <View>
                  <Text style={s.datoK}>Monto</Text>
                  <Text style={s.provMonto}>
                    {formatearMonto(p.monto, d.servicio.moneda)}
                  </Text>
                </View>
              </View>

              {p.facturas.length === 0 ? (
                <Text style={s.vacio}>Sin facturas de seguimiento.</Text>
              ) : (
                <>
                  <View style={[s.tabla, { marginTop: 6 }]}>
                    <View style={s.filaCab}>
                      <Text style={[s.cab, s.pfOc]}>N° OC</Text>
                      <Text style={[s.cab, s.pfFact]}>N° factura</Text>
                      <Text style={[s.cab, s.pfFecha]}>Emisión</Text>
                      <Text style={[s.cab, s.pfTotal]}>Total</Text>
                    </View>
                    {p.facturas.map((fp, j) => (
                      <View
                        key={j}
                        style={j === p.facturas.length - 1 ? s.filaUltima : s.fila}
                        wrap={false}
                      >
                        <Text style={[s.celda, s.pfOc]}>{fp.numOc || '—'}</Text>
                        <Text style={[s.celda, s.pfFact]}>{fp.numFactura || '—'}</Text>
                        <Text style={[s.celda, s.pfFecha]}>{fechaLarga(fp.fechaEmision)}</Text>
                        <Text style={[s.celda, s.pfTotal]}>
                          {montoOpt(fp.total, fp.monedaTotal)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.totalFila}>
                    <Text style={s.totalEtq}>Total seguimiento</Text>
                    <Text style={s.totalVal}>
                      {totalesPorMoneda(
                        p.facturas.map((fp) => ({
                          total: fp.total,
                          moneda: fp.monedaTotal,
                        })),
                      ).join('  +  ') || '—'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          );
        })}

        {d.proveedores.length > 0 && (
          <View style={s.resumen} wrap={false}>
            <View style={s.resumenFila}>
              <Text style={s.resumenEtq}>Total de montos (proveedores)</Text>
              <Text style={s.resumenVal}>
                {formatearMonto(
                  d.proveedores.reduce((a, p) => a + (p.monto || 0), 0),
                  d.servicio.moneda,
                )}
              </Text>
            </View>
            <View style={s.resumenFila}>
              <Text style={[s.resumenEtq, { color: GRIS }]}>
                Total de seguimiento
              </Text>
              <Text style={s.resumenVal}>
                {totalesPorMoneda(
                  d.proveedores.flatMap((p) =>
                    p.facturas.map((fp) => ({
                      total: fp.total,
                      moneda: fp.monedaTotal,
                    })),
                  ),
                ).join('  +  ') || '—'}
              </Text>
            </View>
          </View>
        )}

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
