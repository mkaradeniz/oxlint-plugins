import { defineRule, type ESTree } from '@oxlint/plugins';

import { isTestFile, testFileOptionsSchema } from '../utils/test-files.ts';
import {
  collectTimerPromiseImport,
  createTimerState,
  getAwaitedWaitKind,
  isBrowserTimeoutCall,
  isFakeTimerCall,
  isPromiseTimeoutExpression,
  type WaitKind,
} from '../utils/timers.ts';

const message = 'Do not wait for real time in tests. Wait for the observable condition or use fake timers.';

type Candidate = {
  kind: WaitKind;
  node: ESTree.Node;
};

export const noRealTimeWaitRule = defineRule({
  createOnce(context) {
    let candidates: Array<Candidate> = [];
    let state = createTimerState();

    return {
      before() {
        candidates = [];
        state = createTimerState();

        return isTestFile(context);
      },
      ImportDeclaration(node) {
        collectTimerPromiseImport({ node, state });
      },
      NewExpression(node) {
        if (isPromiseTimeoutExpression(node)) {
          candidates.push({ kind: 'timer', node });
        }
      },
      CallExpression(node) {
        if (isFakeTimerCall(node)) {
          state.fakeTimers = true;
        }

        if (isBrowserTimeoutCall(node)) {
          candidates.push({ kind: 'browser', node });
        }
      },
      AwaitExpression(node) {
        if (node.argument.type === 'CallExpression' && getAwaitedWaitKind({ node: node.argument, state }) === 'timer') {
          candidates.push({ kind: 'timer', node: node.argument });
        }
      },
      'Program:exit'() {
        for (const candidate of candidates) {
          if (candidate.kind === 'browser' || !state.fakeTimers) {
            context.report({ message, node: candidate.node });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description: 'Disallow real-time waits such as sleeps, setTimeout promises, and page.waitForTimeout in tests.',
    },
    messages: {
      noRealTimeWait: message,
    },
    schema: testFileOptionsSchema,
    type: 'problem',
  },
});
