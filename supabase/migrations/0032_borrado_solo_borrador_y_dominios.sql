-- ============================================================================
-- Migración 0032 · Dos candados pedidos por gerencia
--
--   1. Una ODA de proveedores solo se puede BORRAR en estado 'borrador'.
--      Una vez emitida, la salida es Anular con motivo — la misma regla que
--      rige en todo el resto del sistema.
--
--   2. Los destinatarios del monitor de normas legales solo pueden ser correos
--      de los dominios de Métrica. Deja de depender de la disciplina de quien
--      administra y pasa a ser imposible.
-- ============================================================================

-- ── 1. Borrar solo en borrador ──────────────────────────────────────────────
--
-- La 0031 hizo que todo borrado quedara archivado, pero seguía permitiendo
-- borrar una orden emitida. Archivarla no es lo mismo que conservarla: una
-- orden que salió al proveedor debe seguir visible en la lista, con su estado
-- 'anulada' y su motivo, no escondida en una tabla de auditoría que nadie mira.
--
-- La comprobación va en un trigger y no solo en la acción del servidor porque
-- este es el tipo de regla que no debe depender de por dónde entre el borrado.
create or replace function trg_oda_prov_solo_borrador_se_borra()
returns trigger
language plpgsql set search_path = public as $$
begin
  if old.estado <> 'borrador' then
    raise exception
      'La orden % está en estado "%" y solo se puede borrar un borrador. Usa Anular para dejarla sin efecto conservando el registro.',
      old.codigo, old.estado;
  end if;
  return old;
end $$;

create trigger oda_prov_solo_borrador_se_borra
  before delete on ordenes_proveedores
  for each row execute function trg_oda_prov_solo_borrador_se_borra();

-- Nota sobre el orden de los triggers: Postgres los dispara por nombre
-- alfabético, así que `archivar_oda_prov_borrada` corre antes que este. No
-- importa — si este lanza la excepción, toda la transacción se revierte y el
-- archivo tampoco queda escrito. El resultado es el correcto en ambos casos.

-- ── 2. Destinatarios solo de dominios Métrica ───────────────────────────────
--
-- ⚠️ Esta lista DEBE coincidir con DOMINIOS_PERMITIDOS en src/config/dominios.ts,
-- que es la que decide quién puede iniciar sesión. Están duplicadas a propósito:
-- una restricción que vive solo en TypeScript se salta escribiendo directo en la
-- base, y el punto de este cambio es justamente que no se pueda.
--
-- Si algún día se agrega un dominio del grupo, hay que tocar los dos sitios.
alter table normas_legales_destinatarios
  add constraint destinatario_dominio_metrica
  check (
    split_part(lower(btrim(correo)), '@', 2) in ('metrica.pe', 'metricaperu.com')
  );
