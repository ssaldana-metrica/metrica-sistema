-- ============================================================================
-- Migración 0023 · Automatizaciones: cuentas, modo prueba e historial
--
-- Corrige tres omisiones de la 0022:
--
--   1. No existía el concepto de CUENTA, que es el requisito central: el correo
--      debe llegar completo pero con cada norma etiquetada según a qué cliente
--      impacta ([KALLPA], [SPGL]). Sin cuentas no hay etiqueta.
--   2. No existía `modo_prueba`, y sin él la única forma de probar el monitor
--      era secuestrar el correo de todo el sistema.
--   3. Solo se guardaba la última corrida, no el historial.
--
-- Se puede reestructurar sin cuidado con los datos: `normas_legales_hallazgos`
-- y `normas_legales_terminos` están en cero filas (verificado).
--
-- ── Por qué las cuentas NO van en la tabla `clientes` ───────────────────────
-- `clientes` es la tabla de facturación de Cotizaciones: exige `razon_social` y
-- `ruc` NOT NULL porque de ahí salen las cotizaciones y las ODA. KALLPA y SPGL
-- son cuentas de monitoreo de prensa y hoy no están ahí ni tienen por qué
-- estar. Se les da tabla propia, con un `cliente_id` nullable por si algún día
-- una de ellas sí se vuelve cliente facturable; hoy queda en NULL.
--
-- ── Por qué una tabla puente para el etiquetado ─────────────────────────────
-- `hallazgos.termino_detectado` era un texto suelto: solo cabía UN término y
-- ninguna cuenta. Pero MINEM y OSINERGMIN están a propósito en las listas de
-- las dos cuentas, así que una norma que los mencione tiene que salir
-- etiquetada con AMBAS. Eso es una relación muchos-a-muchos y necesita su
-- propia tabla, con los términos que coincidieron guardados como arreglo.
-- ============================================================================

-- ── Cuentas monitoreadas ────────────────────────────────────────────────────
create table normas_legales_cuentas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  -- Enlace opcional con la tabla de facturación. Hoy NULL en ambas: son
  -- cuentas de monitoreo, no clientes con RUC.
  cliente_id uuid references clientes(id),
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index idx_cuentas_nombre on normas_legales_cuentas (lower(btrim(nombre)));

insert into normas_legales_cuentas (nombre) values ('KALLPA'), ('SPGL');

-- ── Términos: ahora pertenecen a una cuenta ─────────────────────────────────
-- El índice único de la 0022 era global sobre el término, lo que haría
-- imposible tener MINEM en KALLPA y en SPGL a la vez. Pasa a ser único POR
-- CUENTA: el mismo término puede repetirse entre cuentas, nunca dentro de una.
drop index idx_terminos_unico;

alter table normas_legales_terminos
  add column cuenta_id uuid not null references normas_legales_cuentas(id);

create unique index idx_terminos_unico_por_cuenta
  on normas_legales_terminos (cuenta_id, lower(btrim(termino)));

create index idx_terminos_cuenta on normas_legales_terminos (cuenta_id) where activo;

-- ── Destinatarios: ahora se pueden rutear por cuenta ────────────────────────
-- NULL = recibe todo (el correo completo, con las etiquetas de todas las
-- cuentas). Con valor = solo le llegan las normas de esa cuenta.
alter table normas_legales_destinatarios
  add column cuenta_id uuid references normas_legales_cuentas(id);

-- El índice anterior impedía que una misma persona estuviera suscrita a dos
-- cuentas por separado. Ahora la unicidad es por (correo, cuenta).
-- `nulls not distinct` es lo que evita registrar dos veces el mismo correo con
-- cuenta NULL: sin eso, Postgres trata cada NULL como distinto y colarían
-- duplicados de "recibe todo".
drop index idx_destinatarios_correo;
create unique index idx_destinatarios_correo_cuenta
  on normas_legales_destinatarios (lower(btrim(correo)), cuenta_id) nulls not distinct;

-- `nombre` era NOT NULL DEFAULT '': tres filas quedaron con cadena vacía, que
-- es lo peor de los dos mundos — ni es un nombre ni se puede distinguir de
-- "no lo sé". Pasa a nullable y las vacías se vuelven NULL.
alter table normas_legales_destinatarios alter column nombre drop default;
alter table normas_legales_destinatarios alter column nombre drop not null;
update normas_legales_destinatarios set nombre = null where btrim(nombre) = '';

-- El quinto destinatario que faltaba.
insert into normas_legales_destinatarios (correo) values ('edibos@metrica.pe');

-- ── Etiquetado de hallazgos por cuenta ──────────────────────────────────────
-- Fuera el texto suelto; entra la tabla puente.
alter table normas_legales_hallazgos drop column termino_detectado;

create table normas_legales_hallazgo_cuenta (
  id                 uuid primary key default gen_random_uuid(),
  hallazgo_id        uuid not null references normas_legales_hallazgos(id) on delete cascade,
  cuenta_id          uuid not null references normas_legales_cuentas(id),
  -- Todos los términos que coincidieron para esta cuenta, no solo el primero:
  -- sirve para explicar en el correo POR QUÉ se marcó esta norma.
  terminos_detectados text[] not null default '{}',
  created_at         timestamptz not null default now(),
  unique (hallazgo_id, cuenta_id)
);

-- `on delete cascade` arriba: los hallazgos se pueden borrar (son datos
-- copiados de una web pública, no documentos contables), y sus etiquetas no
-- deben quedar huérfanas ni bloquear el borrado.
create index idx_hallazgo_cuenta_cuenta on normas_legales_hallazgo_cuenta (cuenta_id);

