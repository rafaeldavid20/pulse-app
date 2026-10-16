import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const compiled = { exports: {} }; new Function('module', 'exports', 'require', outputText)(compiled, compiled.exports, require); return compiled.exports;
}
const { profileState, canEditProfile, reconcileProfileView } = load('../src/lib/runner-profile-state.ts');
const now = Date.now();
const snapshot = { version: 1, revision: 'a'.repeat(64), provider: 'codex', model: null, modelValid: true, models: ['model'], directories: [] };
const view = { workspaceId: 'ws-one', agentId: 'agent-one', runnerId: 'runner-one', provider: 'codex', binding: 'binding', online: true, capable: true, repos: [], observedAt: new Date(now).toISOString(), snapshot, request: null };

test('absence and old observations are never verified; old Runners require update', () => {
  assert.equal(profileState(null, null, now), 'no_data');
  assert.equal(profileState({ ...view, snapshot: null }, null, now), 'no_data');
  assert.equal(profileState({ ...view, observedAt: new Date(now - 121_000).toISOString() }, null, now), 'no_data');
  assert.equal(profileState({ ...view, observedAt: 'invalid' }, null, now), 'no_data');
  assert.equal(profileState({ ...view, capable: false }, null, now), 'incompatible');
  assert.equal(canEditProfile({ ...view, capable: false }, null, now), false);
});
test('enqueue and uncertain IDs keep confirmed values and await explicit acknowledgement', () => {
  assert.equal(profileState(view, 'pending-id', now), 'applying');
  assert.equal(profileState({ ...view, request: { id: 'different-id', status: 'applied' } }, 'pending-id', now), 'applying');
  assert.equal(canEditProfile(view, 'pending-id', now), false);
  assert.equal(snapshot.model, null);
  assert.equal(profileState({ ...view, request: { id: 'pending-id', status: 'applied' } }, 'pending-id', now), 'applied');
});
test('disconnect keeps history and blocks editing; reconnection reconciles by exact ID', () => {
  const offline = { ...view, online: false };
  assert.equal(profileState(offline, 'pending-id', now), 'offline');
  assert.equal(offline.snapshot, snapshot); assert.equal(canEditProfile(offline, null, now), false);
  assert.equal(profileState(view, 'pending-id', now), 'applying');
  assert.equal(profileState({ ...view, request: { id: 'pending-id', status: 'applied' } }, 'pending-id', now), 'applied');
});
test('validation failure, expiry, authorization failure and local conflict have distinct states', () => {
  for (const status of ['validation_failed', 'conflict', 'expired', 'forbidden']) assert.equal(profileState({ ...view, request: { id: 'pending-id', status } }, 'pending-id', now), status);
});
test('pending reconciliation cannot borrow a baseline from another target or invent one after remount', () => {
  const incoming = { ...view, request: { id: 'pending-id', status: 'applying' } };
  for (const previous of [null, ...['workspaceId', 'agentId', 'runnerId', 'binding'].map(key => ({ ...view, [key]: 'other' }))]) {
    const reconciled = reconcileProfileView(previous, incoming, 'pending-id');
    assert.equal(reconciled.snapshot, null);
    assert.equal(reconciled.observedAt, null);
    assert.equal(profileState(reconciled, 'pending-id', now), 'applying');
  }
});

test('server-discovered uncertainty drives applying state without a client ID', () => {
  const incoming = { ...view, request: { id: 'discovered', status: 'applying' } };
  assert.equal(profileState(incoming, null, now), 'applying');
  assert.equal(canEditProfile(incoming, null, now), false);
  const reconciled = reconcileProfileView(null, incoming, null);
  assert.equal(reconciled.snapshot, null);
  assert.equal(profileState(reconciled, null, now), 'applying');
});
