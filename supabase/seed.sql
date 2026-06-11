-- ============================================================================
-- MÉTRICA · Fase 1 — Datos de prueba
-- Usuarios, clientes, proveedores, banco COT-2026-0001…0050 y cotizaciones
-- de ejemplo en distintos estados para probar el flujo completo.
-- ============================================================================

-- ── Usuarios ────────────────────────────────────────────────────────────────
insert into usuarios (nombre, correo, rol) values
  ('Erico Ramírez',    'erico.ramirez@metrica.pe',    'ejecutivo'),
  ('Luis Mendoza',     'luis.mendoza@metrica.pe',     'ejecutivo'),
  ('Vanessa Torres',   'vanessa.torres@metrica.pe',   'ejecutivo'),
  ('Angela Rodríguez', 'angela.rodriguez@metrica.pe', 'admin'),
  ('Erika Pomacaja',   'erika.pomacaja@metrica.pe',   'admin'),
  ('Ariana Torres',    'ariana.torres@metrica.pe',    'gerencia'),
  -- Cuentas reales de los propietarios del sistema, con rol gerencia
  -- (ven y operan TODO el flujo: ejecutivo + aprobaciones + usuarios).
  ('Métrica IA',             'metrica.ia@metrica.pe', 'gerencia'),
  ('Sergio Saldaña Guardia', 'ssaldana@metrica.pe',   'gerencia')
on conflict (correo) do nothing;

-- ── Clientes ────────────────────────────────────────────────────────────────
insert into clientes (nombre_comercial, razon_social, ruc) values
  ('KIA Motors',      'KIA Import Perú S.A.C.',              '20501234567'),
  ('H&M Perú',        'H & M Hennes & Mauritz S.A.C.',       '20543219876'),
  ('CAASA',           'Corporación CAASA S.A.',              '20100123456'),
  ('Interbank',       'Banco Internacional del Perú S.A.A.', '20100053455'),
  ('Banco Falabella', 'Banco Falabella Perú S.A.',           '20330401991');

-- ── Proveedores ─────────────────────────────────────────────────────────────
insert into proveedores (nombre_comercial, razon_social, ruc, tipo) values
  ('JMA Influencers Connect', 'JMA Connect E.I.R.L.',  '20612345678', 'empresa'),
  ('Productora Lima Films',   'Lima Films S.A.C.',     '20698765432', 'empresa'),
  ('Foto Estudio Norte',      'Estudio Norte S.A.C.',  '20587654321', 'empresa'),
  ('Plaza Eventos',           'Plaza Eventos S.R.L.',  '20554433221', 'empresa'),
  ('Carla Quispe — Fotógrafa','Carla Quispe Mamani',   '10456789012', 'persona_natural');

-- ── Banco de códigos: COT-2026-0001 … COT-2026-0050 ─────────────────────────
select generar_codigos(2026, 50);

-- ── Cotizaciones de ejemplo ─────────────────────────────────────────────────
do $$
declare
  u_erico   uuid; u_luis  uuid; u_vanessa uuid; u_angela uuid; u_erika uuid;
  c_kia     uuid; c_hm    uuid; c_caasa   uuid; c_inter  uuid; c_fala  uuid;
  q         uuid;
