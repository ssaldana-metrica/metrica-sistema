-- ============================================================================
-- Migración 0022 · Automatizaciones (primera: monitor de normas legales)
--
-- Espacio nuevo, INDEPENDIENTE de Cotizaciones. Cuatro tablas:
--
--   automatizaciones               → el interruptor y la bitácora de cada tarea
--   normas_legales_terminos        → qué palabras vigilar en El Peruano
--   normas_legales_destinatarios   → a quién le llega el aviso
--   normas_legales_hallazgos       → qué se encontró (y si ya se avisó)
--
-- ── Decisión de diseño: los destinatarios NO son usuarios ───────────────────
-- `normas_legales_destinatarios.correo` es texto libre, SIN llave foránea a
-- `usuarios`, a propósito. Recibir un correo y tener cuenta en el sistema son
-- cosas distintas: de los destinatarios iniciales, casi ninguno tiene (ni
-- necesita) cuenta — a nadie hay que darlo de alta para que le llegue un
-- aviso. Esto además mantiene la lista aislada de Cotizaciones: dar de baja a
-- alguien allá no lo saca de aquí, ni al revés.
--
-- Ojo: `echavez@metrica.pe` (destinatario) y `achavez@metrica.pe` (usuaria
-- Almendra Chávez) son DOS personas distintas, confirmado por gerencia. No son
-- un error de tipeo y no deben unificarse.
--
-- ── Decisión de diseño: quién opera ─────────────────────────────────────────
-- Solo gerencia lee y escribe estas tablas. Hoy eso es exactamente una persona
-- (ssaldana@metrica.pe, único rol 'gerencia'), que es lo pedido: uno solo
-- administra, los demás únicamente reciben correos. Se usa el rol y no el
-- correo escrito a mano para no tener que migrar la base el día que eso cambie.
--
-- ── Decisión de diseño: aquí SÍ se puede borrar ─────────────────────────────
-- Estas tablas NO llevan trg_no_borrar, a diferencia de cotizaciones, fichas y
-- ODA. La regla de "anule, no borre" protege documentos de negocio con valor
-- contable y de auditoría. Esto es otra cosa: configuración operativa y datos
-- copiados de una web pública. Un destinatario mal escrito debe poder
-- corregirse, y los hallazgos viejos deben poder limpiarse sin pelear con un
-- trigger. Para el uso diario igual existe `activo`, que es lo que usa la
-- pantalla; borrar queda para arreglar errores.
-- ============================================================================

