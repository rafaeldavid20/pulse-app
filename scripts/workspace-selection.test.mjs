import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
async function load(path, mocks = {}, selectSource = (source) => source) {
  const source = selectSource(await readFile(new URL(path, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports,
  );
  return compiled.exports;
}

const selection = await load('../src/lib/workspace-selection.ts');
const domain = await load('../src/types/domain.ts');
const types = await load('../src/types/index.ts', { './domain': domain });
const freshStore = async () => (await load('../src/stores/appStore.ts', {
  '@/lib/workspace-selection': selection, '@/types': types,
})).useAppStore;
const workspaces = [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }];
function storage() {
  const values = new Map();
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } };
  return values;
}

test('explicit selection survives ten reloads with reordered membership snapshots', async () => {
  const values = storage();
  let store = await freshStore();
  store.getState().setWorkspaceUser('multi-workspace-user');
  store.getState().setUserWorkspaces(workspaces, 'multi-workspace-user');
  store.getState().setActiveWorkspace(workspaces[1]);
  for (let reload = 0; reload < 10; reload++) {
    store = await freshStore();
    assert.equal(store.getState().activeWorkspace, null, 'no unvalidated workspace during startup');
    store.getState().setWorkspaceUser('multi-workspace-user');
    store.getState().setUserWorkspaces(reload % 2 ? [...workspaces].reverse() : workspaces, 'multi-workspace-user');
    assert.equal(store.getState().activeWorkspace.id, 'beta');
  }
  store.getState().setActiveWorkspace(workspaces[0]);
  store = await freshStore();
  store.getState().setWorkspaceUser('multi-workspace-user');
  store.getState().setUserWorkspaces([...workspaces].reverse(), 'multi-workspace-user');
  assert.equal(store.getState().activeWorkspace.id, 'alpha');
  assert.deepEqual([...values.values()], ['alpha'], 'only the ID is persisted');
});

test('revoked/deleted selection falls back, refreshes metadata and clears an empty membership', async () => {
  storage();
  selection.saveWorkspaceSelection('user', 'deleted');
  const store = await freshStore();
  const state = () => store.getState();
  state().setWorkspaceUser('user');
  state().setUserWorkspaces(workspaces, 'user');
  assert.equal(state().activeWorkspace.id, 'alpha');
  state().setActiveWorkspace(workspaces[1]);
  state().setUserWorkspaces([workspaces[0]], 'user');
  assert.equal(state().activeWorkspace.id, 'alpha');
  assert.equal(selection.readWorkspaceSelection('user'), 'alpha');
  state().setUserWorkspaces([{ ...workspaces[0], name: 'Renamed' }], 'user');
  assert.equal(state().activeWorkspace.name, 'Renamed');
  state().setUserWorkspaces([], 'user');
  assert.equal(state().activeWorkspace, null);
  assert.equal(selection.readWorkspaceSelection('user'), null);
});

test('preferences are isolated by user and late callbacks from a signed-out user are ignored', async () => {
  storage();
  const store = await freshStore();
  const state = () => store.getState();
  state().setWorkspaceUser('alice');
  state().setUserWorkspaces(workspaces, 'alice');
  state().setActiveWorkspace(workspaces[1]);
  state().setWorkspaceUser(null);
  assert.equal(state().activeWorkspace, null);
  state().setWorkspaceUser('bob');
  state().setUserWorkspaces(workspaces, 'bob');
  assert.equal(state().activeWorkspace.id, 'alpha');
  state().setUserWorkspaces([workspaces[1]], 'alice');
  assert.equal(state().activeWorkspace.id, 'alpha');
  state().setWorkspaceUser('alice');
  state().setUserWorkspaces(workspaces, 'alice');
  assert.equal(state().activeWorkspace.id, 'beta');
});

test('SSR and unavailable browser storage still permit an in-memory selection', async () => {
  for (const browser of [undefined, { get localStorage() { throw new Error('denied'); } }]) {
    globalThis.window = browser;
    const store = await freshStore();
    store.getState().setWorkspaceUser('user');
    store.getState().setUserWorkspaces(workspaces, 'user');
    store.getState().setActiveWorkspace(workspaces[1]);
    store.getState().setUserWorkspaces(workspaces, 'user');
    assert.equal(store.getState().activeWorkspace.id, 'beta');
  }
});

