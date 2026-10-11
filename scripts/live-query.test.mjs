import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/live-query.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
} });
const { createLiveQuery, invalidateLiveQueries } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function browser(t) {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const nav = { onLine: true };
  const original = ['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of [['window', win], ['document', doc], ['navigator', nav]]) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  t.after(() => {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return { win, doc, nav };
}

test('two independent readers see backend creates, updates and deletes without manual refresh', async t => {
  browser(t);
  let records = [];
  const sessionA = createLiveQuery(async () => structuredClone(records));
  const sessionB = createLiveQuery(async () => structuredClone(records));
  t.after(sessionA.subscribe(() => {}));
  t.after(sessionB.subscribe(() => {}));
  await flush();
  for (const next of [[{ id: 'a', status: 'todo' }], [{ id: 'a', status: 'done' }], []]) {
    records = next;
    t.mock.timers.tick(3000);
    await flush();
    assert.deepEqual(sessionA.getSnapshot().data, next);
    assert.deepEqual(sessionB.getSnapshot().data, next);
    assert.equal(sessionA.getSnapshot().loading, false);
  }
});

test('reconnect and return to a visible tab refresh current data immediately', async t => {
  const { win, doc, nav } = browser(t);
  let value = 'before';
  const resource = createLiveQuery(async () => value);
  t.after(resource.subscribe(() => {}));
  await flush();
  nav.onLine = false;
  value = 'after offline mutation';
  t.mock.timers.tick(6000);
  await flush();
  assert.equal(resource.getSnapshot().data, 'before');
  nav.onLine = true;
  win.dispatchEvent(new Event('online'));
  await flush();
  assert.equal(resource.getSnapshot().data, value);
  doc.visibilityState = 'hidden';
  value = 'after background mutation';
  t.mock.timers.tick(3000);
  await flush();
  assert.notEqual(resource.getSnapshot().data, value);
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(resource.getSnapshot().data, value);
});

test('workspace switch/unmount discards an in-flight response and removes wake listeners', async t => {
  const { win } = browser(t);
  let finish;
  let reads = 0;
  const old = createLiveQuery(() => { reads++; return new Promise(resolve => { finish = resolve; }); });
  const stop = old.subscribe(() => {});
  await flush();
  stop();
  const next = createLiveQuery(async () => ['new workspace']);
  t.after(next.subscribe(() => {}));
  finish(['old workspace']);
  await flush();
  win.dispatchEvent(new Event('focus'));
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(reads, 1);
  assert.equal(old.getSnapshot().data, undefined);
  assert.deepEqual(next.getSnapshot().data, ['new workspace']);
});

test('permission failures clear stale results and a later successful read recovers', async t => {
  browser(t);
  let allowed = true;
  const resource = createLiveQuery(async () => {
    if (!allowed) throw new Error('permission-denied');
    return ['authorized'];
  });
  t.after(resource.subscribe(() => {}));
  await flush();
  allowed = false;
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(resource.getSnapshot().data, undefined);
  assert.equal(resource.getSnapshot().error, 'permission-denied');
  allowed = true;
  t.mock.timers.tick(3000);
  await flush();
  assert.deepEqual(resource.getSnapshot().data, ['authorized']);
  assert.equal(resource.getSnapshot().error, null);
});

test('local mutation during a slow read queues a fresh read without parallel requests', async t => {
  browser(t);
  let finish;
  let calls = 0;
  let value = 'old';
  const resource = createLiveQuery(() => {
    calls++;
    const captured = value;
    return calls === 1 ? new Promise(resolve => { finish = () => resolve(captured); }) : Promise.resolve(value);
  });
  t.after(resource.subscribe(() => {}));
  await flush();
  value = 'new';
  invalidateLiveQueries();
  invalidateLiveQueries();
  assert.equal(calls, 1);
  finish();
  await flush();
  assert.equal(calls, 2);
  assert.equal(resource.getSnapshot().data, 'new');
});

test('resubscription cannot be populated by the previous pending request', async t => {
  browser(t);
  let finish;
  let calls = 0;
  const resource = createLiveQuery(() => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve('current'));
  const stop = resource.subscribe(() => {});
  await flush();
  stop();
  t.after(resource.subscribe(() => {}));
  await flush();
  finish('stale');
  await flush();
  assert.equal(resource.getSnapshot().data, 'current');
});