-- ── Modo prueba ─────────────────────────────────────────────────────────────
-- Arranca en `true`. Mientras esté encendido, el aviso va SOLO a
-- ssaldana@metrica.pe, sin importar la lista de destinatarios.
--
-- Existe para no tener que usar CORREO_PRUEBAS, que es una variable global:
-- redirige TODOS los correos del sistema, incluidos los de cotizaciones,
-- aprobaciones y anulaciones que hoy corren en producción con datos reales.
-- Probar el monitor legal no puede costar secuestrar el correo de un sistema
-- que ya funciona.
alter table automatizaciones
  add column modo_prueba boolean not null default true;

-- ── Historial de ejecuciones ────────────────────────────────────────────────
-- Los campos `ultimo_*` de la 0022 se quedan como caché para pintar el índice
-- sin consultar el historial, pero solo guardan la última corrida. Con dos
-- corridas diarias y un lector que se romperá el día que El Peruano cambie su
-- web, hace falta poder responder "¿corrió a las 8?" y "¿desde cuándo falla?".
create table automatizacion_ejecuciones (
  id                  uuid primary key default gen_random_uuid(),
  -- La PK de `automatizaciones` es la clave de texto, no un uuid.
  automatizacion      text not null references automatizaciones(clave),
  inicio              timestamptz not null default now(),
  fin                 timestamptz,
  estado              text not null default 'ok',
  normas_encontradas  int not null default 0,   -- cuántas publicó El Peruano
  normas_relevantes   int not null default 0,   -- cuántas coincidieron con algún término
  error_detalle       text not null default '',
  created_at          timestamptz not null default now(),
  constraint ejecucion_estado_valido
    check (estado in ('ok', 'error', 'sin_novedades'))
);

-- La consulta natural de la pantalla: las últimas corridas de una tarea.
create index idx_ejecuciones_recientes
  on automatizacion_ejecuciones (automatizacion, inicio desc);

-- ── Seguridad a nivel de fila ───────────────────────────────────────────────
-- Mismo criterio que la 0022: solo gerencia desde el navegador. El proceso
-- automático escribe con la llave privilegiada (service_role), que salta RLS.
alter table normas_legales_cuentas          enable row level security;
alter table normas_legales_hallazgo_cuenta  enable row level security;
alter table automatizacion_ejecuciones      enable row level security;

create policy cuentas_ver on normas_legales_cuentas
  for select to authenticated using (fn_mi_rol() = 'gerencia');
create policy cuentas_crear on normas_legales_cuentas
  for insert to authenticated with check (fn_mi_rol() = 'gerencia');
create policy cuentas_editar on normas_legales_cuentas
  for update to authenticated using (fn_mi_rol() = 'gerencia')
  with check (fn_mi_rol() = 'gerencia');

-- Etiquetas e historial: solo lectura desde el navegador, los escribe el
-- proceso automático. Las etiquetas ni siquiera necesitan política de borrado:
-- se van solas con el hallazgo por el `on delete cascade`.
create policy hallazgo_cuenta_ver on normas_legales_hallazgo_cuenta
  for select to authenticated using (fn_mi_rol() = 'gerencia');

create policy ejecuciones_ver on automatizacion_ejecuciones
  for select to authenticated using (fn_mi_rol() = 'gerencia');

-- ── Semilla de términos ─────────────────────────────────────────────────────
-- MINEM y OSINERGMIN aparecen en las DOS listas a propósito: son los
-- reguladores que importan a ambas cuentas, y una norma que los mencione debe
-- salir etiquetada dos veces. No deduplicar.
--
-- La comparación con el texto de las normas se normaliza en el servidor
-- (sin tildes, sin distinguir mayúsculas), de modo que 'diésel', 'diesel' y
-- 'DIÉSEL' coinciden igual. Aquí se guardan tal como se escriben bien.

insert into normas_legales_terminos (cuenta_id, termino)
select c.id, t.termino
from normas_legales_cuentas c
cross join (values
  ('generación eléctrica'), ('mercado eléctrico'), ('sistema eléctrico'),
  ('centrales térmicas'), ('centrales hidroeléctricas'),
  ('generación termoeléctrica'), ('generación renovable'),
  ('seguridad energética'), ('gas natural'), ('transporte de gas natural'),
  ('distribución de gas natural'), ('Camisea'), ('TGP'),
  ('Transportadora de Gas del Perú'), ('Cálidda'), ('MINEM'), ('OSINERGMIN'),
  ('COES'), ('OEFA'), ('tarifas eléctricas'), ('precio de la energía'),
  ('precio spot'), ('usuarios regulados'), ('licitaciones eléctricas'),
  ('transmisión eléctrica'), ('distribución eléctrica'),
  ('plan de transmisión'), ('fiscalización ambiental'), ('emisiones'),
  ('cambio climático'), ('transición energética')
) as t(termino)
where c.nombre = 'KALLPA';

insert into normas_legales_terminos (cuenta_id, termino)
select c.id, t.termino
from normas_legales_cuentas c
cross join (values
  ('gas licuado de petróleo'), ('GLP'), ('gas doméstico'), ('balón de gas'),
  ('envasado de GLP'), ('comercialización de GLP'), ('distribución de GLP'),
  ('importación de GLP'), ('almacenamiento de GLP'),
  ('Fondo de Estabilización'),
  ('Fondo de Estabilización de Precios de los Combustibles'),
  ('Vale FISE'), ('Fondo inclusión social energético'), ('subsidio GLP'),
  ('masificación energética'), ('hidrocarburos'), ('combustibles'),
  ('GNV'), ('GNL'), ('diésel'), ('gasolina'), ('MINEM'), ('OSINERGMIN'),
  ('fiscalización de combustibles'), ('almacenamiento estratégico')
) as t(termino)
where c.nombre = 'SPGL';