begin
  select id into u_erico   from usuarios where correo = 'erico.ramirez@metrica.pe';
  select id into u_luis    from usuarios where correo = 'luis.mendoza@metrica.pe';
  select id into u_vanessa from usuarios where correo = 'vanessa.torres@metrica.pe';
  select id into u_angela  from usuarios where correo = 'angela.rodriguez@metrica.pe';
  select id into u_erika   from usuarios where correo = 'erika.pomacaja@metrica.pe';

  select id into c_kia   from clientes where nombre_comercial = 'KIA Motors';
  select id into c_hm    from clientes where nombre_comercial = 'H&M Perú';
  select id into c_caasa from clientes where nombre_comercial = 'CAASA';
  select id into c_inter from clientes where nombre_comercial = 'Interbank';
  select id into c_fala  from clientes where nombre_comercial = 'Banco Falabella';

  -- Los códigos usados por estas cotizaciones salen del banco
  update banco_codigos set estado = 'en_uso', tomado_por = u_erico,   tomado_en = now() - interval '12 days' where codigo = 'COT-2026-0001';
  update banco_codigos set estado = 'en_uso', tomado_por = u_luis,    tomado_en = now() - interval '4 days'  where codigo = 'COT-2026-0002';
  update banco_codigos set estado = 'en_uso', tomado_por = u_vanessa, tomado_en = now() - interval '2 days'  where codigo = 'COT-2026-0003';
  update banco_codigos set estado = 'en_uso', tomado_por = u_erico,   tomado_en = now() - interval '1 day'   where codigo = 'COT-2026-0004';
  update banco_codigos set estado = 'en_uso', tomado_por = u_erico,   tomado_en = now() - interval '8 days'  where codigo = 'COT-2026-0005';

  -- 1) APROBADA · KIA · Erico
  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda, fee_porcentaje,
                            fecha_envio_cliente, estado, aprobada_por, fecha_aprobacion)
  values ('COT-2026-0001', c_kia, u_erico, 'Lanzamiento Sportage 2026', 'PEN', 12,
          current_date - 10, 'aprobada', u_angela, now() - interval '10 days')
  returning id into q;
  insert into cotizacion_items (cotizacion_id, orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal) values
    (q, 1, 'Plaza Eventos',         'Activación BTL punto de venta', 2, 9500.00, 19000.00),
    (q, 2, 'Productora Lima Films', 'Video lanzamiento 60s',         1, 12800.00, 12800.00),
    (q, 3, 'Foto Estudio Norte',    'Sesión fotográfica vehículos',  1, 4200.00, 4200.00);

  -- 2) PENDIENTE · H&M · Luis (para probar la cola de aprobación)
  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda, fee_porcentaje,
                            fecha_envio_cliente, estado)
  values ('COT-2026-0002', c_hm, u_luis, 'Campaña influencers Q2', 'USD', 12,
          current_date + 3, 'pendiente')
  returning id into q;
  insert into cotizacion_items (cotizacion_id, orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal) values
    (q, 1, 'JMA Influencers Connect', '3 reels @conan.style',      1, 3200.00, 3200.00),
    (q, 2, 'Productora Lima Films',   'Edición y post-producción', 1, 2100.00, 2100.00),
    (q, 3, 'Foto Estudio Norte',      'Sesión producto',           1, 1800.00, 1800.00);

  -- 3) PENDIENTE · CAASA · Vanessa (segunda en la cola)
  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda, fee_porcentaje,
                            fecha_envio_cliente, estado)
  values ('COT-2026-0003', c_caasa, u_vanessa, 'Activación BTL Plaza Norte', 'PEN', 10,
          current_date + 5, 'pendiente')
  returning id into q;
  insert into cotizacion_items (cotizacion_id, orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal) values
    (q, 1, 'Plaza Eventos',              'Montaje y permisos Plaza Norte', 1, 11000.00, 11000.00),
    (q, 2, 'Carla Quispe — Fotógrafa',   'Cobertura fotográfica evento',   2, 1600.00,  3200.00);

  -- 4) BORRADOR · Interbank · Erico (aún no enviada a aprobación)
  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda, fee_porcentaje, estado)
  values ('COT-2026-0004', c_inter, u_erico, 'Cobertura evento corporativo', 'PEN', 12, 'borrador')
  returning id into q;
  insert into cotizacion_items (cotizacion_id, orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal) values
    (q, 1, 'Productora Lima Films', 'Cobertura audiovisual evento', 1, 7800.00, 7800.00);

  -- 5) ANULADA · Banco Falabella · Erico — anulada por Erika; su código
  --    queda anulado para siempre.
  insert into cotizaciones (codigo, cliente_id, ejecutivo_id, proyecto, moneda, fee_porcentaje,
                            estado, anulada_por, motivo_anulacion)
  values ('COT-2026-0005', c_fala, u_erico, 'Cobertura evento', 'PEN', 12,
          'anulada', u_erika, 'El influencer no aprobó la propuesta')
  returning id into q;
  insert into cotizacion_items (cotizacion_id, orden, proveedor_nombre, descripcion, cantidad, precio_unitario, subtotal) values
    (q, 1, 'JMA Influencers Connect', 'Cobertura con influencer', 1, 9400.00, 9400.00);

  update banco_codigos set estado = 'anulado' where codigo = 'COT-2026-0005';
end $$;
