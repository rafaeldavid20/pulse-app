import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/workspace-access.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
} });
const { waitForWorkspaceAccess } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('starts loading only after refreshed claims include the selected workspace', async () => {
  let reads = 0;
  const user = { getIdTokenResult: async (force) => {
    assert.equal(force, true);
    reads++;
    return { claims: { ws: reads < 4 ? { other: 'owner' } : { invited: 'member' } } };
  } };
  await waitForWorkspaceAccess(user, 'invited', new AbortController().signal, [0, 0, 0, 0]);
  assert.equal(reads, 4);
});

test('existing membership loads on the first refresh', async () => {
  let reads = 0;
  await waitForWorkspaceAccess({ getIdTokenResult: async () => {
    reads++;
    return { claims: { ws: { existing: 'owner' } } };
  } }, 'existing', new AbortController().signal);
  assert.equal(reads, 1);
});

test('missing permissions stop with an actionable error', async () => {
  for (const claims of [{}, { ws: null }, { ws: 'invalid' }, { ws: { other: 'owner' } }]) {
    await assert.rejects(waitForWorkspaceAccess({ getIdTokenResult: async () => ({ claims }) },
      'invited', new AbortController().signal, [0, 0]), /Recarga la página/);
  }
});

test('a transient token failure is retried', async () => {
  let reads = 0;
  await waitForWorkspaceAccess({ getIdTokenResult: async () => {
    if (++reads === 1) throw new Error('offline');
    return { claims: { ws: { invited: 'member' } } };
  } }, 'invited', new AbortController().signal, [0, 0]);
  assert.equal(reads, 2);
});

test('switching workspace during a refresh prevents stale loading', async () => {
  const controller = new AbortController();
  let finishRefresh;
  let started = false;
  const pending = waitForWorkspaceAccess({ getIdTokenResult: () => new Promise((resolve) => {
    finishRefresh = resolve;
  }) }, 'old', controller.signal).then(() => { started = true; });
  controller.abort();
  finishRefresh({ claims: { ws: { old: 'member' } } });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(started, false);
});

test('signing out cancels a scheduled retry immediately', async () => {
  const controller = new AbortController();
  let reads = 0;
  const pending = waitForWorkspaceAccess({ getIdTokenResult: async () => {
    reads++;
    return { claims: {} };
  } }, 'invited', controller.signal, [0, 10_000]);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(reads, 1);
});
