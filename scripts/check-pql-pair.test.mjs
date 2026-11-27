import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('paired verification rejects an outdated or changing peer revision', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pulse-pair-'));
  const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
  try {
    mkdirSync(join(dir, '.github')); mkdirSync(join(dir, 'backend/.github'), {recursive:true}); mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, '.github/pql-pair.json'), JSON.stringify({frontendPr:101, backendPr:114}));
    const peer = sha => writeFileSync(join(dir, 'backend/.github/pql-pair.json'), JSON.stringify({frontendSha:sha, backendPr:114}));
    writeFileSync(join(dir, 'bin/gh'), '#!/bin/sh\nprintf "%s\\n" "$CURRENT_SHA"\n', {mode:0o755});
    const run = current => spawnSync(process.execPath, [resolve('scripts/check-pql-pair.mjs')], {cwd:dir, env:{...process.env, PATH:`${dir}/bin:${process.env.PATH}`, PQL_BACKEND_ROOT:join(dir, 'backend'), FRONTEND_PR:'101', FRONTEND_SHA:a, BACKEND_SHA:b, CURRENT_SHA:current}});
    peer(a); assert.equal(run(b).status, 0);
    peer(c); assert.notEqual(run(b).status, 0);
    peer(a); assert.notEqual(run(c).status, 0);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
