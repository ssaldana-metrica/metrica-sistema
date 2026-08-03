-- ============================================================================
-- Migración 0031 · Dejar rastro cuando se borra una ODA de proveedores
--
-- La 0028 quitó `trg_no_borrar` de `ordenes_proveedores` para permitir el botón
-- de Borrar que pidió gerencia. Al hacerlo abrió un hueco que no estaba
-- previsto: se podía borrar una orden EN CUALQUIER ESTADO —incluso emitida, con
-- su PDF ya enviado al proveedor— y no quedaba absolutamente nada. Ni el
-- código, ni el monto, ni quién la borró.
--
-- Es la única tabla del sistema donde eso era posible. En todas las demás rige
-- "anule, no borre", justamente para que ningún documento desaparezca sin
-- explicación.
--
-- ── Qué hace esta migración ─────────────────────────────────────────────────
-- No devuelve el candado —borrar sigue siendo posible, como se pidió— pero
-- ahora la orden se archiva antes de desaparecer: código, estado, montos, la
-- fila completa, sus líneas de detalle, y quién la borró y cuándo.
--
-- ── Por qué un trigger y no código en la aplicación ─────────────────────────
-- Un `await registrarBorrado()` antes del delete se puede olvidar al refactorizar,
-- y no cubre un borrado hecho desde el panel de Supabase o por un script. El
-- trigger se dispara SIEMPRE, venga el borrado de donde venga: es la diferencia
-- entre una convención y una garantía.
--
-- ── El archivo tampoco se puede borrar ──────────────────────────────────────
-- La tabla de registro lleva su propio `trg_no_borrar`. Un archivo de borrados
-- que se puede borrar no sirve de nada.
-- ============================================================================

create table ordenes_proveedores_borradas (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null,
  estado_al_borrar estado_oda not null,
  monto            numeric(14,2) not null default 0,
  moneda           moneda_tipo not null default 'PEN',
  razon_social     text not null default '',
  -- Nulo si el borrado no vino de una sesión de usuario (por ejemplo, un
  -- script con la llave de servicio). Que sea nulo también es información.
  borrada_por      uuid references usuarios(id),
  borrada_en       timestamptz not null default now(),
  -- La fila completa y sus líneas, tal como estaban. Se guardan como JSON para
  -- que el archivo no haya que migrarlo cada vez que cambie una columna de la
  -- tabla viva.
  orden            jsonb not null,
  detalles         jsonb not null default '[]'::jsonb
);

create index idx_oda_prov_borradas_codigo on ordenes_proveedores_borradas (codigo);
create index idx_oda_prov_borradas_fecha  on ordenes_proveedores_borradas (borrada_en desc);

-- El archivo de borrados no se borra.
create trigger no_borrar_registro_borrados
  before delete on ordenes_proveedores_borradas
  for each row execute function trg_no_borrar();

-- ── El registro automático ──────────────────────────────────────────────────
-- SECURITY DEFINER porque tiene que poder escribir en la tabla de archivo, que
-- no concede escritura a nadie.
create or replace function trg_archivar_oda_prov_borrada()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ordenes_proveedores_borradas (
    codigo, estado_al_borrar, monto, moneda, razon_social,
    borrada_por, orden, detalles
  )
  values (
    old.codigo,
    old.estado,
    old.monto,
    old.moneda,
    old.razon_social,
    fn_mi_id(),
    to_jsonb(old),
    coalesce(
      (select jsonb_agg(to_jsonb(d) order by d.posicion)
         from orden_proveedor_detalles d
        where d.orden_id = old.id),
      '[]'::jsonb
    )
  );
  return old;
end $$;

-- BEFORE DELETE: las líneas de detalle todavía existen en este momento (se van
-- después, por la cascada), así que alcanzan a copiarse al archivo.
create trigger archivar_oda_prov_borrada
  before delete on ordenes_proveedores
  for each row execute function trg_archivar_oda_prov_borrada();

-- ── Seguridad ───────────────────────────────────────────────────────────────
-- Mismo patrón que el resto: RLS activo, solo lectura para administración,
-- cero políticas de escritura. Solo el trigger escribe.
alter table ordenes_proveedores_borradas enable row level security;

create policy oda_prov_borradas_ver on ordenes_proveedores_borradas
  for select to authenticated
  using (fn_mi_rol() in ('admin', 'gerencia'));
