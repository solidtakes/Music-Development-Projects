import { createHash } from 'node:crypto';
import { CONTRACT_VERSION, GAIN_MAX_DB, GAIN_MIN_DB } from './contract.ts';
import type { Operation, RenderStep, SourceInfo } from './contract.ts';

export interface HistoryNode {
  schemaVersion: typeof CONTRACT_VERSION;
  parent: string | null;
  operation: Operation;
}

export interface RenderReceipt {
  outputKey: string | null;
  steps: RenderStep[];
}

export interface Branch {
  tip: string | null;
  render: RenderReceipt | null;
}

export interface Manifest {
  version: 1;
  source: SourceInfo;
  nodes: Record<string, HistoryNode>;
  branches: Record<string, Branch>;
}

export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function digest(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function normalizeHistory(operations: readonly Operation[]): Operation[] {
  if (!Array.isArray(operations)) throw new TypeError('Expected an ordered operation array');
  const ids = new Set<string>();
  return Array.from(operations, (operation: Operation) => {
    if (!operation || typeof operation.id !== 'string' || !operation.id.trim() || ids.has(operation.id) ||
        operation.id.length > 128 || typeof operation.enabled !== 'boolean') {
      throw new TypeError('Operations require unique IDs and a boolean enabled state');
    }
    const { id, enabled } = operation;
    ids.add(id);
    if (operation.type === 'reverse') return { type: 'reverse', id, enabled };
    if (operation.type !== 'gain') throw new TypeError('Unsupported operation type');
    if (!Number.isFinite(operation.db) || operation.db < GAIN_MIN_DB || operation.db > GAIN_MAX_DB) {
      throw new RangeError(`Gain must be finite and between ${GAIN_MIN_DB} and ${GAIN_MAX_DB} dB`);
    }
    const db = Number(operation.db.toFixed(2)) || 0;
    return { type: 'gain', id, enabled, db };
  });
}

function nodeIdentity(node: HistoryNode): string {
  const { operation } = node;
  const parameters = operation.type === 'gain' ? [operation.db] : [];
  return digest(JSON.stringify([
    node.schemaVersion, node.parent, operation.id, operation.enabled, operation.type, ...parameters,
  ]));
}

export function createHistory(nodes: Manifest['nodes'], operations: Operation[]) {
  const next = { ...nodes };
  let parent: string | null = null;
  for (const operation of operations) {
    const node: HistoryNode = { schemaVersion: CONTRACT_VERSION, parent, operation };
    parent = nodeIdentity(node);
    next[parent] ??= node;
  }
  return { nodes: next, tip: parent };
}

export function branchAt(manifest: Manifest, name: string): Branch {
  if (!Object.hasOwn(manifest.branches, name)) throw new Error(`Unknown history branch: ${name}`);
  return manifest.branches[name];
}

export function linearHistory(manifest: Manifest, tip: string | null): HistoryNode[] {
  const nodes: HistoryNode[] = [];
  const visited = new Set<string>();
  while (tip !== null) {
    if (visited.has(tip) || !SHA256_PATTERN.test(tip) || !Object.hasOwn(manifest.nodes, tip)) {
      throw new Error('Broken or cyclic history reference');
    }
    visited.add(tip);
    const node: HistoryNode = manifest.nodes[tip];
    nodes.push(node);
    tip = node.parent;
  }
  return nodes.reverse();
}

export function validateManifest(manifest: Manifest) {
  if (!manifest || manifest.version !== 1) throw new Error('Unsupported project manifest version');
  if (!manifest.source || typeof manifest.source.name !== 'string' ||
      !SHA256_PATTERN.test(manifest.source.fingerprint) || !manifest.nodes ||
      !manifest.branches || !Object.hasOwn(manifest.branches, 'main')) {
    throw new Error('Invalid project manifest');
  }
  for (const [id, node] of Object.entries(manifest.nodes)) {
    const [operation] = normalizeHistory([node.operation]);
    if (node.schemaVersion !== CONTRACT_VERSION || id !== nodeIdentity({ ...node, operation }) ||
        nodeIdentity(node) !== id || (node.parent !== null && !Object.hasOwn(manifest.nodes, node.parent))) {
      throw new Error('Invalid project history node');
    }
  }
  for (const branch of Object.values(manifest.branches)) linearHistory(manifest, branch.tip);
}
