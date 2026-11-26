import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

export const PARSER_SHA256 = '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675';
const HELPER_SHA256 = 'd1b057a35293adf88adeba753c63edc69f1965b4299bc3ba2975b80b783d94f2';
export const SYNTAX_LIMITS = Object.freeze({ bytes: 1024 * 1024, nodes: 50_000, depth: 160, timeoutMs: 8_000 });
const externalNames = Object.freeze({
  mock: Object.freeze(['node:fs', 'node:fs/promises', 'node:path', 'node:crypto']),
  real: Object.freeze(['node:fs', 'node:fs/promises', 'node:path', 'node:crypto']),
});
const loaders = new Set(['require', '__require']);
const roots = new Set(['module', 'exports', 'globalThis', 'global', 'process', 'arguments']);
const dynamicNames = new Set(['eval', 'Function', 'AsyncFunction', 'GeneratorFunction', 'AsyncGeneratorFunction']);
const propertyNames = new Set([...loaders, ...dynamicNames, 'getBuiltinModule', '_load', 'dlopen',
  'binding', '_linkedBinding', 'mainModule', 'constructor']);
const reservedBinding = new Set([...loaders, ...roots, ...dynamicNames]);
const sdkModuleClasses = new Set(['Commands', 'Resources', 'Environment', 'Ui', 'C']);
const wrapperHead = 'function __aopxCommonJS(exports, require, module, __filename, __dirname) {\n';
const wrapperTail = '\n}';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function reject(rule, reason) {
  throw new Error(rule + ': ' + reason);
}

export function sanitizedNodeEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) =>
    !/^(NODE_OPTIONS|NODE_PATH|NODE_TEST_CONTEXT|NODE_V8_COVERAGE|NODE_REPL_EXTERNAL_MODULE|NODE_INSPECT_RESUME_ON_START|LD_PRELOAD|DYLD_INSERT_LIBRARIES|ESBUILD_BINARY_PATH|NPM_CONFIG_NODE_OPTIONS)$/i.test(name)));
}

function decode(bytes) {
  if (!(bytes instanceof Uint8Array)) reject('SP-10', 'Output is not bytes');
  if (bytes.byteLength > SYNTAX_LIMITS.bytes) reject('SP-10', 'Output byte limit exceeded');
  let output;
  try {
    output = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    reject('SP-10', 'Invalid UTF-8');
  }
  if (output.includes('\0')) reject('SP-10', 'NUL in output');
  return output;
}

function parse(output, ts) {
  const methods = ['createSourceFile', 'createProgram', 'forEachChild', 'isIdentifier', 'isStringLiteral',
    'isNoSubstitutionTemplateLiteral', 'isFunctionLike', 'isClassLike', 'isOptionalChain'];
  if (ts?.version !== '5.9.3') reject('SP-10', 'Wrong TypeScript parser version');
  if (methods.some(name => typeof ts[name] !== 'function') || !ts.SyntaxKind || !ts.ScriptKind || !ts.ScriptTarget) {
    reject('SP-10', 'TypeScript parser or binder API unavailable');
  }
  const filename = '/aopx-bundle.js';
  const text = wrapperHead + output + wrapperTail;
  let source;
  try {
    source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  } catch {
    reject('SP-10', 'TypeScript parser threw');
  }
  if (!source || !Array.isArray(source.parseDiagnostics)) reject('SP-10', 'TypeScript parse diagnostics unavailable');
  for (const diagnostic of source.parseDiagnostics) {
    if (diagnostic.code === 1127 && /^\\u(?:d[89a-f][0-9a-f]{2}|\{d[89a-f][0-9a-f]{2}\})/i.test(text.slice(diagnostic.start, diagnostic.start + 10))) {
      reject('SP-10', 'Lone surrogate in identifier');
    }
    if (diagnostic.code === 1487) reject('SP-09', 'Legacy octal escape rejected by the CommonJS syntax check');
    if (diagnostic.code === 1109 && text.startsWith('-->', diagnostic.start - 2)) {
      reject('SP-09', 'Annex B HTML-like comment conflicts with CommonJS parsing');
    }
  }
  if (source.parseDiagnostics.length) reject('SP-10', 'TypeScript rejected the CommonJS wrapper syntax');
  const wrapper = source.statements[0];
  if (source.statements.length !== 1 || !wrapper || !ts.isFunctionDeclaration(wrapper) ||
      wrapper.name?.text !== '__aopxCommonJS' || !wrapper.body || wrapper.body.end !== text.length) {
    reject('SP-09', 'Output escapes the CommonJS function body');
  }
  return { filename, text, source, wrapper };
}

