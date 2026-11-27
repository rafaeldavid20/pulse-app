import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('cross-repository PQL check fails without backend and on independently updated frontend', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pulse-pql-parity-'));
  try {
    const app = join(temp, 'app'), backend = join(temp, 'backend'), oldBackend = join(temp, 'old-backend');
    mkdirSync(join(app, 'scripts'), { recursive: true });
    mkdirSync(join(backend, 'functions/src/common'), { recursive: true });
    cpSync(resolve('scripts/sync-pql.mjs'), join(app, 'scripts/sync-pql.mjs'));
    cpSync(resolve('src/lib/pql'), join(app, 'src/lib/pql'), { recursive: true });
    const run = (root, ...args) => spawnSync(process.execPath, [join(app, 'scripts/sync-pql.mjs'), ...args], { env: { ...process.env, PQL_BACKEND_ROOT: root }, encoding: 'utf8' });
    assert.notEqual(run(join(temp, 'missing'), '--check').status, 0);
    assert.equal(run(backend).status, 0);
    cpSync(backend, oldBackend, { recursive: true });
    assert.equal(run(oldBackend, '--check').status, 0);
    appendFileSync(join(app, 'src/lib/pql/evaluator.ts'), '\n// new frontend revision\n');
    assert.equal(run(backend).status, 0);
    assert.notEqual(run(oldBackend, '--check').status, 0, 'a locally updated manifest must not hide backend drift');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
