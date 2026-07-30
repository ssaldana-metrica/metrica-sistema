-- ============================================================================
-- Migración 0025 · Sinónimos por término
--
-- Al leer normas reales de El Peruano apareció un problema que la lista de
-- términos no podía resolver: el diario NO usa siglas para las entidades.
--
-- Una resolución de OSINERGMIN llega así:
--
--   distributor: "ORGANISMO SUPERVISOR DE LA INVERSIÓN EN ENERGÍA Y MINERÍA"
--   sumilla:     "…Bandas de Precios … aplicables al Diésel B5 …"
--
-- La palabra "OSINERGMIN" no aparece en ninguna parte. Con los términos tal
-- como estaban, esa norma solo se pescaba de casualidad, por "diésel". Una
-- resolución del mismo regulador sobre tarifas eléctricas que no repitiera
-- ninguna palabra clave se perdía entera — y las dos cuentas son de energía,
-- donde el regulador ES el criterio principal.
--
-- La solución es que cada término pueda tener otras formas de escribirse. Se
-- guardan como arreglo en el propio término y no como filas aparte para que
-- la pantalla siga mostrando UNA línea por concepto: quien administra piensa
-- en "OSINERGMIN", no en sus cuatro maneras de aparecer.
--
-- Al detectar, se reporta SIEMPRE el término principal, no el sinónimo que
-- coincidió: en el correo debe leerse "OSINERGMIN" aunque el texto dijera
-- "Organismo Supervisor de la Inversión en Energía y Minería".
-- ============================================================================

alter table normas_legales_terminos
  add column sinonimos text[] not null default '{}';

-- ── Siglas de entidades: la razón de ser de esta migración ──────────────────
-- Van a las DOS cuentas donde exista el término, porque MINEM y OSINERGMIN
-- están a propósito en ambas listas.

update normas_legales_terminos set sinonimos = array[
  'MINISTERIO DE ENERGÍA Y MINAS',
  'ENERGÍA Y MINAS'
] where lower(btrim(termino)) = 'minem';

update normas_legales_terminos set sinonimos = array[
  'ORGANISMO SUPERVISOR DE LA INVERSIÓN EN ENERGÍA Y MINERÍA',
  'ORGANISMO SUPERVISOR DE LA INVERSION EN ENERGIA Y MINERIA'
] where lower(btrim(termino)) = 'osinergmin';

update normas_legales_terminos set sinonimos = array[
  'ORGANISMO DE EVALUACIÓN Y FISCALIZACIÓN AMBIENTAL'
] where lower(btrim(termino)) = 'oefa';

update normas_legales_terminos set sinonimos = array[
  'COMITÉ DE OPERACIÓN ECONÓMICA DEL SISTEMA',
  'COMITÉ DE OPERACIÓN ECONÓMICA DEL SISTEMA INTERCONECTADO NACIONAL'
] where lower(btrim(termino)) = 'coes';

-- ── Siglas técnicas que el diario suele escribir desplegadas ────────────────

update normas_legales_terminos set sinonimos = array[
  'gas licuado de petróleo'
] where lower(btrim(termino)) = 'glp';

update normas_legales_terminos set sinonimos = array[
  'gas natural vehicular'
] where lower(btrim(termino)) = 'gnv';

update normas_legales_terminos set sinonimos = array[
  'gas natural licuado'
] where lower(btrim(termino)) = 'gnl';

update normas_legales_terminos set sinonimos = array[
  'Transportadora de Gas del Perú'
] where lower(btrim(termino)) = 'tgp';

update normas_legales_terminos set sinonimos = array[
  'Fondo de Inclusión Social Energético',
  'FISE'
] where lower(btrim(termino)) = 'fondo inclusión social energético';

update normas_legales_terminos set sinonimos = array[
  'Fondo de Estabilización de Precios de los Combustibles',
  'FEPC'
] where lower(btrim(termino)) = 'fondo de estabilización';
