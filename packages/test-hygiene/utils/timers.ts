import type { ESTree } from '@oxlint/plugins';

import { chainEndsWith, getCallChain, getMemberChain, isFunctionNode, unwrapExpression } from './ast.ts';

/**
 * `timer` waits use the JavaScript timer queue, so fake timers can control them.
 * `browser` waits run in a real browser and fake timers never control them.
 */
export type WaitKind = 'browser' | 'timer';

export type TimerState = {
  fakeTimers: boolean;
  timerPromiseNames: Set<string>;
};

const sleepHelperNames = new Set(['delay', 'sleep']);
const timerPromiseSources = new Set(['node:timers/promises', 'timers/promises']);
const globalObjectNames = new Set(['global', 'globalThis', 'self', 'window']);

export const createTimerState = (): TimerState => ({
  fakeTimers: false,
  timerPromiseNames: new Set(),
});

export const collectTimerPromiseImport = ({ node, state }: { node: ESTree.ImportDeclaration; state: TimerState }) => {
  if (!timerPromiseSources.has(node.source.value)) {
    return;
  }

  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'setTimeout') {
      state.timerPromiseNames.add(specifier.local.name);
    }
  }
};

export const isFakeTimerCall = (node: ESTree.CallExpression) => {
  const chain = getCallChain(node);

  return (
    chainEndsWith(chain, ['useFakeTimers']) || chainEndsWith(chain, ['timers', 'enable']) || chainEndsWith(chain, ['FakeTimers', 'install'])
  );
};

const isGlobalSetTimeout = (callee: ESTree.Node) => {
  const chain = getMemberChain(callee);

  if (chain === null || chain.at(-1) !== 'setTimeout') {
    return false;
  }

  return chain.length === 1 || (chain.length === 2 && globalObjectNames.has(chain[0] as string));
};

const callsIdentifier = (node: ESTree.Node, name: string): boolean => {
  const current = unwrapExpression(node);

  if (current.type === 'Identifier') {
    return current.name === name;
  }

  if (current.type === 'CallExpression') {
    const callee = unwrapExpression(current.callee);

    return callee.type === 'Identifier' && callee.name === name;
  }

  if (isFunctionNode(current) && current.body !== null) {
    if (current.body.type !== 'BlockStatement') {
      return callsIdentifier(current.body, name);
    }

    return current.body.body.some(statement => statement.type === 'ExpressionStatement' && callsIdentifier(statement.expression, name));
  }

  return false;
};

const getExecutorExpressions = (executor: ESTree.ArrowFunctionExpression | ESTree.Function): Array<ESTree.Node> => {
  if (executor.body === null) {
    return [];
  }

  if (executor.body.type !== 'BlockStatement') {
    return [executor.body];
  }

  return executor.body.body.flatMap(statement => {
    if (statement.type === 'ExpressionStatement') {
      return [statement.expression];
    }

    if (statement.type === 'ReturnStatement' && statement.argument !== null) {
      return [statement.argument];
    }

    return [];
  });
};

const isPromiseTimeout = (node: ESTree.NewExpression) => {
  const callee = unwrapExpression(node.callee);
  const executor = node.arguments[0];

  if (callee.type !== 'Identifier' || callee.name !== 'Promise' || executor === undefined || !isFunctionNode(executor)) {
    return false;
  }

  const resolveParam = executor.params[0];

  if (resolveParam?.type !== 'Identifier') {
    return false;
  }

  return getExecutorExpressions(executor).some(expression => {
    const current = unwrapExpression(expression);

    if (current.type !== 'CallExpression' || !isGlobalSetTimeout(current.callee)) {
      return false;
    }

    const handler = current.arguments[0];

    return handler !== undefined && callsIdentifier(handler, resolveParam.name);
  });
};

/**
 * Returns the wait kind of an expression that waits for real time when it is awaited.
 */
export const getAwaitedWaitKind = ({ node, state }: { node: ESTree.Node; state: TimerState }): WaitKind | null => {
  const current = unwrapExpression(node);

  if (current.type === 'NewExpression') {
    return isPromiseTimeout(current) ? 'timer' : null;
  }

  if (current.type !== 'CallExpression') {
    return null;
  }

  const chain = getCallChain(current);

  if (chain === null) {
    return null;
  }

  if (chain.length > 1 && chain.at(-1) === 'waitForTimeout') {
    return 'browser';
  }

  if (chain.length === 1 && (sleepHelperNames.has(chain[0] as string) || state.timerPromiseNames.has(chain[0] as string))) {
    return 'timer';
  }

  return null;
};

export const isPromiseTimeoutExpression = (node: ESTree.NewExpression) => isPromiseTimeout(node);

export const isBrowserTimeoutCall = (node: ESTree.CallExpression) => {
  const chain = getCallChain(node);

  return chain !== null && chain.length > 1 && chain.at(-1) === 'waitForTimeout';
};
