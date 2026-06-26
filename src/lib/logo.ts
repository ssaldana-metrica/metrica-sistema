import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Incrusta el logo oficial de Métrica (a color, navy sobre transparente) como
// data URI para usarlo en los PDF (@react-pdf/renderer). Se lee una sola vez.
let cache: string | null = null;

export function logoMetrica(): string {
  if (!cache) {
    const buf = readFileSync(
      join(process.cwd(), 'public', 'marca', 'logo-metrica.png'),
    );
    cache = `data:image/png;base64,${buf.toString('base64')}`;
  }
  return cache;
}
