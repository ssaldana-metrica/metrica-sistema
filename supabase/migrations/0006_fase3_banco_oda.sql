-- ============================================================================
-- MÉTRICA · Sistema Operativo — Fase 3: Orden de Adquisición (ODA)
-- Migración 0006 · Bloque 1: banco de códigos ODA, independiente del de
-- cotizaciones, con el MISMO patrón atómico de la Fase 1 (FOR UPDATE SKIP
-- LOCKED). Reúsa enums estado_codigo, los triggers trg_no_borrar y
-- trg_codigo_anulado_es_final, y la identidad fn_correo_actual/fn_mi_rol.
-- ============================================================================

-- Estado del documento ODA (se usará en el Bloque 2).
create type estado_oda as enum ('borrador', 'emitida', 'anulada');

-- ── Banco de códigos ODA ─────────────────────────────────────────────────────
create table banco_codigos_oda (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- ODA-AAAA-NNNN
  anio       int  not null,
  numero     int  not null,                 -- correlativo anual continuo
  estado     estado_codigo not null default 'disponible',
  tomado_por uuid references usuarios(id),
  tomado_en  timestamptz,
  created_at timestamptz not null default now(),
  unique (anio, numero)
);

create index idx_banco_oda_estado on banco_codigos_oda (anio, estado, numero);

-- Trazabilidad: no se borra; un código anulado nunca vuelve a usarse.
create trigger no_borrar_banco_oda before delete on banco_codigos_oda
  for each row execute function trg_no_borrar();
create trigger codigo_oda_anulado_es_final before update on banco_codigos_oda
  for each row execute function trg_codigo_anulado_es_final();

-- ── Generación de códigos (idempotente) ─────────────────────────────────────
-- Crea ODA-AAAA-DESDE … ODA-AAAA-HASTA. Solo el servidor la llama.
create or replace function generar_codigos_oda(p_anio int, p_desde int, p_hasta int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_creados int;
begin
  insert into banco_codigos_oda (codigo, anio, numero)
  select format('ODA-%s-%s', p_anio, lpad(n::text, 4, '0')), p_anio, n
  from generate_series(p_desde, p_hasta) as n
  on conflict (anio, numero) do nothing;
  get diagnostics v_creados = row_count;
  return v_creados;
end $$;

-- ── ★ Asignación atómica del siguiente código ODA ★ ─────────────────────────
-- Mismo blindaje que tomar_codigo() de Fase 1: FOR UPDATE SKIP LOCKED, el
-- usuario se deriva de la sesión, y solo administración (admin/gerencia) puede
-- tomar un código (el ejecutivo no genera órdenes).
create or replace function tomar_codigo_oda()
returns banco_codigos_oda
language plpgsql security definer set search_path = public as $$
declare
  v_usuario usuarios;
  v_codigo  banco_codigos_oda;
begin
  select * into v_usuario from usuarios
   where correo = fn_correo_actual() and activo;
  if v_usuario is null then
    raise exception 'Usuario no autorizado o inactivo';
  end if;
  if v_usuario.rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede generar órdenes de adquisición';
  end if;

  select * into v_codigo
    from banco_codigos_oda
   where estado = 'disponible'
     and anio = extract(year from now())::int
   order by numero
   limit 1
   for update skip locked;

  if v_codigo is null then
    raise exception 'No hay códigos ODA disponibles para el año %. Pida a administración generar más.',
      extract(year from now())::int;
  end if;

  update banco_codigos_oda
     set estado = 'en_uso', tomado_por = v_usuario.id, tomado_en = now()
   where id = v_codigo.id
   returning * into v_codigo;

  return v_codigo;
end $$;

revoke execute on function tomar_codigo_oda()                 from public, anon;
revoke execute on function generar_codigos_oda(int, int, int) from public, anon, authenticated;
grant  execute on function tomar_codigo_oda()                 to authenticated, service_role;
grant  execute on function generar_codigos_oda(int, int, int) to service_role;

-- ── RLS: el banco ODA solo lo lee administración ────────────────────────────
alter table banco_codigos_oda enable row level security;
create policy banco_oda_ver on banco_codigos_oda
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));

-- ── Seed: ODA-2026-1001 … ODA-2026-1050 disponibles ─────────────────────────
select generar_codigos_oda(2026, 1001, 1050);
