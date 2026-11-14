import { defineRule, type Comment, type Context, type ESTree } from '@oxlint/plugins';

import { findProperties, getMemberChain, isFunctionNode, isStringLike, unwrapExpression } from '../utils/ast.ts';
import { getTestChain, testRootNames } from '../utils/test-calls.ts';
import { isTestFile, testFileOptionsSchema } from '../utils/test-files.ts';

const message = 'Add a `// quarantine: <issue reference> <reason>` comment on the line above this skipped or pending test.';

const quarantinePattern = /^\s*quarantine:\s+(?:[A-Z][A-Z0-9]*-\d+|(?:[\w.-]+\/[\w.-]+)?#\d+|https?:\/\/\S+)\s+\S/u;

const skipModifierNames = new Set(['fixme', 'skip', 'todo']);
const conditionalModifierNames = new Set(['fixme', 'skip']);
const chainModifierNames = new Set([
  'concurrent',
  'describe',
  'each',
  'fails',
  'fixme',
  'for',
  'only',
  'parallel',
  'sequential',
  'serial',
  'skip',
  'todo',
]);
const skippedAliasNames = new Set(['xdescribe', 'xit', 'xtest']);
const skipOptionKeys = new Set(['skip', 'todo']);

const isUnconditionalSkip = (node: ESTree.CallExpression) => {
  const first = node.arguments[0];

  if (first === undefined || isStringLike(first)) {
    return true;
  }

  const current = unwrapExpression(first);

  return current.type === 'Literal' && current.value === true;
};

const isSkipModifierCall = (node: ESTree.CallExpression) => {
  const chain = getMemberChain(node.callee);

  if (chain === null) {
    return false;
  }

  if (chain.length === 1) {
    return skippedAliasNames.has(chain[0] as string);
  }

  const modifiers = chain.slice(1);

  if (!testRootNames.has(chain[0] as string) || !modifiers.some(part => skipModifierNames.has(part))) {
    return false;
  }

  if (!modifiers.every(part => chainModifierNames.has(part))) {
    return false;
  }

  return !conditionalModifierNames.has(chain.at(-1) as string) || isUnconditionalSkip(node);
};

const isSkipOption = (property: ESTree.ObjectProperty) => {
  const value = unwrapExpression(property.value);

  return (value.type === 'Literal' && value.value === true) || isStringLike(value);
};

const findSkipOption = (node: ESTree.CallExpression) => {
  if (getTestChain(node) === null) {
    return null;
  }

  for (const argument of node.arguments.slice(1)) {
    const option = findProperties(argument, skipOptionKeys).find(isSkipOption);

    if (option !== undefined) {
      return option;
    }
  }

  return null;
};

const getStatementLine = (node: ESTree.Node) => {
  let current: ESTree.Node | null = node.parent;

  while (current !== null && current.type !== 'Program' && !isFunctionNode(current)) {
    if (current.type.endsWith('Statement') || current.type.endsWith('Declaration')) {
      return current.loc.start.line;
    }

    current = current.parent;
  }

  return node.loc.start.line;
};

const hasQuarantineComment = ({ comments, node }: { comments: Map<number, Comment>; node: ESTree.Node }) =>
  [node.loc.start.line, getStatementLine(node)].some(line => {
    const comment = comments.get(line - 1);

    return comment !== undefined && comment.type === 'Line' && quarantinePattern.test(comment.value);
  });

const collectCommentsByEndLine = (context: Context) =>
  new Map(context.sourceCode.getAllComments().map(comment => [comment.loc.end.line, comment] as const));

export const requireSkipReasonRule = defineRule({
  createOnce(context) {
    let comments = new Map<number, Comment>();

    return {
      before() {
        return isTestFile(context);
      },
      Program() {
        comments = collectCommentsByEndLine(context);
      },
      CallExpression(node) {
        if (!isSkipModifierCall(node) && findSkipOption(node) === null) {
          return;
        }

        if (!hasQuarantineComment({ comments, node })) {
          context.report({ message, node });
        }
      },
    };
  },
  meta: {
    docs: {
      description: 'Require a quarantine comment with an issue reference and a reason for skipped and pending tests.',
    },
    messages: {
      requireSkipReason: message,
    },
    schema: testFileOptionsSchema,
    type: 'problem',
  },
});
