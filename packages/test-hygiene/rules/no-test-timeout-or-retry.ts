import { defineRule, type Context, type ESTree } from '@oxlint/plugins';

import { findProperties, getCallChain, getPropertyName, isFunctionNode, unwrapExpression } from '../utils/ast.ts';
import { getTestChain } from '../utils/test-calls.ts';
import { isTestFile, testFileOptionsSchema } from '../utils/test-files.ts';

const timeoutMessage = 'Do not override test timeouts. Make the test fast and deterministic instead.';
const retryMessage = 'Do not retry tests. Fix the source of the flakiness instead.';

const timeoutKeys = new Set(['timeout']);
const retryKeys = new Set(['retries', 'retry']);
const testOptionKeys = new Set([...retryKeys, ...timeoutKeys]);
const configKeys = new Set(['retry', 'testTimeout']);
const describeConfigureKeys = new Set([...retryKeys, ...timeoutKeys]);

const reportProperties = ({ context, keys, node }: { context: Context; keys: ReadonlySet<string>; node: ESTree.Node }) => {
  for (const property of findProperties(node, keys)) {
    context.report({ message: retryKeys.has(getPropertyName(property) ?? '') ? retryMessage : timeoutMessage, node: property });
  }
};

const checkTestCall = ({ context, node }: { context: Context; node: ESTree.CallExpression }) => {
  const functionIndex = node.arguments.findIndex(argument => isFunctionNode(unwrapExpression(argument)));

  node.arguments.forEach((argument, index) => {
    if (index === 0) {
      return;
    }

    const current = unwrapExpression(argument);

    if (current.type === 'ObjectExpression') {
      reportProperties({ context, keys: testOptionKeys, node: current });

      return;
    }

    if (functionIndex > 0 && index > functionIndex && !isFunctionNode(current) && current.type !== 'SpreadElement') {
      context.report({ message: timeoutMessage, node: argument });
    }
  });
};

const checkConfigCall = ({ context, node }: { context: Context; node: ESTree.CallExpression }) => {
  const chain = getCallChain(node);

  if (chain === null) {
    return;
  }

  const name = chain.join('.');

  if (name === 'test.setTimeout' || name === 'jest.setTimeout') {
    context.report({ message: timeoutMessage, node });

    return;
  }

  if (name === 'jest.retryTimes') {
    context.report({ message: retryMessage, node });

    return;
  }

  const options = node.arguments[0];

  if (options === undefined) {
    return;
  }

  if (name === 'vi.setConfig') {
    reportProperties({ context, keys: configKeys, node: options });
  }

  if (name === 'test.describe.configure') {
    reportProperties({ context, keys: describeConfigureKeys, node: options });
  }
};

export const noTestTimeoutOrRetryRule = defineRule({
  createOnce(context) {
    return {
      before() {
        return isTestFile(context);
      },
      CallExpression(node) {
        if (getTestChain(node) === null) {
          checkConfigCall({ context, node });

          return;
        }

        checkTestCall({ context, node });
      },
    };
  },
  meta: {
    docs: {
      description: 'Disallow per-test timeout overrides and test retries.',
    },
    messages: {
      noTestRetry: retryMessage,
      noTestTimeout: timeoutMessage,
    },
    schema: testFileOptionsSchema,
    type: 'problem',
  },
});
