import { defineRule, type ESTree } from '@oxlint/plugins';

import { chainEndsWith, getCallChain, getMemberChain, unwrapExpression } from '../utils/ast.ts';
import { isTestFile, testFileOptionsSchema } from '../utils/test-files.ts';

const message = 'Do not assert on elapsed wall-clock time in tests. Control time with fake timers or assert on behavior.';

const comparisonOperators = new Set(['!=', '!==', '<', '<=', '==', '===', '>', '>=']);

type ClockState = {
  deltaNames: Set<string>;
  wallClockNames: Set<string>;
};

const createClockState = (): ClockState => ({
  deltaNames: new Set(),
  wallClockNames: new Set(),
});

const isWallClock = ({ node, state }: { node: ESTree.Node; state: ClockState }) => {
  const current = unwrapExpression(node);

  if (current.type === 'Identifier') {
    return state.wallClockNames.has(current.name);
  }

  if (current.type !== 'CallExpression' || current.arguments.length > 0) {
    return false;
  }

  const chain = getCallChain(current);

  return (chain?.length === 2 && chain[0] === 'Date' && chain[1] === 'now') || chainEndsWith(chain, ['performance', 'now']);
};

const isDelta = ({ node, state }: { node: ESTree.Node; state: ClockState }): boolean => {
  const current = unwrapExpression(node);

  if (current.type === 'Identifier') {
    return state.deltaNames.has(current.name);
  }

  return (
    current.type === 'BinaryExpression' &&
    current.operator === '-' &&
    isWallClock({ node: current.left, state }) &&
    isWallClock({ node: current.right, state })
  );
};

const trackBinding = ({ name, state, value }: { name: string; state: ClockState; value: ESTree.Node }) => {
  state.wallClockNames.delete(name);
  state.deltaNames.delete(name);

  if (isWallClock({ node: value, state })) {
    state.wallClockNames.add(name);
  } else if (isDelta({ node: value, state })) {
    state.deltaNames.add(name);
  }
};

const isAssertionCall = (node: ESTree.CallExpression) => {
  const chain = getMemberChain(node.callee);

  if (chain === null) {
    return false;
  }

  return chain[0] === 'expect' || chain.includes('assert');
};

export const noWallClockAssertionRule = defineRule({
  createOnce(context) {
    let state = createClockState();

    return {
      before() {
        state = createClockState();

        return isTestFile(context);
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && node.init !== null) {
          trackBinding({ name: node.id.name, state, value: node.init });
        }
      },
      AssignmentExpression(node) {
        if (node.operator === '=' && node.left.type === 'Identifier') {
          trackBinding({ name: node.left.name, state, value: node.right });
        }
      },
      BinaryExpression(node) {
        if (comparisonOperators.has(node.operator) && (isDelta({ node: node.left, state }) || isDelta({ node: node.right, state }))) {
          context.report({ message, node });
        }
      },
      CallExpression(node) {
        if (!isAssertionCall(node)) {
          return;
        }

        const delta = node.arguments.find(argument => isDelta({ node: argument, state }));

        if (delta !== undefined) {
          context.report({ message, node: delta });
        }
      },
    };
  },
  meta: {
    docs: {
      description: 'Disallow assertions and comparisons on Date.now() or performance.now() deltas in tests.',
    },
    messages: {
      noWallClockAssertion: message,
    },
    schema: testFileOptionsSchema,
    type: 'problem',
  },
});
