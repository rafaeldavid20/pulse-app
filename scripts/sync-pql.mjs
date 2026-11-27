#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(process.env.PQL_BACKEND_ROOT || resolve(root, '../pulse-backend'));
const source = resolve(root, 'src/lib/pql');
const target = resolve(backend, 'functions/src/common/pql');
const files = readdirSync(source).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();
const header = '// GENERATED from pulse-app/src/lib/pql; do not edit.\n';
const hash = text => createHash('sha256').update(text).digest('hex');
const manifest = Object.fromEntries(files.map(name => [name, hash(readFileSync(resolve(source, name), 'utf8'))]));
const manifestText = JSON.stringify({ version: 1, files: manifest }, null, 2) + '\n';
const check = process.argv.includes('--check');
const frontendManifest = resolve(source, 'manifest.json');
if (check) {
  if (!existsSync(frontendManifest) || readFileSync(frontendManifest, 'utf8') !== manifestText) throw new Error('PQL source differs from manifest; run npm run sync:pql.');
  if (!existsSync(resolve(backend, 'functions/src/common'))) {
    throw new Error('Backend checkout absent; set PQL_BACKEND_ROOT to the backend revision to verify cross-repository parity.');
  }
  if (!existsSync(target)) throw new Error('PQL generated backend directory is missing.');
  const generatedFiles = readdirSync(target).filter(name => name.endsWith('.ts')).sort();
  if (JSON.stringify(generatedFiles) !== JSON.stringify(files)) throw new Error('PQL backend file list differs.');
  if (!existsSync(resolve(target, 'manifest.json')) || readFileSync(resolve(target, 'manifest.json'), 'utf8') !== manifestText) throw new Error('PQL backend manifest differs.');
  for (const name of files) {
    if (!existsSync(resolve(target, name)) || readFileSync(resolve(target, name), 'utf8') !== header + readFileSync(resolve(source, name), 'utf8')) throw new Error(`PQL backend drift: ${name}`);
  }
  console.log('PQL source, manifest and backend copy agree.');
} else {
  if (!existsSync(resolve(backend, 'functions/src/common'))) throw new Error(`Backend checkout not found: ${backend}`);
  mkdirSync(target, { recursive: true });
  writeFileSync(frontendManifest, manifestText);
  writeFileSync(resolve(target, 'manifest.json'), manifestText);
  for (const name of files) writeFileSync(resolve(target, name), header + readFileSync(resolve(source, name), 'utf8'));
  console.log(`PQL synchronized to ${target}.`);
}
