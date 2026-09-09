#!/usr/bin/env node
/**
 * Falla si la copia del modelo de dominio en `pulse-backend` no es exactamente
 * lo que produciría `npm run sync:types`. Corre como parte de `npm run lint`.
 *
 * Compara el archivo completo, no solo el `SOURCE_HASH` estampado: si comparara
 * el hash, editar a mano el archivo *generado* pasaría desapercibido (el hash
 * describe la fuente, no la copia) — que es justo el caso que este check existe
 * para atrapar.
 *
 * Si `pulse-backend` no está clonado al lado (CI del frontend solo, un clone
 * parcial), avisa y sale con 0: no hay nada que verificar, y romper el lint por
 * eso sería ruido.
 */
import { existsSync, readFileSync } from 'node:fs';
import { SOURCE, TARGET, hashOf, headerFor } from './sync-types.mjs';

if (!existsSync(TARGET)) {
  console.warn(
    `[check-types-sync] ${TARGET} no existe — se omite la verificación.\n` +
      '  (pulse-backend no está clonado al lado; corré `npm run sync:types` cuando lo esté.)'
  );
  process.exit(0);
}

const source = readFileSync(SOURCE, 'utf8');
const expected = headerFor(hashOf(source)) + source;
const actual = readFileSync(TARGET, 'utf8');

if (actual === expected) {
  console.log(`[check-types-sync] ✓ el modelo de dominio está sincronizado (${hashOf(source)}).`);
  process.exit(0);
}

const stamped = actual.match(/^\/\/ SOURCE_HASH: ([0-9a-f]+)$/m)?.[1];
const reason =
  stamped === hashOf(source)
    ? 'el archivo generado fue editado a mano (su SOURCE_HASH coincide, su contenido no)'
    : `la fuente cambió desde la última sincronización (fuente ${hashOf(source)}, generado ${stamped ?? 'sin SOURCE_HASH'})`;

console.error(
  '\n[check-types-sync] ✗ El modelo de dominio está DESINCRONIZADO.\n' +
    `  motivo:   ${reason}\n` +
    `  fuente:   ${SOURCE}\n` +
    `  generado: ${TARGET}\n\n` +
    '  Editá siempre la fuente, después corré `npm run sync:types` y commiteá\n' +
    '  el archivo generado en pulse-backend.\n'
);
process.exit(1);