test('AuthGuard hides page data until membership is validated and old data stores are cleared', async () => {
  storage();
  const store = await freshStore();
  const noop = () => {};
  let user = { uid: 'user', email: 'fixture@example.invalid' };
  let pathname = '/team/eng/issues';
  const mocks = {
    // SSR normally reads Zustand's initial state. Supply the current browser
    // snapshot here so we can exercise the guard at each lifecycle boundary.
    '@/stores/appStore': { useAppStore: (select) => select(store.getState()) },
    '@/hooks/useAuth': { useAuth: () => ({ user, loading: false }) },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push: noop }) },
    '@/lib/firebase': { auth: {} }, '@/lib/workspace-access': {}, '@/lib/firestore': {},
    '@/hooks/useKeyboard': { useKeyboard: noop },
  };
  for (const name of ['Issue', 'Project', 'Label', 'Cycle', 'Notification']) {
    mocks[`@/stores/${name.toLowerCase()}Store`] = { [`use${name}Store`]: (select) => select({}) };
  }
  for (const [folder, name] of [
    ['layout', 'CommandPalette'], ['layout', 'ShortcutHelp'], ['layout', 'CreateMenuModal'],
    ['issues', 'CreateIssueModal'], ['issues', 'IssuePeekPanel'],
    ['workspace', 'InviteMemberModal'], ['projects', 'ProjectModal'],
  ]) mocks[`@/components/${folder}/${name}`] = { [name]: () => null };
  const { AuthGuard } = await load('../src/components/auth/AuthGuard.tsx', mocks);
  const render = () => renderToStaticMarkup(React.createElement(AuthGuard, null, 'WORKSPACE_DATA'));
  assert.ok(!render().includes('WORKSPACE_DATA'));
  store.getState().setWorkspaceUser('user');
  store.getState().setUserWorkspaces(workspaces, 'user');
  assert.ok(!render().includes('WORKSPACE_DATA'));
  store.getState().setWorkspaceDataScope(JSON.stringify(['user', 'alpha']));
  for (const path of ['/team/eng/issues', '/team/eng/projects', '/settings/workspace']) {
    pathname = path;
    assert.ok(render().includes('WORKSPACE_DATA'));
  }
  store.getState().setActiveWorkspace(workspaces[1]);
  assert.ok(!render().includes('WORKSPACE_DATA'), 'explicit switch hides old workspace data');
  store.getState().setWorkspaceDataScope(JSON.stringify(['user', 'beta']));
  assert.ok(render().includes('WORKSPACE_DATA'));
  store.getState().setUserWorkspaces([workspaces[0]], 'user');
  assert.ok(!render().includes('WORKSPACE_DATA'), 'revocation hides old workspace data');
  user = { uid: 'other', email: 'other@example.invalid' };
  assert.ok(!render().includes('WORKSPACE_DATA'), 'different user cannot see previous data');
  user = null;
  assert.ok(!render().includes('WORKSPACE_DATA'));
});

test('async membership reads cannot restore an obsolete or unsubscribed workspace list', async () => {
  let snapshot;
  const pending = [];
  const { subscribeUserWorkspaces } = await load('../src/lib/firestore.ts', { fixture: {
    db: {}, query: () => ({}), collection: () => ({}), where: () => ({}),
    doc: (_db, _collection, id) => id,
    onSnapshot: (_query, callback) => { snapshot = callback; return () => {}; },
    getDoc: (id) => new Promise((resolve) => pending.push(() => resolve({
      exists: () => true, data: () => ({ id }),
    }))),
  } }, (source) => {
    const ast = ts.createSourceFile('firestore.ts', source, ts.ScriptTarget.Latest);
    const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'subscribeUserWorkspaces');
    return `const { query, collection, db, where, onSnapshot, getDoc, doc } = require('fixture');\n${fn.getText(ast)}`;
  });
  const seen = [];
  const unsubscribe = subscribeUserWorkspaces('user', 'fixture@example.invalid', (value) => seen.push(value));
  const snap = (ids) => ({ docs: ids.map((workspaceId) => ({ data: () => ({ workspaceId }) })) });
  const old = snapshot(snap(['old']));
  await snapshot(snap([]));
  pending.shift()();
  await old;
  assert.deepEqual(seen, [[]]);
  const earlier = snapshot(snap(['alpha']));
  const newer = snapshot(snap(['beta']));
  pending.pop()();
  await newer;
  pending.shift()();
  await earlier;
  assert.deepEqual(seen, [[], [{ id: 'beta' }]]);
  const stale = snapshot(snap(['signed-out']));
  unsubscribe();
  pending.shift()();
  await stale;
  assert.deepEqual(seen, [[], [{ id: 'beta' }]]);
});
