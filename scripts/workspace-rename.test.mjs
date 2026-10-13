import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(source, mocks) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const pageSource = await readFile(new URL('../src/app/(app)/settings/workspace/page.tsx', import.meta.url), 'utf8');
function view() {
  let workspace = { id: 'ws', name: 'Original', slug: 'original' };
  const state = [], writes = [];
  let index, changed;
  const { default: Page } = compile(pageSource, {
    react: { useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = value; changed = true; }];
    } },
    '@/stores/appStore': { useAppStore: select => select({ activeWorkspace: workspace,
      setActiveWorkspace: next => { workspace = next; } }) },
    '@/components/ui/Input': { Input: 'input' }, '@/components/ui/Button': { Button: 'button' },
    '@/lib/firestore': { updateWorkspaceName: async (id, name) => {
      writes.push({ id, name }); return { ...workspace, name };
    } },
  });
  function render() {
    for (let pass = 0; pass < 25; pass++) {
      index = 0; changed = false;
      const tree = Page();
      if (changed) continue;
      const nodes = [];
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        nodes.push(node);
        const children = node.props?.children;
        (Array.isArray(children) ? children.flat(Infinity) : [children]).forEach(walk);
      }
      walk(tree);
      return { input: nodes.find(n => n.props?.id === 'workspace-name'),
        button: nodes.find(n => n.type === 'button'), nodes };
    }
    throw new Error('Too many renders');
  }
  return { render, writes, external: name => { workspace = { ...workspace, name }; } };
}
test('untouched view follows external rename; distinct draft survives and can save', async () => {
  const untouched = view(), draft = view();
  untouched.render(); draft.render().input.props.onChange({ target: { value: 'My draft' } });
  untouched.external('External'); draft.external('External');
  assert.equal(untouched.render().input.props.value, 'External');
  assert.equal(draft.render().input.props.value, 'My draft');
  const originalTimer = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try { await draft.render().button.props.onClick(); } finally { globalThis.setTimeout = originalTimer; }
  assert.deepEqual(draft.writes, [{ id: 'ws', name: 'My draft' }]);
  assert.ok(draft.render().nodes.some(n => n.props?.role === 'status'));
  assert.equal(draft.render().button.props.disabled, true);
});
for (const name of ['', '   ', 'x'.repeat(101), 'Bad\nname']) {
  test(`invalid draft ${JSON.stringify(name)} displays explanation and prevents save`, async () => {
    const page = view();
    page.render().input.props.onChange({ target: { value: name } });
    const rendered = page.render();
    assert.equal(rendered.button.props.disabled, true);
    assert.ok(rendered.nodes.some(n => n.props?.role === 'alert'));
    await rendered.button.props.onClick();
    assert.deepEqual(page.writes, []);
  });
}
const serviceSource = await readFile(new URL('../src/lib/firestore.ts', import.meta.url), 'utf8');
for (const failure of ['contract', 'transport']) {
  test(`workspace action propagates ${failure} error without a client write`, async () => {
    let writes = 0;
    const api = compile(serviceSource, {
      'firebase/firestore': { updateDoc: () => { writes++; } },
      'firebase/functions': { httpsCallable: () => async () => {
        if (failure === 'transport') throw new Error('Sin conexión');
        return { data: { success: false, error: 'Nombre inválido' } };
      } },
      './firebase': {}, '@/types': {}, nanoid: {}, './live-query': {},
    });
    await assert.rejects(api.updateWorkspaceName('ws', 'New'),
      new RegExp(failure === 'transport' ? 'Sin conexión' : 'Nombre inválido'));
    assert.equal(writes, 0);
  });
}