-- ── Interruptor y bitácora de cada automatización ───────────────────────────
-- La clave es texto y no un enum: sumar una automatización nueva debe ser
-- insertar una fila, no alterar un tipo.
create table automatizaciones (
  clave             text primary key,
  nombre            text not null,
  descripcion       text not null default '',
  activa            boolean not null default false,
  -- Bitácora de la última ejecución, para que la pantalla pueda responder
  -- "¿esto está corriendo?" sin hacer arqueología en los logs de Vercel.
  ultima_corrida_en timestamptz,
  ultimo_estado     text,               -- 'ok' | 'error' | 'sin_novedad'
  ultimo_detalle    text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Qué vigilar ─────────────────────────────────────────────────────────────
-- Sin términos, el monitor no filtra nada y el correo diario sería el diario
-- oficial completo — inservible. Cada fila es una palabra o frase a buscar;
-- la comparación se hace sin distinguir mayúsculas ni tildes.
create table normas_legales_terminos (
  id         uuid primary key default gen_random_uuid(),
  termino    text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un mismo término no se registra dos veces, escríbase como se escriba.
create unique index idx_terminos_unico on normas_legales_terminos (lower(btrim(termino)));

-- ── A quién avisar ──────────────────────────────────────────────────────────
create table normas_legales_destinatarios (
  id         uuid primary key default gen_random_uuid(),
  correo     text not null,
  nombre     text not null default '',
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Validación mínima: que parezca un correo. No se restringe el dominio
  -- porque nada impide que mañana haya que avisarle a alguien de fuera.
  constraint destinatario_correo_valido check (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- Sin duplicados aunque se escriba con mayúsculas distintas.
create unique index idx_destinatarios_correo on normas_legales_destinatarios (lower(btrim(correo)));

-- ── Qué se encontró ─────────────────────────────────────────────────────────
-- `hash_dedupe` es la defensa contra avisar dos veces de la misma norma: se
-- calcula en el servidor a partir de los datos estables de la publicación y
-- lleva índice único. Si la corrida de la tarde vuelve a ver una norma de la
-- mañana, el insert choca contra el índice y simplemente no se reenvía.
create table normas_legales_hallazgos (
  id                 uuid primary key default gen_random_uuid(),
  hash_dedupe        text not null unique,
  tipo               text not null default '',   -- 'Decreto Supremo', 'Resolución Ministerial', …
  numero             text not null default '',
  titulo             text not null,
  entidad            text not null default '',
  fecha_publicacion  date,
  url                text not null default '',
  resumen            text not null default '',
  termino_detectado  text not null default '',   -- cuál de los términos lo pescó
  -- Nulo = encontrado pero todavía no avisado. Lo llena el envío del correo,
  -- así un fallo de Resend no deja el hallazgo marcado como notificado.
  notificado_en      timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_hallazgos_fecha       on normas_legales_hallazgos (fecha_publicacion desc);
create index idx_hallazgos_pendientes  on normas_legales_hallazgos (created_at) where notificado_en is null;

-- ── Fechas de modificación al día ───────────────────────────────────────────
create trigger automatizaciones_touch before update on automatizaciones
  for each row execute function trg_touch_updated_at();
create trigger destinatarios_touch before update on normas_legales_destinatarios
  for each row execute function trg_touch_updated_at();

-- ── Seguridad a nivel de fila ───────────────────────────────────────────────
-- Solo gerencia, y para todo: ver, crear, editar y borrar. El resto de la
-- empresa no toca estas tablas desde el navegador; el proceso automático que
-- inserta hallazgos y envía correos corre con la llave privilegiada
-- (service_role), que salta RLS y por eso no necesita política propia.
alter table automatizaciones              enable row level security;
alter table normas_legales_terminos       enable row level security;
alter table normas_legales_destinatarios  enable row level security;
alter table normas_legales_hallazgos      enable row level security;

create policy automatizaciones_ver on automatizaciones
  for select to authenticated using (fn_mi_rol() = 'gerencia');
create policy automatizaciones_editar on automatizaciones
  for update to authenticated using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');

create policy terminos_ver on normas_legales_terminos
  for select to authenticated using (fn_mi_rol() = 'gerencia');
create policy terminos_crear on normas_legales_terminos
  for insert to authenticated with check (fn_mi_rol() = 'gerencia');
create policy terminos_editar on normas_legales_terminos
  for update to authenticated using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');
create policy terminos_borrar on normas_legales_terminos
  for delete to authenticated using (fn_mi_rol() = 'gerencia');

create policy destinatarios_ver on normas_legales_destinatarios
  for select to authenticated using (fn_mi_rol() = 'gerencia');
create policy destinatarios_crear on normas_legales_destinatarios
  for insert to authenticated with check (fn_mi_rol() = 'gerencia');
create policy destinatarios_editar on normas_legales_destinatarios
  for update to authenticated using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');
create policy destinatarios_borrar on normas_legales_destinatarios
  for delete to authenticated using (fn_mi_rol() = 'gerencia');

-- Los hallazgos son solo de lectura desde el navegador: los escribe el proceso
-- automático. Se permite borrar para poder limpiar el historial.
create policy hallazgos_ver on normas_legales_hallazgos
  for select to authenticated using (fn_mi_rol() = 'gerencia');
create policy hallazgos_borrar on normas_legales_hallazgos
  for delete to authenticated using (fn_mi_rol() = 'gerencia');

-- ── Semilla ─────────────────────────────────────────────────────────────────

-- La automatización nace APAGADA a propósito: primero se confirma que la
-- lectura de El Peruano funciona desde el servidor, recién entonces se prende.
insert into automatizaciones (clave, nombre, descripcion, activa) values (
  'normas_legales',
  'Monitor de normas legales',
  'Revisa El Peruano dos veces al día y avisa por correo cuando aparece una norma que coincide con los términos vigilados.',
  false
);

-- Destinatarios iniciales confirmados. Solo el primero tiene cuenta en el
-- sistema; los demás no la tienen ni la necesitan, aquí basta su correo.
--
-- El campo `nombre` va vacío salvo donde se conoce con certeza: es solo una
-- etiqueta para la pantalla, y es preferible mostrar el correo a mostrar un
-- nombre inventado. Se completa desde la pantalla cuando se sepan.
insert into normas_legales_destinatarios (correo, nombre) values
  ('ssaldana@metrica.pe',             'Sergio Saldaña Guardia'),
  ('mjcamino@metrica.pe',             ''),
  ('echavez@metrica.pe',              ''),
  ('pcaterianollosa@metricaperu.com', '');
