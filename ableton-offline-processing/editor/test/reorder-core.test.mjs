import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(here, '..', 'interface.html'), 'utf8');

// Evaluate the DOM-free core script exactly as shipped in interface.html.
const source = html.match(/<script id="aopx-plan-core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'interface.html must contain <script id="aopx-plan-core">');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const core = sandbox.window.AOPX_PLAN_CORE;

const threeOps = () => [
  { id: 'op-reverse-1', type: 'reverse', enabled: true },
  { id: 'op-gain-1', type: 'gain', db: -3, enabled: false },
  { id: 'op-gain-2', type: 'gain', db: 6.25, enabled: true },
];
const ids = ops => ops.map(op => op.id);

test('move later / move earlier swap adjacent operations', () => {
  const ops = threeOps();
  assert.deepEqual(ids(core.moveByDelta(ops, 'op-reverse-1', 1)), ['op-gain-1', 'op-reverse-1', 'op-gain-2']);
  assert.deepEqual(ids(core.moveByDelta(ops, 'op-gain-2', -1)), ['op-reverse-1', 'op-gain-2', 'op-gain-1']);
});

test('first/last boundaries are no-ops', () => {
  const ops = threeOps();
  assert.deepEqual(ids(core.moveByDelta(ops, 'op-reverse-1', -1)), ids(ops));
  assert.deepEqual(ids(core.moveByDelta(ops, 'op-gain-2', 1)), ids(ops));
  assert.ok(core.sameOrder(core.moveByDelta(ops, 'op-reverse-1', -1), ops));
  // Drag slots outside the list clamp to first/last.
  assert.deepEqual(ids(core.moveToIndex(ops, 'op-gain-1', -5)), ['op-gain-1', 'op-reverse-1', 'op-gain-2']);
  assert.deepEqual(ids(core.moveToIndex(ops, 'op-gain-1', 99)), ['op-reverse-1', 'op-gain-2', 'op-gain-1']);
});

test('drag moves before the first and after the last operation', () => {
  const ops = threeOps();
  assert.deepEqual(ids(core.moveToIndex(ops, 'op-gain-2', 0)), ['op-gain-2', 'op-reverse-1', 'op-gain-1']);
  assert.deepEqual(ids(core.moveToIndex(ops, 'op-reverse-1', 2)), ['op-gain-1', 'op-gain-2', 'op-reverse-1']);
});

test('unknown ids and invalid targets leave the order unchanged', () => {
  const ops = threeOps();
  assert.deepEqual(ids(core.moveByDelta(ops, 'missing', 1)), ids(ops));
  assert.deepEqual(ids(core.moveToIndex(ops, 'op-gain-1', NaN)), ids(ops));
  assert.deepEqual(ids(core.moveToIndex([], 'x', 0)), []);
});

test('reordering preserves ids, types, parameters and bypass state by reference', () => {
  const ops = threeOps();
  const snapshot = structuredClone(ops);
  const moved = core.moveToIndex(ops, 'op-gain-2', 0);
  assert.notEqual(moved, ops, 'returns a new array');
  assert.deepEqual(ops, snapshot, 'input array and objects are not mutated');
  for (const op of ops) {
    const after = moved.find(x => x.id === op.id);
    assert.equal(after, op, `${op.id} keeps object identity`);
  }
  const byId = Object.fromEntries(moved.map(op => [op.id, op]));
  assert.equal(byId['op-gain-1'].enabled, false, 'bypass preserved');
  assert.equal(byId['op-gain-1'].db, -3);
  assert.equal(byId['op-gain-2'].db, 6.25);
  assert.equal(byId['op-reverse-1'].type, 'reverse');
});

test('insertion slot is derived from row midpoints', () => {
  const mids = [100, 160];
  assert.equal(core.insertionIndex(mids, 20), 0);
  assert.equal(core.insertionIndex(mids, 130), 1);
  assert.equal(core.insertionIndex(mids, 500), 2);
  assert.equal(core.insertionIndex([], 50), 0);
});

test('emitted plan follows the exact new order with unchanged operations', () => {
  const reordered = core.moveToIndex(threeOps(), 'op-gain-2', 0);
  const plan = JSON.parse(JSON.stringify(core.buildPlan(reordered)));
  assert.deepEqual(plan, {
    version: 1,
    operations: [
      { id: 'op-gain-2', type: 'gain', db: 6.25, enabled: true },
      { id: 'op-reverse-1', type: 'reverse', enabled: true },
      { id: 'op-gain-1', type: 'gain', db: -3, enabled: false },
    ],
  });
});

test('Apply emits the plan through the shared core builder', () => {
  assert.match(html, /const plan=core\.buildPlan\(state\.operations\)/);
});

test('rows expose a dedicated, labelled drag handle and keyboard reorder', () => {
  assert.match(html, /handle\.className="drag-handle"/);
  assert.match(html, /addEventListener\("pointerdown",e=>beginDrag\(e,op,handle\)\)/);
  assert.match(html, /aria-keyshortcuts","ArrowUp ArrowDown"/);
  assert.match(html, /drop-indicator/);
  // Drag starts only from the handle: the row itself has no pointerdown/drag listeners.
  assert.doesNotMatch(html, /device\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(html, /draggable/);
});
