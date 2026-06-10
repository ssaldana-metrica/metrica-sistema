-- ============================================================================
-- Migración 0002: endurecimiento de seguridad (recomendaciones del linter
-- de Supabase): search_path fijo en todas las funciones y sin ejecución
-- para visitantes no logueados (anon).
-- ============================================================================

alter function trg_no_borrar()               set search_path = public;
alter function trg_codigo_anulado_es_final() set search_path = public;
alter function trg_touch_updated_at()        set search_path = public;
alter function fn_correo_actual()            set search_path = public;

revoke execute on function fn_correo_actual() from public, anon;
revoke execute on function fn_mi_id()         from public, anon;
revoke execute on function fn_mi_rol()        from public, anon;

-- authenticated las necesita: las políticas RLS se evalúan con sus permisos
grant execute on function fn_correo_actual() to authenticated, service_role;
grant execute on function fn_mi_id()         to authenticated, service_role;
grant execute on function fn_mi_rol()        to authenticated, service_role;