function collectNodes(body, ts) {
  const nodes = [];
  const pending = [{ node: body, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (depth > SYNTAX_LIMITS.depth) reject('SP-10', 'AST depth limit exceeded');
    if (nodes.length >= SYNTAX_LIMITS.nodes) reject('SP-10', 'AST node limit exceeded');
    if (!Number.isInteger(node.kind) || typeof ts.SyntaxKind[node.kind] !== 'string' ||
        node.kind === ts.SyntaxKind.Unknown) reject('SP-10', 'Unknown SyntaxKind');
    nodes.push(node);
    try {
      ts.forEachChild(node, child => { pending.push({ node: child, depth: depth + 1 }); });
    } catch {
      reject('SP-10', 'TypeScript AST traversal threw');
    }
  }
  return nodes;
}

function bind(parsed, ts) {
  const { filename, source } = parsed;
  const host = {
    getSourceFile: name => name === filename ? source : undefined,
    getDefaultLibFileName: () => '',
    writeFile: () => reject('SP-10', 'Binder attempted an output write'),
    getCurrentDirectory: () => '/',
    getCanonicalFileName: name => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: name => name === filename,
    readFile: name => name === filename ? source.text : undefined,
  };
  try {
    const program = ts.createProgram([filename], { allowJs: true, noLib: true, noResolve: true, types: [] }, host);
    const checker = program.getTypeChecker();
    if (typeof checker.getSymbolAtLocation !== 'function' || typeof checker.resolveName !== 'function' || !Array.isArray(source.bindDiagnostics)) {
      reject('SP-10', 'TypeScript binder diagnostics unavailable');
    }
    if (source.bindDiagnostics.length || program.getSyntacticDiagnostics(source).length) {
      reject('SP-10', 'TypeScript binder or grammar diagnostic');
    }
    return checker;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SP-10:')) throw error;
    reject('SP-10', 'TypeScript binder threw');
  }
}

function literalKey(node, ts) {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return null;
}

function property(node, ts) {
  if (ts.isPropertyAccessExpression(node)) return { root: node.expression, key: node.name.text, node: node.name };
  if (ts.isElementAccessExpression(node)) {
    return { root: node.expression, key: literalKey(node.argumentExpression, ts), node: node.argumentExpression };
  }
  return null;
}

function propertyDeclaration(node, ts) {
  if (!(ts.isBindingElement(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) ||
      ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node))) return null;
  const name = ts.isBindingElement(node) ? node.propertyName ?? (ts.isObjectBindingPattern(node.parent) ? node.name : null) : node.name;
  if (!name) return null;
  if (ts.isComputedPropertyName(name)) return literalKey(name.expression, ts);
  return ts.isIdentifier(name) ? name.text : literalKey(name, ts);
}

function isPropertyName(node, ts) {
  const parent = node.parent;
  return (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (parent.name === node && (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent))) ||
    (ts.isBindingElement(parent) && parent.propertyName === node);
}

