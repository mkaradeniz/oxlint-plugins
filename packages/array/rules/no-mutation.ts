import { defineRule, type ESTree, type Ranged } from '@oxlint/plugins';

type MutationMethod = keyof typeof methodBehaviors;

type MethodInfo = {
  computed: boolean;
  member: ESTree.MemberExpression;
  method: MutationMethod;
};

type NodeWithParent = Ranged & {
  parent?: ESTree.Node | null;
};

type FixInput = {
  call: ESTree.CallExpression;
  context: Parameters<NonNullable<Parameters<typeof defineRule>[0]['create']>>[0];
  info: MethodInfo;
};

const methodBehaviors = {
  copyWithin: {
    message: 'Avoid mutating arrays with copyWithin(). Prefer an immutable array operation.',
  },
  fill: {
    message: 'Avoid mutating arrays with fill(). Prefer an immutable array operation.',
  },
  pop: {
    message: 'Avoid mutating arrays with pop(). Prefer at() or slice().',
    readReplacement: 'at(-1)',
    statementReplacement: 'slice(0, -1)',
  },
  push: {
    message: 'Avoid mutating arrays with push(). Prefer array spreading or concat().',
  },
  reverse: {
    immutableMethod: 'toReversed',
    message: 'Avoid mutating arrays with reverse(). Prefer toReversed().',
  },
  shift: {
    message: 'Avoid mutating arrays with shift(). Prefer at() or slice().',
    readReplacement: 'at(0)',
    statementReplacement: 'slice(1)',
  },
  sort: {
    immutableMethod: 'toSorted',
    message: 'Avoid mutating arrays with sort(). Prefer toSorted().',
  },
  splice: {
    immutableMethod: 'toSpliced',
    message: 'Avoid mutating arrays with splice(). Prefer toSpliced().',
  },
  unshift: {
    message: 'Avoid mutating arrays with unshift(). Prefer array spreading.',
  },
} as const;

const copyProducingMethods = new Set([
  'concat',
  'filter',
  'flat',
  'flatMap',
  'map',
  'slice',
  'toReversed',
  'toSorted',
  'toSpliced',
  'with',
]);

