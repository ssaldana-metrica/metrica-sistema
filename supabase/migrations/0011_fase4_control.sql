-- ============================================================================
-- Fase 4 · Bloque 1 (parte 2): columnas de anulación en la ficha, tabla
-- control_proceso (campos editables de administración, uno por proveedor) y la
-- función ATÓMICA de anulación en cascada.
-- ============================================================================

-- Traza de anulación en la ficha (las cotizaciones y ODA ya la tenían).
alter table fichas_apertura
  add column anulada_por      uuid references usuarios(id),
  add column fecha_anulacion  timestamptz,
  add column motivo_anulacion text;

-- ── Tabla de control (zona derecha, por proveedor) ──────────────────────────
-- Solo guarda lo que no vive en otra tabla. El N° ODA se lee de
-- ordenes_adquisicion, no aquí. Una fila por proveedor de ficha.
create table control_proceso (
  id                 uuid primary key default gen_random_uuid(),
  ficha_id           uuid not null references fichas_apertura(id),
  ficha_proveedor_id uuid not null unique references ficha_proveedores(id),
  n_contrato         text not null default '',
  factura_proveedor  text not null default '',
  oc_os_cliente      text not null default '',
  factura_cliente    text not null default '',
  fecha_facturacion  date,           -- informativa, sin cálculo de brecha
  fecha_cobro        date,           -- informativa, sin cálculo de brecha
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_control_ficha on control_proceso (ficha_id);

create trigger no_borrar_control before delete on control_proceso
  for each row execute function trg_no_borrar();
create trigger control_touch before update on control_proceso
  for each row execute function trg_touch_updated_at();

alter table control_proceso enable row level security;

create policy control_ver on control_proceso
  for select to authenticated using (fn_mi_rol() in ('admin', 'gerencia'));
create policy control_crear on control_proceso
  for insert to authenticated with check (fn_mi_rol() in ('admin', 'gerencia'));
create policy control_editar on control_proceso
  for update to authenticated using (fn_mi_rol() in ('admin', 'gerencia'))
  with check (fn_mi_rol() in ('admin', 'gerencia'));

-- ── ★ Anulación en cascada (ATÓMICA) ★ ──────────────────────────────────────
-- Una función SQL corre en UNA sola transacción: si algún paso falla, se
-- revierte TODO. Anula, en bloque, la cotización, su código COT, la ficha,
-- todas las ODA del proceso y sus códigos ODA. Reusa exactamente el patrón de
-- las anulaciones individuales (cambio de estado + traza; código anulado final
-- gracias a los triggers existentes). Nada se borra.
create or replace function anular_proceso(p_ficha_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_yo           uuid;
  v_rol          rol_usuario;
  v_cot_id       uuid;
  v_cot_codigo   text;
  v_estado_ficha estado_ficha;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
begin
  -- Autorización: solo administración.
  v_yo  := fn_mi_id();
  v_rol := fn_mi_rol();
  if v_yo is null or v_rol not in ('admin', 'gerencia') then
    raise exception 'Solo administración puede anular procesos';
  end if;
  if v_motivo = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  -- Ficha + su cotización de origen.
  select f.estado, f.cotizacion_id, c.codigo
    into v_estado_ficha, v_cot_id, v_cot_codigo
  from fichas_apertura f
  join cotizaciones c on c.id = f.cotizacion_id
  where f.id = p_ficha_id;
  if not found then
    raise exception 'No se encontró el proceso';
  end if;
  if v_estado_ficha = 'anulada' then
    raise exception 'Este proceso ya está anulado';
  end if;

  -- 1) Cotización (COT)
  update cotizaciones
     set estado = 'anulada', anulada_por = v_yo, motivo_anulacion = v_motivo
   where id = v_cot_id;
  -- 2) Código COT → anulado (nunca se reutiliza; lo garantiza el trigger)
  update banco_codigos set estado = 'anulado' where codigo = v_cot_codigo;

  -- 3) Ficha de apertura (FA-COT)
  update fichas_apertura
     set estado = 'anulada', anulada_por = v_yo,
         fecha_anulacion = now(), motivo_anulacion = v_motivo
   where id = p_ficha_id;

  -- 4) Todas las ODA del proceso (las que aún no estén anuladas)
  update ordenes_adquisicion
     set estado = 'anulada', anulada_por = v_yo, motivo_anulacion = v_motivo
   where ficha_id = p_ficha_id and estado <> 'anulada';
  -- 5) Sus códigos ODA → anulado
  update banco_codigos_oda
     set estado = 'anulado'
   where codigo in (select codigo from ordenes_adquisicion where ficha_id = p_ficha_id);
end $$;

revoke execute on function anular_proceso(uuid, text) from public, anon;
grant  execute on function anular_proceso(uuid, text) to authenticated, service_role;
