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
import { C, EncabezadoPdf, PiePdf, SelloAnulado } from '@/lib/pdf-marca';

export type FacturaClientePdf = {
  numFactura: string;
  oc: string;
  hes: string;
  fechaEmision: string | null;
  total: number | null;
  fee: number | null;
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
    razonSocial: string;
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
    cuenta: string;
    cci: string;
    facturas: FacturaProveedorPdf[];
  }[];
  anulada?: boolean;
};

const s = StyleSheet.create({
  pagina: {
    paddingTop: 42,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: C.tinta,
    lineHeight: 1.4,
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
  datoK: { fontSize: 7, color: C.gris, textTransform: 'uppercase', letterSpacing: 0.4 },
  datoV: { fontSize: 9.5, color: C.navy, marginTop: 2, fontFamily: 'Helvetica-Bold' },
  mono: { fontFamily: 'Courier' },
  tabla: { borderWidth: 1, borderColor: C.linea, borderRadius: 4, overflow: 'hidden' },
  filaCab: { flexDirection: 'row', backgroundColor: C.fondoCab },
  fila: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.linea },
  cab: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  celda: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 8 },
  // Facturas del cliente
  fcFact: { width: '22%', fontFamily: 'Helvetica-Bold' },
  fcOc: { width: '16%' },
  fcHes: { width: '16%' },
  fcFecha: { width: '18%' },
  fcTotal: { width: '14%', textAlign: 'right', fontFamily: 'Courier' },
  fcFee: { width: '14%', textAlign: 'right', fontFamily: 'Courier' },
  // Proveedor
  provBloque: { borderWidth: 1, borderColor: C.linea, borderRadius: 5, marginBottom: 9, padding: 10 },
  provNombre: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.navy },
  provMeta: { fontSize: 7.6, color: C.gris, marginTop: 2 },
  provMonto: { fontSize: 10, fontFamily: 'Courier', textAlign: 'right', color: C.navy },
  pfOc: { width: '26%', fontFamily: 'Helvetica-Bold' },
  pfFact: { width: '28%' },
  pfFecha: { width: '24%' },
  pfTotal: { width: '22%', textAlign: 'right', fontFamily: 'Courier' },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.linea,
    alignItems: 'center',
  },
  totalEtq: { fontSize: 8, color: C.gris, textTransform: 'uppercase', letterSpacing: 0.4 },
  totalVal: { fontSize: 10, fontFamily: 'Courier', color: C.navy },
  resumen: {
    marginTop: 6,
    borderRadius: 5,
    backgroundColor: C.fondoTotal,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2.5,
  },
  resumenEtq: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.navy },
  resumenVal: { fontSize: 11, fontFamily: 'Courier', color: C.navy },
  vacio: { fontSize: 7.8, color: C.gris, marginTop: 4 },
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
    <Document
      title={`Ficha ${d.codigo}`}
      author={EMPRESA.razonSocial}
      creator="Métrica · Sistema Operativo"
    >
      <Page size="A4" style={s.pagina}>
        {d.anulada && <SelloAnulado />}
        <EncabezadoPdf tipo="FICHA DE APERTURA" codigo={d.codigo} fecha={hoy} />

        <Text style={s.seccion}>Cliente</Text>
        <View style={s.rejilla}>
          <Dato k="Cliente" v={d.cliente.nombre} />
          <Dato k="Razón social" v={d.cliente.razonSocial || '—'} />
          <Dato k="RUC" v={d.cliente.ruc || '—'} />
          <Dato k="Política de pago" v={d.cliente.politicaPago || '—'} />
          <Dato k="Contacto de aprobación" v={d.cliente.contacto || '—'} />
          <Dato k="Correo del contacto" v={d.cliente.correo || '—'} />
        </View>

        <Text style={s.seccion}>Servicio</Text>
        <View style={s.rejilla}>
          <Dato k="Inicio de acciones" v={fechaLarga(d.servicio.inicio)} />
          <Dato k="Fin de acciones" v={fechaLarga(d.servicio.fin)} />
          <Dato
            k="Moneda general"
            v={d.servicio.moneda === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}
          />
          <Dato k="Facturar antes del fin" v={d.servicio.facturarAntes ? 'Sí' : 'No'} />
          {d.servicio.observaciones ? (
            <View style={{ width: '100%', marginBottom: 6 }}>
              <Text style={s.datoK}>Observaciones</Text>
              <Text style={[s.datoV, { fontFamily: 'Helvetica' }]}>
                {d.servicio.observaciones}
              </Text>
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
                <Text style={[s.cab, s.fcFee]}>Fee</Text>
              </View>
              {d.facturasCliente.map((fc, i) => (
                <View key={i} style={s.fila} wrap={false}>
                  <Text style={[s.celda, s.fcFact]}>{fc.numFactura || '—'}</Text>
                  <Text style={[s.celda, s.fcOc]}>{fc.oc || '—'}</Text>
                  <Text style={[s.celda, s.fcHes]}>{fc.hes || '—'}</Text>
                  <Text style={[s.celda, s.fcFecha]}>{fechaLarga(fc.fechaEmision)}</Text>
                  <Text style={[s.celda, s.fcTotal]}>
                    {montoOpt(fc.total, d.servicio.moneda)}
                  </Text>
                  <Text style={[s.celda, s.fcFee]}>
                    {montoOpt(fc.fee, d.servicio.moneda)}
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
            {d.facturasCliente.some((fc) => fc.fee != null) && (
              <View style={[s.totalFila, { marginTop: 2, paddingTop: 2, borderTopWidth: 0 }]}>
                <Text style={s.totalEtq}>Total fee</Text>
                <Text style={s.totalVal}>
                  {formatearMonto(
                    d.facturasCliente.reduce((a, fc) => a + (fc.fee ?? 0), 0),
                    d.servicio.moneda,
                  )}
                </Text>
              </View>
            )}
          </>
        )}

        <Text style={s.seccion}>Proveedores que cobran</Text>
        {d.proveedores.map((p) => {
          const nombre = [p.agencia, p.influencer].filter(Boolean).join(' · ') || '—';
          const banco =
            [
              p.banco,
              p.cuenta ? `Cta. ${p.cuenta}` : '',
              p.cci ? `CCI ${p.cci}` : '',
            ]
              .filter(Boolean)
              .join(' · ') || '—';
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
                  <Text style={[s.datoK, { textAlign: 'right' }]}>Monto</Text>
                  <Text style={s.provMonto}>
                    {formatearMonto(p.monto, d.servicio.moneda)}
                  </Text>
                </View>
              </View>

              {p.facturas.length === 0 ? (
                <Text style={s.vacio}>Sin facturas de seguimiento.</Text>
              ) : (
                <>
                  <View style={[s.tabla, { marginTop: 7 }]}>
                    <View style={s.filaCab}>
                      <Text style={[s.cab, s.pfOc]}>N° OC</Text>
                      <Text style={[s.cab, s.pfFact]}>N° factura</Text>
                      <Text style={[s.cab, s.pfFecha]}>Emisión</Text>
                      <Text style={[s.cab, s.pfTotal]}>Total</Text>
                    </View>
                    {p.facturas.map((fp, j) => (
                      <View key={j} style={s.fila} wrap={false}>
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
              <Text style={[s.resumenEtq, { color: C.gris }]}>
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

export async function generarPdfFicha(d: DatosPdfFicha): Promise<Buffer> {
  return await renderToBuffer(<Documento d={d} />);
}
