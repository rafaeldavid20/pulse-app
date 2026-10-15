import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const compiled = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(compiled, compiled.exports, name => mocks[name] || require(name));
  return compiled.exports;
}

test('panel holds acknowledged values across lost ACK polls until the exact request is applied', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://pulse.test' });
  const globals = { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const oldInterval = globalThis.setInterval; const oldClear = globalThis.clearInterval;
  let poll;
  globalThis.setInterval = callback => { poll = callback; return 1; };
  globalThis.clearInterval = () => {};
  const snapshot = { version: 1, revision: 'a'.repeat(64), provider: 'codex', model: 'old-model', modelValid: true, models: ['old-model', 'new-model'], directories: [
    { repo: 'owner/repo', selected: 'old-dir', valid: true, candidates: [{ id: 'old-dir', alias: 'Checkout 1' }, { id: 'new-dir', alias: 'Checkout 2' }] },
  ] };
  const initial = { workspaceId: 'ws', agentId: 'agent', runnerId: 'runner', provider: 'codex', binding: 'binding', online: true, capable: true, repos: ['owner/repo'], observedAt: new Date().toISOString(), snapshot, request: null };
  let response = initial; let submitted;
  const { RunnerProfilePanel } = load('../src/components/settings/RunnerProfilePanel.tsx', {
    '@/lib/firestore': { runnerProfile: async input => { if (input.op === 'request') { submitted = input; return {}; } return response; } },
    '@/lib/runner-profile-state': load('../src/lib/runner-profile-state.ts'),
    '@/components/ui/Button': { Button: ({ children, disabled, onClick }) => React.createElement('button', { disabled, onClick }, children) },
  });
  const container = document.getElementById('root'); const root = createRoot(container);
  const refresh = () => act(async () => { poll(); });
  const assertOld = () => {
    assert.match(container.textContent, /Modelo confirmado: old-model/);
    assert.match(container.textContent, /owner\/repo · confirmado: Checkout 1/);
    assert.match(container.textContent, /revisión aaaaaaaaaaaa/);
  };
  try {
    await act(async () => root.render(React.createElement(RunnerProfilePanel, { agent: { id: 'agent', runnerId: 'runner', kind: 'codex' } })));
    await act(async () => {
      const selects = container.querySelectorAll('select');
      selects[0].value = 'new-model'; selects[0].dispatchEvent(new window.Event('change', { bubbles: true }));
      selects[1].value = 'new-dir'; selects[1].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Guardar en Runner').click());
    assert.ok(submitted.requestId);
    const changed = { ...snapshot, revision: 'b'.repeat(64), model: 'new-model', directories: snapshot.directories.map(d => ({ ...d, selected: 'new-dir' })) };
    response = { ...initial, snapshot: changed, request: { id: submitted.requestId, status: 'applying' } };
    await refresh(); assertOld();
    response = { ...response, online: false };
    await refresh(); assertOld(); assert.match(container.textContent, /histórico/);
    response = { ...response, online: true, request: { id: 'another-request', status: 'applied' } };
    await refresh(); assertOld(); assert.match(container.textContent, /Aplicando/);
    assert.ok(localStorage.length); // A different ACK must not clear the pending ID.
    response = { ...response, request: { id: submitted.requestId, status: 'applied' } };
    await refresh();
    assert.match(container.textContent, /Modelo confirmado: new-model/);
    assert.match(container.textContent, /owner\/repo · confirmado: Checkout 2/);
    assert.match(container.textContent, /Cambio confirmado por el Runner/);
    assert.equal(localStorage.length, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    globalThis.setInterval = oldInterval; globalThis.clearInterval = oldClear;
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
