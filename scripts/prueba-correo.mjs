// Diagnóstico de correo: prueba Resend de punta a punta con la
// configuración real de .env.local y dice EXACTAMENTE qué falla.
//   node scripts/prueba-correo.mjs
import { Resend } from 'resend';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const limpiar = (v) =>
  v && v.trim() && !v.trim().toUpperCase().startsWith('PENDIENTE')
    ? v.trim()
    : undefined;

console.log('── Diagnóstico de correo (Resend) ──\n');

const llave = limpiar(env.RESEND_API_KEY);
const pruebas = limpiar(env.CORREO_PRUEBAS);

if (!llave) {
  console.log('✗ RESEND_API_KEY no está configurada (vacía o sigue el marcador PENDIENTE).');
  console.log('  → Crea una llave en resend.com → API Keys → Create API Key,');
  console.log('    pégala en .env.local (RESEND_API_KEY=re_...) y vuelve a correr esto.');
  process.exit(1);
}
console.log(`✓ RESEND_API_KEY presente (${llave.slice(0, 6)}…)`);
if (!llave.startsWith('re_')) {
  console.log('⚠ Ojo: las llaves de Resend empiezan con "re_". Verifica que copiaste la llave correcta.');
}

if (!pruebas) {
  console.log('✗ CORREO_PRUEBAS no está configurado (vacío o dice PENDIENTE).');
  console.log('  → Mientras el dominio no esté verificado, Resend SOLO entrega al');
  console.log('    correo del dueño de la cuenta. Pon ese correo en CORREO_PRUEBAS.');
  process.exit(1);
}
console.log(`✓ CORREO_PRUEBAS = ${pruebas}`);

console.log('\nEnviando correo de prueba…');
const resend = new Resend(llave);
const { data, error } = await resend.emails.send({
  from: 'Métrica Sistema <onboarding@resend.dev>',
  to: pruebas,
  subject: '✓ Prueba de correo · Métrica Sistema Operativo',
  html: '<p>Si lees esto, los correos del sistema funcionan. 🎉</p>',
});

if (error) {
  console.log(`\n✗ Resend rechazó el envío: ${error.message}`);
  if (/testing emails|your own email|verify a domain/i.test(error.message)) {
    console.log('\n  → TRADUCCIÓN: tu cuenta Resend está en modo pruebas y SOLO puede');
    console.log('    enviar al correo con el que te registraste en resend.com.');
    console.log(`    CORREO_PRUEBAS (${pruebas}) debe ser EXACTAMENTE ese correo.`);
  }
  if (/api key is invalid|unauthorized/i.test(error.message)) {
    console.log('\n  → TRADUCCIÓN: la llave RESEND_API_KEY no es válida. Genera una');
    console.log('    nueva en resend.com → API Keys y reemplázala en .env.local.');
  }
  process.exit(1);
}

console.log(`\n✓ ENVIADO (id ${data.id}). Revisa la bandeja de ${pruebas}`);
console.log('  (y la carpeta de SPAM — los correos de onboarding@resend.dev suelen caer ahí).');