function localFunctionOwner(node, wrapper, ts) {
  for (let ancestor = node.parent; ancestor && ancestor !== wrapper; ancestor = ancestor.parent) {
    if (ts.isFunctionLike(ancestor) && !ts.isArrowFunction(ancestor) &&
        ((ancestor.body && node.pos >= ancestor.body.pos && node.end <= ancestor.body.end) ||
          ancestor.parameters.some(parameter => node.pos >= parameter.pos && node.end <= parameter.end))) return ancestor;
    if (node.kind === ts.SyntaxKind.ThisKeyword && ts.isPropertyDeclaration(ancestor) && ancestor.initializer &&
        node.pos >= ancestor.initializer.pos) return ancestor;
  }
  return null;
}

function reviewedModuleBinding(declaration, mode, ts) {
  if (!ts.isParameter(declaration) || !ts.isConstructorDeclaration(declaration.parent) ||
      !ts.isIdentifier(declaration.name) || declaration.name.text !== 'module' ||
      declaration.initializer || declaration.dotDotDotToken || declaration.parent.parameters.length !== 1) return false;
  const body = declaration.parent.body;
  const statement = body?.statements[0];
  const assignment = statement && ts.isExpressionStatement(statement) && statement.expression;
  const target = assignment && ts.isBinaryExpression(assignment) && property(assignment.left, ts);
  if (body?.statements.length !== 1 || !target || target.root.kind !== ts.SyntaxKind.ThisKeyword ||
      target.key !== 'module' || assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isIdentifier(assignment.right) || assignment.right.text !== 'module') return false;
  const container = declaration.parent.parent;
  const name = container.name?.text ?? (ts.isVariableDeclaration(container.parent) ? container.parent.name?.text : undefined);
  if (!name || !sdkModuleClasses.has(name)) return false;
  return name === 'C' ? mode === 'mock' : mode === 'real';
}

function inOperator(node, source, ts) {
  if (!ts.isBinaryExpression(node) && !ts.isPrefixUnaryExpression(node) && !ts.isPostfixUnaryExpression(node)) return false;
  const token = ts.isBinaryExpression(node) ? node.operatorToken : node;
  const start = ts.isPostfixUnaryExpression(node) ? node.end - 2 : token.getStart(source);
  return source.text.startsWith('<!--', start) || source.text.startsWith('-->', start);
}

function lexCompatibility(node, source, ts) {
  if (inOperator(node, source, ts)) reject('SP-09', 'Annex B HTML-like comment conflicts with CommonJS parsing');
  const member = property(node, ts);
  const name = member?.node ?? (node.name && ts.isComputedPropertyName(node.name) ? node.name.expression : node.name);
  if (name && ts.isStringLiteral(name) && /(?:^|[^\\])(?:\\\\)*\\(?:[1-7]|0[0-9])/.test(name.getText(source))) {
    reject('SP-09', 'Legacy octal escape in a property key');
  }
}

function findHelpers(nodes, parsed, checker, ts) {
  const allowed = new Set();
  for (const node of nodes) {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== '__commonJS') continue;
    const arrow = node.initializer;
    const fn = arrow && ts.isArrowFunction(arrow) && arrow.body;
    const parent = node.parent?.parent;
    if (!fn || !ts.isFunctionExpression(fn) || fn.name?.text !== '__require' ||
        !ts.isVariableStatement(parent) || parent.parent !== parsed.wrapper.body ||
        arrow.parameters.length !== 2 || arrow.parameters.some((p, i) =>
          !ts.isIdentifier(p.name) || p.name.text !== ['cb', 'mod'][i] || p.initializer || p.dotDotDotToken) ||
        node.parent.declarations.length !== 1 || digest(fn.getText(parsed.source)) !== HELPER_SHA256) {
      reject('SP-07', 'Unrecognized __commonJS helper structure or digest');
    }
    const symbol = checker.getSymbolAtLocation(fn.name);
    if (!symbol || !symbol.declarations?.includes(fn) || allowed.size) reject('SP-07', 'Unexpected helper binding');
    allowed.add(symbol);
  }
  return allowed;
}

