/**
 * Branch-capable version graph (DAG of immutable nodes).
 *
 * - A root node exists per imported source: id `src:<fingerprint>`.
 * - An operation node records (parent node, normalized operation snapshot). Its id is the hash of
 *   exactly those two things, so the same chain prefix always resolves to the same nodes: editing
 *   operation N creates new nodes for N and its descendants only, and the prefix is shared.
 * - Nodes are never mutated or deleted by edits. A branch is a named, mutable pointer (head) with a
 *   revision counter that increments on every commit; renders use the revision to detect staleness.
 * - The Alpha 0.1 linear operation list is a projection: the root->head path of one branch.
 */
import { hashJson } from './hash.ts';
import type { NormalizedOperation } from './operations.ts';

export interface RootNode {
  kind: 'source';
  id: string;
  parent: null;
  sourceFingerprint: string;
}

export interface OperationNode {
  kind: 'operation';
  id: string;
  parent: string;
  sourceFingerprint: string;
  operation: NormalizedOperation;
}

export type VersionNode = RootNode | OperationNode;

export interface BranchRef {
  name: string;
  head: string;
  /** Increments on every commit to this branch. */
  revision: number;
  updatedAt: string;
}

export interface GraphSnapshot {
  nodes: VersionNode[];
  branches: BranchRef[];
}

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphError';
  }
}

export const rootId = (fingerprint: string) => `src:${fingerprint}`;

export function operationNodeId(parent: string, op: NormalizedOperation): string {
  return `n:${hashJson({ parent, operation: op })}`;
}

export class VersionGraph {
  private readonly nodes = new Map<string, VersionNode>();
  private readonly branches = new Map<string, BranchRef>();

  addSource(fingerprint: string): string {
    const id = rootId(fingerprint);
    if (!this.nodes.has(id)) this.nodes.set(id, { kind: 'source', id, parent: null, sourceFingerprint: fingerprint });
    return id;
  }

  node(id: string): VersionNode {
    const n = this.nodes.get(id);
    if (!n) throw new GraphError(`Unknown node ${id}.`);
    return n;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /** Append one operation under `parent`, reusing the node if this exact (parent, op) exists. */
  append(parent: string, op: NormalizedOperation): string {
    const p = this.node(parent);
    const id = operationNodeId(parent, op);
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { kind: 'operation', id, parent, sourceFingerprint: p.sourceFingerprint, operation: structuredClone(op) });
    }
    return id;
  }

  /** Build the chain for `ops` from `fromNode` (default: source root) and point `branch` at it. */
  commit(branch: string, sourceFingerprint: string, ops: NormalizedOperation[], fromNode?: string): BranchRef {
    const ids = new Set(ops.map((o) => o.id));
    if (ids.size !== ops.length) throw new GraphError('Operation ids within a plan must be unique.');
    let head = fromNode ?? rootId(sourceFingerprint);
    if (this.node(head).sourceFingerprint !== sourceFingerprint) throw new GraphError('Start node belongs to a different source.');
    for (const op of ops) head = this.append(head, op);
    return this.setHead(branch, head);
  }

  /** Create a branch pointing at an existing node (e.g. an earlier node of another branch). */
  createBranch(name: string, at: string): BranchRef {
    if (this.branches.has(name)) throw new GraphError(`Branch '${name}' already exists.`);
    this.node(at);
    return this.setHead(name, at);
  }

  private setHead(name: string, head: string): BranchRef {
    const prev = this.branches.get(name);
    const ref: BranchRef = { name, head, revision: (prev?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    this.branches.set(name, ref);
    return { ...ref };
  }

  branch(name: string): BranchRef {
    const b = this.branches.get(name);
    if (!b) throw new GraphError(`Unknown branch '${name}'.`);
    return { ...b };
  }

  branchNames(): string[] {
    return [...this.branches.keys()].sort();
  }

  /** Root..node path (inclusive). */
  path(id: string): VersionNode[] {
    const out: VersionNode[] = [];
    let cur: VersionNode | undefined = this.node(id);
    while (cur) {
      out.push(cur);
      cur = cur.parent === null ? undefined : this.node(cur.parent);
    }
    return out.reverse();
  }

  /** Linear projection of a branch: its operation nodes in order. */
  linear(branch: string): OperationNode[] {
    return this.path(this.branch(branch).head).filter((n): n is OperationNode => n.kind === 'operation');
  }

  children(id: string): VersionNode[] {
    return [...this.nodes.values()].filter((n) => n.parent === id);
  }

  allNodes(): VersionNode[] {
    return [...this.nodes.values()];
  }

  toJSON(): GraphSnapshot {
    return {
      nodes: [...this.nodes.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
      branches: [...this.branches.values()].sort((a, b) => (a.name < b.name ? -1 : 1)),
    };
  }

  static fromJSON(snap: GraphSnapshot): VersionGraph {
    const g = new VersionGraph();
    for (const n of snap.nodes) g.nodes.set(n.id, n);
    // integrity: every parent exists and every operation node id matches its content
    for (const n of snap.nodes) {
      if (n.kind === 'source') {
        if (n.id !== rootId(n.sourceFingerprint)) throw new GraphError(`Corrupt root node ${n.id}.`);
      } else {
        if (!g.nodes.has(n.parent)) throw new GraphError(`Node ${n.id} references missing parent ${n.parent}.`);
        if (operationNodeId(n.parent, n.operation) !== n.id) throw new GraphError(`Node ${n.id} content does not match its id.`);
      }
    }
    for (const b of snap.branches) {
      if (!g.nodes.has(b.head)) throw new GraphError(`Branch '${b.name}' references missing head ${b.head}.`);
      g.branches.set(b.name, { ...b });
    }
    return g;
  }
}
