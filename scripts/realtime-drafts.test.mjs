import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function compile(source, mocks) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports,
  );
  return compiled.exports;
}

test('workspace settings render without a workspace after membership revocation', async () => {
  const source = await readFile(new URL('../src/app/(app)/settings/workspace/page.tsx', import.meta.url), 'utf8');
  const { default: Page } = compile(source, {
    '@/stores/appStore': { useAppStore: select => select({ activeWorkspace: null }) },
    '@/components/ui/Input': { Input: props => React.createElement('input', props) },
    '@/components/ui/Button': { Button: ({ children, disabled }) => React.createElement('button', { disabled }, children) },
    '@/lib/firestore': {},
  });
  assert.match(renderToStaticMarkup(React.createElement(Page)), /General/);
});

// Execute the actual title hooks and input handler with deterministic renders
// and timers. Unrelated panel services are excluded; this is not a browser test.
const source = await readFile(new URL('../src/components/issues/IssuePeekPanel.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let change;
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'input' &&
      node.attributes.properties.some(p => p.name?.getText(ast) === 'value' && p.initializer?.expression?.getText(ast) === 'titleDraft')) {
    change = node.attributes.properties.find(p => p.name?.getText(ast) === 'onChange').initializer.expression.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(change, 'title input handler found');
const hooks = source.slice(source.indexOf('  const [titleDraft,'), source.indexOf('  // En mobile el panel'));
function titleHarness() {
  const state = [], effects = [], timers = new Map(), writes = [];
  let index, rerender, nextTimer = 0;
  const depsEqual = (a, b) => a?.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const fixture = {
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = value; rerender = true; }];
    },
    useEffect(fn, deps) {
      const slot = index++;
      if (!depsEqual(effects[slot]?.deps, deps)) {
        effects[slot]?.cleanup?.();
        effects[slot] = { deps, cleanup: fn() };
      }
    },
    useCallback: fn => fn, useLiveQuery: () => ({ data: [] }), listAgents: () => [],
    setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const { render } = compile(`const { ${Object.keys(fixture).join(', ')} } = require('fixture');
    export function render(issue, updateIssue) {
      const activeWorkspace = null;
      ${hooks}
      return { titleDraft, titleEdited, onChange: ${change} };
    }`, { fixture });
  return {
    writes,
    render(title) {
      let result;
      for (let pass = 0; pass < 25; pass++) {
        index = 0; rerender = false;
        result = render({ id: 'issue', title }, async (_id, update) => { writes.push(update); });
        if (!rerender) return result;
      }
      throw new Error('Too many re-renders');
    },
    flush() { for (const [id, fn] of timers) { timers.delete(id); fn(); } },
  };
}

test('reverting a title before autosave resumes external title updates', () => {
  const panel = titleHarness();
  panel.render('A').onChange({ target: { value: 'B' } });
  panel.render('A').onChange({ target: { value: 'A' } });
  assert.equal(panel.render('A').titleEdited, false);
  panel.flush();
  assert.deepEqual(panel.writes, []);
  assert.equal(panel.render('C').titleDraft, 'C');
});

test('external titles preserve an unsaved draft and own save clears dirty state', () => {
  const panel = titleHarness();
  panel.render('A').onChange({ target: { value: 'B' } });
  assert.equal(panel.render('C').titleDraft, 'B');
  panel.flush();
  assert.deepEqual(panel.writes, [{ title: 'B' }]);
  assert.equal(panel.render('B').titleEdited, false);
  assert.equal(panel.render('D').titleDraft, 'D');
});