const transparentExpressionTypes = new Set([
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

const getWrappedExpression = (node: ESTree.Expression): ESTree.Expression | null => {
  if (
    node.type === 'ChainExpression' ||
    node.type === 'ParenthesizedExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSInstantiationExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return node.expression;
  }

  return null;
};

const stripTransparentExpression = (node: ESTree.Expression): ESTree.Expression => {
  let current = node;

  for (;;) {
    const next = getWrappedExpression(current);

    if (next === null) {
      return current;
    }

    current = next;
  }
};

const getStaticPropertyName = (member: ESTree.MemberExpression) => {
  if (!member.computed && member.property.type === 'Identifier') {
    return member.property.name;
  }

  if (member.computed && member.property.type === 'Literal' && typeof member.property.value === 'string') {
    return member.property.value;
  }

  return null;
};

const getMethodInfo = (call: ESTree.CallExpression): MethodInfo | null => {
  const callee = stripTransparentExpression(call.callee);

  if (callee.type !== 'MemberExpression') {
    return null;
  }

  const method = getStaticPropertyName(callee);

  if (method === null || !(method in methodBehaviors)) {
    return null;
  }

  return {
    computed: callee.computed,
    member: callee,
    method: method as MutationMethod,
  };
};

const isArrayConstructorCopy = (call: ESTree.CallExpression) => {
  const callee = stripTransparentExpression(call.callee);

  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false;
  }

  const object = stripTransparentExpression(callee.object);

  return object.type === 'Identifier' && object.name === 'Array' && ['from', 'of'].includes(getStaticPropertyName(callee) ?? '');
};

const isCopyProducingCall = (call: ESTree.CallExpression) => {
  const callee = stripTransparentExpression(call.callee);

  if (callee.type !== 'MemberExpression') {
    return false;
  }

  const method = getStaticPropertyName(callee);

  return method !== null && copyProducingMethods.has(method);
};

const isFreshTemporaryArray = (node: ESTree.Expression): boolean => {
  const expression = stripTransparentExpression(node);

  if (expression.type === 'ArrayExpression') {
    return true;
  }

  if (expression.type !== 'CallExpression') {
    return false;
  }

  return isArrayConstructorCopy(expression) || isCopyProducingCall(expression);
};

const getNonTransparentParent = (node: NodeWithParent) => {
  let parent = node.parent;

  while (parent !== null && parent !== undefined && transparentExpressionTypes.has(parent.type)) {
    parent = parent.parent;
  }

  return parent;
};

const isDirectExpressionStatement = (call: ESTree.CallExpression) => {
  return getNonTransparentParent(call)?.type === 'ExpressionStatement';
};

const isSafeAssignableReceiver = (node: ESTree.Expression): boolean => {
  const expression = stripTransparentExpression(node);

  if (expression.type === 'Identifier') {
    return true;
  }

  if (expression.type !== 'MemberExpression' || expression.optional || expression.computed) {
    return false;
  }

  const object = stripTransparentExpression(expression.object);

  return object.type === 'ThisExpression' || object.type === 'Identifier' || isSafeAssignableReceiver(object);
};

const isSafeReadReceiver = (node: ESTree.Expression): boolean => {
  const expression = stripTransparentExpression(node);

  if (expression.type === 'Identifier' || expression.type === 'ThisExpression') {
    return true;
  }

  if (expression.type !== 'MemberExpression' || expression.computed) {
    return false;
  }

  return isSafeReadReceiver(expression.object);
};

const isIgnoredCallbackReturn = (call: ESTree.CallExpression) => {
  const parent = getNonTransparentParent(call);

  if (parent?.type !== 'ArrowFunctionExpression' || parent.body !== call) {
    return false;
  }

  const arrowParent = getNonTransparentParent(parent);

  return arrowParent?.type === 'CallExpression' && arrowParent.arguments.includes(parent);
};

const getArgumentListText = ({ call, sourceText }: { call: ESTree.CallExpression; sourceText: string }) => {
  if (call.arguments.length === 0) {
    return '';
  }

  const first = call.arguments[0] as ESTree.Argument;
  const last = call.arguments.at(-1) as ESTree.Argument;

  return sourceText.slice(first.range[0], last.range[1]);
};

const getMemberPrefix = ({ info, sourceText }: { info: MethodInfo; sourceText: string }) => {
  return sourceText.slice(info.member.range[0], info.member.property.range[0]);
};

const getRenameFix = ({ info }: { info: MethodInfo }) => {
  const behavior = methodBehaviors[info.method];

  if (info.computed || !('immutableMethod' in behavior)) {
    return null;
  }

  return {
    range: info.member.property.range,
    replacement: behavior.immutableMethod,
  };
};

const getPushLikeStatementReplacement = ({ call, context, info }: FixInput) => {
  if (!isDirectExpressionStatement(call) || info.computed || info.member.optional || !isSafeAssignableReceiver(info.member.object)) {
    return null;
  }

  const sourceText = context.sourceCode.text;
  const receiverText = sourceText.slice(info.member.object.range[0], info.member.object.range[1]);
  const argumentText = getArgumentListText({ call, sourceText });

  if (info.method === 'push') {
    const elements = argumentText.length === 0 ? `...${receiverText}` : `...${receiverText}, ${argumentText}`;

    return `${receiverText} = [${elements}]`;
  }

  if (info.method === 'unshift') {
    const elements = argumentText.length === 0 ? `...${receiverText}` : `${argumentText}, ...${receiverText}`;

    return `${receiverText} = [${elements}]`;
  }

  return null;
};

const getPopLikeReplacement = ({ call, context, info }: FixInput) => {
  const behavior = methodBehaviors[info.method];

  if (!('readReplacement' in behavior) || info.computed || call.arguments.length > 0) {
    return null;
  }

  const sourceText = context.sourceCode.text;
  const receiverText = sourceText.slice(info.member.object.range[0], info.member.object.range[1]);

  if (isDirectExpressionStatement(call)) {
    if (info.member.optional || !isSafeAssignableReceiver(info.member.object)) {
      return null;
    }

    return `${receiverText} = ${receiverText}.${behavior.statementReplacement}`;
  }

  if (getNonTransparentParent(call)?.type === 'MemberExpression') {
    return null;
  }

  return `${getMemberPrefix({ info, sourceText })}${behavior.readReplacement}`;
};

const getFixReplacement = (input: FixInput) => {
  const renameFix = getRenameFix(input);

  if (renameFix !== null) {
    if (isDirectExpressionStatement(input.call) || !isSafeReadReceiver(input.info.member.object) || isIgnoredCallbackReturn(input.call)) {
      return null;
    }

    return renameFix;
  }

  if (input.info.method === 'push' || input.info.method === 'unshift') {
    return getPushLikeStatementReplacement(input);
  }

  if (input.info.method === 'pop' || input.info.method === 'shift') {
    return getPopLikeReplacement(input);
  }

  return null;
};

export const noMutationRule = defineRule({
  createOnce(context) {
    return {
      CallExpression(call) {
        const info = getMethodInfo(call);

        if (info === null || isFreshTemporaryArray(info.member.object)) {
          return;
        }

        const behavior = methodBehaviors[info.method];
        const fixReplacement = getFixReplacement({ call, context, info });

        context.report({
          ...(fixReplacement === null
            ? {}
            : {
                fix: fixer =>
                  typeof fixReplacement === 'string'
                    ? fixer.replaceTextRange(call.range, fixReplacement)
                    : fixer.replaceTextRange(fixReplacement.range, fixReplacement.replacement),
              }),
          message: behavior.message,
          node: call,
        });
      },
    };
  },
  meta: {
    docs: {
      description: 'Disallow mutating existing arrays.',
    },
    fixable: 'code',
    messages: {
      noMutation: 'Avoid mutating arrays. Prefer an immutable array operation.',
    },
    type: 'suggestion',
  },
});