function rootUse(node, kind, context) {
  const { mode, ts } = context;
  const keys = [];
  let current = node;
  for (let member = property(current.parent, ts); member?.root === current; member = property(current.parent, ts)) {
    if (ts.isOptionalChain(current.parent) || !member.key) {
      reject('SP-04', 'Ambient root value or nonliteral/optional access: ' + kind);
    }
    keys.push(member.key);
    current = current.parent;
  }
  if (!keys.length) reject('SP-04', 'Ambient root value escape: ' + kind);
  const identifierKey = key => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) && !propertyNames.has(key);
  if (kind === 'module' && keys[0] === 'exports' &&
      (keys.length === 1 || keys.length === 2 && identifierKey(keys[1]))) return;
  if (kind === 'exports' && keys.length === 1 && identifierKey(keys[0])) return;
  if (kind === 'globalThis' && keys[0] === '__t1Mock') {
    if (mode !== 'mock') reject('SP-12', 'Mock ambient path in real mode');
    if (keys.length === 1 || keys.length === 2 && ['calls', 'context'].includes(keys[1]) ||
        keys.length === 3 && keys[1] === 'calls' && keys[2] === 'push') return;
  }
  reject('SP-04', 'Unenrolled ambient access path: ' + kind + '.' + keys.join('.'));
}

function isReflectedKeyCall(node, ts) {
  if (!ts.isCallExpression(node)) return false;
  const method = property(node.expression, ts);
  return method && ts.isIdentifier(method.root) && (method.root.text === 'Reflect' ||
    (method.root.text === 'Object' && ['getOwnPropertyDescriptor', 'getOwnPropertyDescriptors'].includes(method.key)));
}

function checkIdentifier(node, context) {
  const { checker, helpers, mode, ts, wrapperParameters, wrapper } = context;
  const name = node.text;
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name)) {
    reject('SP-10', 'Lone surrogate in identifier');
  }
  if (!reservedBinding.has(name) || isPropertyName(node, ts)) return;
  const declarationName = node.parent.name === node && !ts.isShorthandPropertyAssignment(node.parent);
  const symbol = declarationName ? checker.getSymbolAtLocation(node) : checker.resolveName(name, node, ts.SymbolFlags.Value, false);
  const local = symbol?.declarations?.some(d => !wrapperParameters.has(d));
  if (local) {
    if (name === '__require' && helpers.has(symbol) && symbol.declarations.some(d => d.name === node)) return;
    if (name === 'module' && symbol.declarations.every(d => reviewedModuleBinding(d, mode, ts))) return;
    reject('SP-06', 'Shadowed reserved binding: ' + name);
  }
  if (dynamicNames.has(name)) reject('SP-05', 'Dynamic-code capability: ' + name);
  if (loaders.has(name)) {
    const parent = node.parent;
    if (ts.isTypeOfExpression(parent) && parent.expression === node) return;
    if (name === 'require' && ts.isCallExpression(parent) && parent.expression === node && !ts.isOptionalChain(parent)) {
      if (parent.arguments.length !== 1 || !ts.isStringLiteral(parent.arguments[0]) ||
          !externalNames[mode].includes(parent.arguments[0].text)) reject('SP-01', 'Nonliteral or unenrolled require external');
      context.imports.push(parent.arguments[0].text);
      return;
    }
    reject('SP-02', 'Loader used outside a direct external call or typeof');
  }
  if (name === 'arguments' && localFunctionOwner(node, wrapper, ts)) return;
  rootUse(node, name, context);
}

