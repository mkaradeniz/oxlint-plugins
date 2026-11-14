import type { ESTree } from '@oxlint/plugins';

import { getMemberChain, isStringLike, unwrapExpression } from './ast.ts';

export const testRootNames = new Set(['describe', 'it', 'suite', 'test']);

const testModifierNames = new Set(['concurrent', 'describe', 'fails', 'fixme', 'only', 'parallel', 'sequential', 'serial', 'skip', 'todo']);

const tableModifierNames = new Set(['each', 'for', 'runIf', 'skipIf']);

export type TestChain = {
  chain: Array<string>;
  node: ESTree.CallExpression;
};

const isTestModifierChain = (chain: Array<string>) =>
  testRootNames.has(chain[0] as string) && chain.slice(1).every(part => testModifierNames.has(part));

const isSubtestChain = ({ chain, node }: { chain: Array<string>; node: ESTree.CallExpression }) => {
  const title = node.arguments[0];

  return chain.length === 2 && chain[1] === 'test' && title !== undefined && isStringLike(title);
};

/**
 * Returns the modifier chain of a call that declares a test or a suite, such as `it.only.each(table)(name, fn)`.
 */
export const getTestChain = (node: ESTree.CallExpression): TestChain | null => {
  const callee = unwrapExpression(node.callee);

  if (callee.type === 'CallExpression') {
    const tableChain = getMemberChain(callee.callee);

    if (tableChain === null || !tableModifierNames.has(tableChain.at(-1) as string)) {
      return null;
    }

    const baseChain = tableChain.slice(0, -1);

    return isTestModifierChain(baseChain) ? { chain: baseChain, node } : null;
  }

  const chain = getMemberChain(callee);

  if (chain === null) {
    return null;
  }

  if (isTestModifierChain(chain) || isSubtestChain({ chain, node })) {
    return { chain, node };
  }

  return null;
};
