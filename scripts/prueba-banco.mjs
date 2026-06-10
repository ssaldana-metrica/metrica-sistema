// Prueba de integración del banco de códigos (se corre a mano, no en prod):
//   node scripts/prueba-banco.mjs
// 1. Crea dos usuarios de auth temporales (Erico y Luis, ya seedeados).
// 2. Dispara 6 tomas de código EN PARALELO entre ambos.
// 3. Verifica que los 6 códigos sean distintos (atomicidad).
// 4. Verifica el RLS: Erico solo ve sus cotizaciones; el banco completo sí.
// 5. Limpia: devuelve los códigos y borra los usuarios de auth temporales.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASS = 'Prueba-Temporal-9472!';
const CORREOS = ['erico.ramirez@metrica.pe', 'luis.mendoza@metrica.pe'];

let fallas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗ FALLA'} — ${msg}`);
  if (!cond) fallas++;
};

// 1. Usuarios de auth temporales
const authIds = [];
for (const correo of CORREOS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: PASS,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${correo}: ${error.message}`);
  authIds.push(data.user.id);
}

const sesion = async (correo) => {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email: correo, password: PASS });
  if (error) throw new Error(`login ${correo}: ${error.message}`);
  return c;
};
const erico = await sesion(CORREOS[0]);
const luis = await sesion(CORREOS[1]);

// 2. Seis tomas en paralelo, intercaladas entre los dos
const resultados = await Promise.all(
  [erico, luis, erico, luis, erico, luis].map((c) => c.rpc('tomar_codigo')),
);
const codigos = resultados.map((r) => r.data?.codigo).filter(Boolean);
const errores = resultados.filter((r) => r.error);
ok(errores.length === 0, `las 6 tomas en paralelo respondieron sin error`);
ok(
  new Set(codigos).size === 6,
  `los 6 códigos son DISTINTOS (atomicidad): ${codigos.join(', ')}`,
);

// 3. RLS: Erico solo ve sus cotizaciones (3 seedeadas), pero todo el banco
const { data: cotsErico } = await erico
  .from('cotizaciones')
  .select('codigo, ejecutivo:usuarios!cotizaciones_ejecutivo_id_fkey(correo)');
ok(
  (cotsErico ?? []).length === 3 &&
    cotsErico.every((c) => c.ejecutivo.correo === CORREOS[0]),
  `RLS: Erico ve exactamente sus 3 cotizaciones y ninguna ajena (vio ${cotsErico?.length})`,
);
const { count: bancoVisible } = await erico
  .from('banco_codigos')
  .select('id', { count: 'exact', head: true });
ok(bancoVisible === 50, `RLS: el banco completo es visible (${bancoVisible}/50)`);

// El ejecutivo NO puede escribir el banco directamente
const { error: errEscritura } = await erico
  .from('banco_codigos')
  .update({ estado: 'anulado' })
  .eq('codigo', codigos[0])
  .select();
const { data: trasIntento } = await erico
  .from('banco_codigos')
  .select('estado')
  .eq('codigo', codigos[0])
  .single();
ok(
  errEscritura !== null || trasIntento.estado === 'en_uso',
  'RLS: un ejecutivo no puede modificar el banco directamente',
);

// 4. Limpieza: devolver códigos tomados en la prueba y borrar auth temporales
const { error: errLimpieza } = await admin
  .from('banco_codigos')
  .update({ estado: 'disponible', tomado_por: null, tomado_en: null })
  .in('codigo', codigos);
if (errLimpieza) throw new Error(`limpieza: ${errLimpieza.message}`);
for (const id of authIds) await admin.auth.admin.deleteUser(id);

const { count: disponibles } = await admin
  .from('banco_codigos')
  .select('id', { count: 'exact', head: true })
  .eq('estado', 'disponible');
ok(disponibles === 45, `limpieza completa: ${disponibles}/45 disponibles otra vez`);

console.log(fallas === 0 ? '\nTODO OK' : `\n${fallas} PRUEBAS FALLARON`);
process.exit(fallas === 0 ? 0 : 1);