function checkNode(node, context) {
  const { ts, source, wrapper } = context;
  const kinds = ts.SyntaxKind;
  lexCompatibility(node, source, ts);
  if (node.kind === kinds.WithStatement || node.kind === kinds.ImportKeyword || node.kind === kinds.MetaProperty ||
      node.kind === kinds.ImportDeclaration || node.kind === kinds.ExportDeclaration ||
      node.kind === kinds.ExportAssignment || node.kind === kinds.ImportEqualsDeclaration ||
      node.kind === kinds.ExportKeyword) reject('SP-05', 'Dynamic code, module syntax, or with');
  const access = property(node, ts);
  const key = access ? access.key : propertyDeclaration(node, ts);
  if (dynamicNames.has(key)) reject('SP-05', 'Dynamic-code property key: ' + key);
  if (propertyNames.has(key)) reject('SP-03', 'Reserved property key: ' + key);
  if (isReflectedKeyCall(node, ts) &&
      node.arguments.some(arg => propertyNames.has(literalKey(arg, ts)))) reject('SP-03', 'Reserved reflected property key');
  if (ts.isIdentifier(node)) checkIdentifier(node, context);
  if (node.kind === kinds.ThisKeyword && !localFunctionOwner(node, wrapper, ts)) rootUse(node, 'this', context);
}

export function validateSyntax(bytes, ts, mode) {
  if (!Object.hasOwn(externalNames, mode)) reject('SP-12', 'Unknown validation mode');
  const output = decode(bytes);
  const parsed = parse(output, ts);
  const nodes = collectNodes(parsed.wrapper.body, ts);
  const checker = bind(parsed, ts);
  const helpers = findHelpers(nodes, parsed, checker, ts);
  const imports = [];
  const context = { ...parsed, checker, helpers, imports, mode, ts, wrapperParameters: new Set(parsed.wrapper.parameters) };
  try {
    for (const node of nodes) checkNode(node, context);
  } catch (error) {
    if (error instanceof Error && /^SP-\d\d:/.test(error.message)) throw error;
    reject('SP-10', 'Policy traversal threw');
  }
  // Compile a script for grammar validation only. No Script is ever run.
  try {
    new vm.Script(parsed.text, { filename: 'aopx-bundle.cjs' });
  } catch {
    reject('SP-09', 'V8 rejected the CommonJS function-body grammar');
  }
  return imports.sort();
}

export function verifySyntaxExternals(actual, metafileExternals) {
  if (!Array.isArray(metafileExternals) ||
      JSON.stringify([...actual].sort()) !== JSON.stringify([...metafileExternals].sort())) {
    reject('SP-01', 'AST and metafile external multisets differ');
  }
}

export function readPinnedParser(parserPath) {
  let bytes;
  try {
    bytes = readFileSync(parserPath);
  } catch {
    reject('SP-10', 'TypeScript parser file unreadable');
  }
  if (digest(bytes) !== PARSER_SHA256) reject('SP-10', 'Wrong TypeScript parser file hash');
  return createRequire(import.meta.url)(parserPath);
}

export function validateInWorker(bytes, parserPath, mode) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > SYNTAX_LIMITS.bytes) {
    reject('SP-10', 'Output byte limit exceeded');
  }
  return new Promise((resolve, rejectWorker) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { bytes, parserPath, mode }, env: sanitizedNodeEnv(), execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      rejectWorker(new Error('SP-10: Parser worker timeout'));
    }, SYNTAX_LIMITS.timeoutMs);
    const finish = (error, imports) => {
      clearTimeout(timer);
      if (error) rejectWorker(error);
      else resolve(imports);
    };
    worker.once('message', result => {
      if (result && Array.isArray(result.imports)) finish(null, result.imports);
      else finish(new Error(result?.error ?? 'SP-10: Invalid worker result'));
    });
    worker.once('error', () => finish(new Error('SP-10: Parser worker failed')));
    worker.once('exit', () => finish(new Error('SP-10: Parser worker exited without a result')));
  });
}

if (!isMainThread && parentPort && workerData?.parserPath) {
  try {
    const { bytes, parserPath, mode } = workerData;
    parentPort.postMessage({ imports: validateSyntax(bytes, readPinnedParser(parserPath), mode) });
  } catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : 'SP-10: Validation failed' });
  }
}
