#!/usr/bin/env node
/**
 * Copia `src/types/domain.ts` (la fuente única del modelo de dominio) al repo
 * de backend, estampando el hash de la fuente en el header.
 *
 * Por qué un script y no un paquete npm compartido: `pulse-app` y
 * `pulse-backend` son dos repos git independientes, y Firebase Functions sube
 * *solo* el directorio `functions/` y corre `npm install` en su propio
 * contenedor de build. Una dependencia `file:../shared` apunta a algo que
 * nunca se sube y el deploy falla. Copiar el archivo evita eso sin meter un
 * tercer repo ni versionado cruzado, y `check-types-sync.mjs` (enganchado a
 * `npm run lint`) hace imposible que los dos lados deriven en silencio.
 *
 *     npm run sync:types
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(here, '../src/types/domain.ts');
export const TARGET = resolve(
  here,
  '../../pulse-backend/functions/src/common/domain.generated.ts'
);

export function hashOf(contents) {
  return createHash('sha256').update(contents, 'utf8').digest('hex').slice(0, 16);
}

export function headerFor(hash) {
  return [
    '// ============================================================',
    '// GENERADO — NO EDITAR A MANO.',
    '//',
    '// Copia de `pulse-app/src/types/domain.ts`, la fuente única del modelo de',
    '// dominio de Pulse. Para cambiar algo de acá, editá ese archivo y corré',
    '// `npm run sync:types` desde `pulse-app`.',
    '//',
    `// SOURCE_HASH: ${hash}`,
    '// ============================================================',
    '',
    '',
  ].join('\n');
}

function main() {
  if (!existsSync(SOURCE)) {
    console.error(`[sync-types] No se encontró la fuente: ${SOURCE}`);
    process.exit(1);
  }

  const source = readFileSync(SOURCE, 'utf8');
  const targetDir = dirname(TARGET);

  if (!existsSync(targetDir)) {
    console.error(
      `[sync-types] No existe ${targetDir}.\n` +
        '  Se espera que pulse-backend esté clonado al lado de pulse-app.'
    );
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(TARGET, headerFor(hashOf(source)) + source, 'utf8');
  console.log(`[sync-types] ✓ ${TARGET} actualizado (hash ${hashOf(source)}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
