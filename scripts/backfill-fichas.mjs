// Backfill PUNTUAL (una sola vez): crea la ficha de apertura de las
// cotizaciones que YA estaban aprobadas antes de existir esta función.
// Es idempotente — si ya tienen ficha, las salta. No es parte del flujo
// normal: una vez corrido, no hace falta volver a ejecutarlo.
//   node scripts/backfill-fichas.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

console.log('── Backfill de fichas de apertura ──\n');

const { data: aprobadas, error } = await sb
  .from('cotizaciones')
  .select('id, codigo, moneda, cliente:clientes(nombre_comercial, ruc)')
  .eq('estado', 'aprobada');
if (error) {
  console.log('✗ No se pudo leer las cotizaciones:', error.message);
  process.exit(1);
}

let creadas = 0;
let saltadas = 0;
for (const c of aprobadas ?? []) {
  const { data: ya } = await sb
    .from('fichas_apertura')
    .select('id')
    .eq('cotizacion_id', c.id)
    .maybeSingle();
  if (ya) {
    saltadas++;
    continue;
  }
  const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente;
  const { error: errIns } = await sb.from('fichas_apertura').insert({
    cotizacion_id: c.id,
    codigo: `FA-${c.codigo}`,
    cliente_nombre: cliente?.nombre_comercial ?? '',
    cliente_ruc: cliente?.ruc ?? '',
    moneda: c.moneda,
  });
  if (errIns) {
    console.log(`✗ ${c.codigo}: ${errIns.message}`);
    continue;
  }
  console.log(`✓ FA-${c.codigo} creada`);
  creadas++;
}

console.log(`\nListo. Creadas: ${creadas} · ya existían: ${saltadas}`);
