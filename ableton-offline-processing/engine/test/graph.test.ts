import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GraphError, VersionGraph, rootId } from '../src/graph.ts';
import { normalizeOperation, OperationError } from '../src/operations.ts';

const FP = 'f'.repeat(64);
const op = (o: Parameters<typeof normalizeOperation>[0]) => normalizeOperation(o);
const R = op({ id: 'rev', type: 'reverse', enabled: true });
const G3 = op({ id: 'gain', type: 'gain', db: -3, enabled: true });
const G6 = op({ id: 'gain', type: 'gain', db: -6, enabled: true });

test('nodes are content-addressed: identical chains resolve to identical nodes', () => {
  const g = new VersionGraph();
  g.addSource(FP);
  const a = g.commit('main', FP, [R, G3]);
  const b = g.commit('other', FP, [R, G3]);
  assert.equal(a.head, b.head);
  assert.equal(g.allNodes().length, 3);
});

test('editing operation N shares the prefix and creates new nodes only from N on', () => {
  const g = new VersionGraph();
  g.addSource(FP);
  const a = g.commit('main', FP, [R, G3]);
  const first = g.linear('main');
  const b = g.commit('main', FP, [R, G6]);
  const second = g.linear('main');
  assert.equal(first[0]!.id, second[0]!.id, 'Reverse node reused');
  assert.notEqual(first[1]!.id, second[1]!.id);
  assert.equal(b.revision, a.revision + 1);
  assert.ok(g.hasNode(first[1]!.id), 'old version is retained (alternate version)');
  // removing Reverse makes Gain's parent the root
  g.commit('main', FP, [G3]);
  assert.equal(g.linear('main')[0]!.parent, rootId(FP));
  assert.equal(g.children(rootId(FP)).length, 2, 'root now has two alternate children');
});

test('branch isolation: committing one branch never changes another', () => {
  const g = new VersionGraph();
  g.addSource(FP);
  g.commit('main', FP, [R, G3]);
  const reverseNode = g.linear('main')[0]!.id;
  g.createBranch('alt', reverseNode);
  const mainBefore = g.branch('main');
  g.commit('alt', FP, [G6], reverseNode);
  assert.deepEqual(g.branch('main'), mainBefore);
  assert.deepEqual(g.linear('alt').map((n) => n.operation.params), [{}, { db: -6 }]);
  assert.throws(() => g.createBranch('alt', reverseNode), GraphError);
});

test('snapshot round-trip and tamper detection', () => {
  const g = new VersionGraph();
  g.addSource(FP);
  g.commit('main', FP, [R, G3]);
  const snap = JSON.parse(JSON.stringify(g.toJSON()));
  assert.deepEqual(VersionGraph.fromJSON(snap).toJSON(), g.toJSON());
  const tampered = structuredClone(snap);
  const n = tampered.nodes.find((x: { kind: string }) => x.kind === 'operation' && (x as any).operation.type === 'gain');
  n.operation.params.db = 0;
  assert.throws(() => VersionGraph.fromJSON(tampered), /does not match its id/);
  const dangling = structuredClone(snap);
  dangling.branches[0].head = 'n:missing';
  assert.throws(() => VersionGraph.fromJSON(dangling), /missing head/);
});

test('operation normalization and validation', () => {
  assert.deepEqual(op({ id: 'g', type: 'gain', db: -3.00000000001, enabled: true }).params, { db: -3 });
  assert.deepEqual(op({ id: 'g', type: 'gain', db: -0, enabled: true }).params, { db: 0 });
  assert.throws(() => op({ id: 'g', type: 'gain', db: 30, enabled: true }), OperationError);
  assert.throws(() => op({ id: 'g', type: 'gain', db: NaN, enabled: true }), OperationError);
  assert.throws(() => op({ id: '', type: 'reverse', enabled: true }), OperationError);
  assert.throws(() => op({ id: 'x', type: 'pitch' as 'reverse', enabled: true }), OperationError);
  const g = new VersionGraph();
  g.addSource(FP);
  assert.throws(() => g.commit('main', FP, [G3, G6]), /unique/);
});
