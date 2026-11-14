import { defineRule, type ESTree } from '@oxlint/plugins';

import { isFunctionNode } from '../utils/ast.ts';
import { isTestFile, testFileOptionsSchema } from '../utils/test-files.ts';
import { collectTimerPromiseImport, createTimerState, getAwaitedWaitKind, isFakeTimerCall, type WaitKind } from '../utils/timers.ts';

const message = 'Do not poll in a sleep loop in tests. Await the event or promise that signals the condition.';

const loopTypes = new Set(['DoWhileStatement', 'ForStatement', 'WhileStatement']);

const findEnclosingLoop = (node: ESTree.Node): ESTree.Node | null => {
  let current: ESTree.Node | null = node.parent;

  while (current !== null && current.type !== 'Program' && !isFunctionNode(current)) {
    if (loopTypes.has(current.type)) {
      return current;
    }

    current = current.parent;
  }

  return null;
};

export const noPollingLoopRule = defineRule({
  createOnce(context) {
    let loops = new Map<ESTree.Node, WaitKind>();
    let state = createTimerState();

    return {
      before() {
        loops = new Map();
        state = createTimerState();

        return isTestFile(context);
      },
      ImportDeclaration(node) {
        collectTimerPromiseImport({ node, state });
      },
      CallExpression(node) {
        if (isFakeTimerCall(node)) {
          state.fakeTimers = true;
        }
      },
      AwaitExpression(node) {
        const kind = getAwaitedWaitKind({ node: node.argument, state });

        if (kind === null) {
          return;
        }

        const loop = findEnclosingLoop(node);

        if (loop !== null && loops.get(loop) !== 'browser') {
          loops.set(loop, kind);
        }
      },
      'Program:exit'() {
        for (const [loop, kind] of loops) {
          if (kind === 'browser' || !state.fakeTimers) {
            context.report({ message, node: loop });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description: 'Disallow loops in tests that sleep between checks of a condition.',
    },
    messages: {
      noPollingLoop: message,
    },
    schema: testFileOptionsSchema,
    type: 'problem',
  },
});
