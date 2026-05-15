import { defineRule, type Context, type ESTree, type Ranged } from '@oxlint/plugins';

const helperName = 'isNotNullOrUndefined';
const message = 'Prefer isNotNullOrUndefined for nullability checks.';

type NullableInfo = {
  alwaysTruthy: boolean;
};

type NullishKind = 'null' | 'undefined';

type NullishComparison = {
  kind: NullishKind;
  node: ESTree.BinaryExpression;
  polarity: 'present' | 'absent';
  subject: ESTree.Expression;
};

type FunctionLike = ESTree.ArrowFunctionExpression | ESTree.Function;

type ReportInput = {
  context: Context;
  fixReplacement?: string | null;
  node: Ranged;
};

type RuleState = {
  exactImportAvailable: boolean;
  importShadowed: boolean;
  nullableNames: Map<string, NullableInfo>;
  normalizedNames: Set<string>;
};

const normalizedAssignmentPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n\r?]+\?\?/gu;
const exactImportPattern = /import\s*\{\s*isNotNullOrUndefined\s*\}\s*from\s*['"]is-not-null-or-undefined['"]/u;
const shadowPattern = /\b(?:const|let|var|function|class)\s+isNotNullOrUndefined\b/u;
const annotationDelimiters = new Set([',', ')', '=', ';', '\n', '\r']);
const annotationCandidatePattern = /\b([A-Za-z_$][\w$]*)\??\s*:/gu;

const transparentExpressionTypes = new Set([
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

const stripTransparentExpression = (node: ESTree.Expression): ESTree.Expression => {
  let current = node;

  while (transparentExpressionTypes.has(current.type)) {
    current = (current as ESTree.ChainExpression | ESTree.ParenthesizedExpression | ESTree.TSAsExpression).expression;
  }

  return current;
};

const getText = ({ context, node }: { context: Context; node: Ranged }) => context.sourceCode.text.slice(node.range[0], node.range[1]);

const isNullLiteral = (node: ESTree.Expression) =>
  stripTransparentExpression(node).type === 'Literal' && getLiteralValue(stripTransparentExpression(node)) === null;

const getLiteralValue = (node: ESTree.Expression) => (node as ESTree.Expression & { value?: unknown }).value;

const isUndefinedIdentifier = (node: ESTree.Expression) => {
  const expression = stripTransparentExpression(node);

  return expression.type === 'Identifier' && expression.name === 'undefined';
};

const getNullishKind = (node: ESTree.Expression): NullishKind | null => {
  if (isNullLiteral(node)) {
    return 'null';
  }

  if (isUndefinedIdentifier(node)) {
    return 'undefined';
  }

  return null;
};

const isSameSubject = ({ context, left, right }: { context: Context; left: ESTree.Expression; right: ESTree.Expression }) => {
  return getText({ context, node: stripTransparentExpression(left) }) === getText({ context, node: stripTransparentExpression(right) });
};

const isOrdinaryBinaryExpression = (node: ESTree.Expression): node is ESTree.BinaryExpression => {
  return node.type === 'BinaryExpression' && node.operator !== 'in';
};

const getComparison = ({ node }: { node: ESTree.BinaryExpression }): NullishComparison | null => {
  const leftKind = getNullishKind(node.left);
  const rightKind = getNullishKind(node.right);
  const kind = leftKind ?? rightKind;

  if (kind === null || (leftKind !== null && rightKind !== null)) {
    return null;
  }

  const subject = leftKind === null ? node.left : node.right;

  if (node.operator === '!=' && kind === 'null') {
    return {
      kind,
      node,
      polarity: 'present',
      subject,
    };
  }

  if (node.operator === '==' && kind === 'null') {
    return {
      kind,
      node,
      polarity: 'absent',
      subject,
    };
  }

  if (node.operator === '!==') {
    return {
      kind,
      node,
      polarity: 'present',
      subject,
    };
  }

  if (node.operator === '===') {
    return {
      kind,
      node,
      polarity: 'absent',
      subject,
    };
  }

  return null;
};

const getNullishPair = ({ context, node }: { context: Context; node: ESTree.LogicalExpression }) => {
  const left = stripTransparentExpression(node.left);
  const right = stripTransparentExpression(node.right);

  if (!isOrdinaryBinaryExpression(left) || !isOrdinaryBinaryExpression(right)) {
    return null;
  }

  const leftComparison = getComparison({ node: left });
  const rightComparison = getComparison({ node: right });

  if (leftComparison === null || rightComparison === null) {
    return null;
  }

  if (!isSameSubject({ context, left: leftComparison.subject, right: rightComparison.subject })) {
    return null;
  }

  if (leftComparison.kind === rightComparison.kind || leftComparison.polarity !== rightComparison.polarity) {
    return null;
  }

  if (node.operator === '&&' && leftComparison.polarity === 'present') {
    return {
      polarity: 'present' as const,
      subject: leftComparison.subject,
    };
  }

  if (node.operator === '||' && leftComparison.polarity === 'absent') {
    return {
      polarity: 'absent' as const,
      subject: leftComparison.subject,
    };
  }

  return null;
};

const hasNullishPairParent = ({ context, node }: { context: Context; node: ESTree.BinaryExpression }) => {
  const parent = node.parent;

  return parent?.type === 'LogicalExpression' && getNullishPair({ context, node: parent }) !== null;
};

const isHelperCall = (node: ESTree.Expression) => {
  const expression = stripTransparentExpression(node);

  return (
    expression.type === 'CallExpression' &&
    stripTransparentExpression(expression.callee).type === 'Identifier' &&
    (stripTransparentExpression(expression.callee) as ESTree.IdentifierReference).name === helperName
  );
};

const isAlreadyGuardedLogical = (node: ESTree.Expression) => {
  const expression = stripTransparentExpression(node);

  return expression.type === 'LogicalExpression' && expression.operator === '&&' && isHelperCall(expression.left);
};

const isFallbackLogical = (node: ESTree.Expression) => {
  const expression = stripTransparentExpression(node);

  return expression.type === 'LogicalExpression' && expression.operator === '||';
};

const isNullishCoalescing = (node: ESTree.Expression) => {
  const expression = stripTransparentExpression(node);

  return expression.type === 'LogicalExpression' && expression.operator === '??';
};

const readAnnotationAfterIdentifier = ({ identifier, sourceText }: { identifier: Ranged; sourceText: string }) => {
  let index = identifier.range[1];

  while (sourceText[index] === ' ' || sourceText[index] === '\t' || sourceText[index] === '?') {
    index += 1;
  }

  if (sourceText[index] !== ':') {
    return null;
  }

  const start = index + 1;
  let depth = 0;

  for (index = start; index < sourceText.length; index += 1) {
    const character = sourceText[index] as string;

    if (character === '<' || character === '(' || character === '[' || character === '{') {
      depth += 1;
      continue;
    }

    if (character === '>' && sourceText[index - 1] === '=') {
      continue;
    }

    if (character === '>' || character === ')' || character === ']' || character === '}') {
      if (depth === 0) {
        break;
      }

      depth -= 1;
      continue;
    }

    if (depth === 0 && annotationDelimiters.has(character)) {
      break;
    }
  }

  return sourceText.slice(start, index);
};

const isAlwaysTruthyAnnotation = (annotation: string) => {
  const nonNullish = annotation
    .replace(/\bnull\b/gu, '')
    .replace(/\bundefined\b/gu, '')
    .replace(/[|&()]/gu, ' ')
    .trim();

  if (nonNullish.length === 0) {
    return false;
  }

  return /\{/.test(nonNullish) || /=>/.test(nonNullish) || /\b(?:object|symbol|Function)\b/u.test(nonNullish);
};

const collectNormalizedNames = (sourceText: string) => {
  return new Set(Array.from(sourceText.matchAll(normalizedAssignmentPattern), match => match[1] as string));
};

const getPreviousNonSpaceCharacter = ({ index, sourceText }: { index: number; sourceText: string }) => {
  for (let current = index - 1; current >= 0; current -= 1) {
    const character = sourceText[current];

    if (character !== undefined && !/\s/u.test(character)) {
      return character;
    }
  }

  return null;
};

const collectNullableNames = (sourceText: string) => {
  const nullableNames = new Map<string, NullableInfo>();

  for (const match of sourceText.matchAll(annotationCandidatePattern)) {
    const name = match[1] as string;
    const nameStart = match.index;
    const previous = getPreviousNonSpaceCharacter({ index: nameStart, sourceText });

    if (previous === '{' || previous === '?' || previous === '.') {
      continue;
    }

    const annotation = readAnnotationAfterIdentifier({
      identifier: {
        range: [nameStart, nameStart + name.length],
      },
      sourceText,
    });

    if (annotation === null || !/\b(?:null|undefined)\b/u.test(annotation)) {
      continue;
    }

    nullableNames.set(name, {
      alwaysTruthy: isAlwaysTruthyAnnotation(annotation),
    });
  }

  return nullableNames;
};

const collectNullableIdentifier = ({
  identifier,
  sourceText,
  state,
}: {
  identifier: ESTree.IdentifierReference;
  sourceText: string;
  state: RuleState;
}) => {
  const annotation = readAnnotationAfterIdentifier({ identifier, sourceText });

  if (annotation === null || !/\b(?:null|undefined)\b/u.test(annotation)) {
    return;
  }

  state.nullableNames.set(identifier.name, {
    alwaysTruthy: isAlwaysTruthyAnnotation(annotation),
  });
};

const collectBindingPattern = ({
  pattern,
  sourceText,
  state,
}: {
  pattern: ESTree.BindingPattern;
  sourceText: string;
  state: RuleState;
}) => {
  if (pattern.type === 'Identifier') {
    collectNullableIdentifier({ identifier: pattern, sourceText, state });

    return;
  }

  if (pattern.type === 'AssignmentPattern') {
    collectBindingPattern({ pattern: pattern.left, sourceText, state });
  }
};

const collectFunctionParams = ({ node, sourceText, state }: { node: FunctionLike; sourceText: string; state: RuleState }) => {
  for (const param of node.params) {
    if (param.type === 'TSParameterProperty') {
      collectBindingPattern({ pattern: param.parameter, sourceText, state });
      continue;
    }

    if (param.type === 'RestElement') {
      collectBindingPattern({ pattern: param.argument, sourceText, state });
      continue;
    }

    collectBindingPattern({ pattern: param, sourceText, state });
  }
};

const hasUsableImport = (state: RuleState) => state.exactImportAvailable && !state.importShadowed;

const getSafeAutofixSubject = (subject: ESTree.Expression) => {
  const expression = stripTransparentExpression(subject);

  return expression.type === 'Identifier' ? expression : null;
};

const hasAncestorType = ({ node, type }: { node: Ranged; type: string }) => {
  let current = (node as Ranged & { parent?: Ranged & { type?: string } }).parent;

  while (current !== undefined && current !== null) {
    if (current.type === type) {
      return true;
    }

    current = (current as Ranged & { parent?: Ranged & { type?: string } }).parent;
  }

  return false;
};

const logicalExpressionRoot = (node: ESTree.LogicalExpression) => {
  let current = node;

  while (current.parent?.type === 'LogicalExpression') {
    current = current.parent;
  }

  return current;
};

const isInsideConditionalTest = (node: ESTree.LogicalExpression) => {
  const root = logicalExpressionRoot(node);

  return root.parent?.type === 'ConditionalExpression' && root.parent.test === root;
};

const isInsideBooleanConversion = (node: ESTree.LogicalExpression) => {
  const root = logicalExpressionRoot(node);
  const parent = root.parent;

  if (parent?.type !== 'CallExpression' || parent.arguments[0] !== root) {
    return false;
  }

  const callee = stripTransparentExpression(parent.callee);

  return callee.type === 'Identifier' && callee.name === 'Boolean';
};

const isInsideCallbackArgument = (node: Ranged) => {
  let current = (node as Ranged & { parent?: Ranged & { type?: string } }).parent;

  while (current !== undefined && current !== null) {
    if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
      const parent = (current as Ranged & { parent?: ESTree.Node }).parent;

      return parent?.type === 'CallExpression' && parent.arguments.includes(current as ESTree.Expression);
    }

    current = (current as Ranged & { parent?: Ranged & { type?: string } }).parent;
  }

  return false;
};

const report = ({ context, fixReplacement = null, node }: ReportInput) => {
  if (hasAncestorType({ node, type: 'JSXAttribute' })) {
    return;
  }

  context.report({
    ...(fixReplacement === null
      ? {}
      : {
          fix: fixer => fixer.replaceTextRange(node.range, fixReplacement),
        }),
    message,
    node,
  });
};

const getNullableIdentifier = (node: ESTree.Expression, state: RuleState) => {
  const expression = stripTransparentExpression(node);

  if (expression.type !== 'Identifier' || state.normalizedNames.has(expression.name)) {
    return null;
  }

  const nullable = state.nullableNames.get(expression.name);

  if (nullable === undefined) {
    return null;
  }

  return {
    expression,
    nullable,
  };
};

const getTruthinessFix = ({
  context,
  expression,
  negated,
  nullable,
  state,
}: {
  context: Context;
  expression: ESTree.Expression;
  negated: boolean;
  nullable: NullableInfo;
  state: RuleState;
}) => {
  if (!hasUsableImport(state) || !nullable.alwaysTruthy) {
    return null;
  }

  const subject = getText({ context, node: stripTransparentExpression(expression) });

  return `${negated ? '!' : ''}${helperName}(${subject})`;
};

const reportTruthinessGate = ({ context, expression, state }: { context: Context; expression: ESTree.Expression; state: RuleState }) => {
  if (isAlreadyGuardedLogical(expression) || isFallbackLogical(expression) || isNullishCoalescing(expression)) {
    return;
  }

  const stripped = stripTransparentExpression(expression);

  if (stripped.type === 'UnaryExpression' && stripped.operator === '!') {
    const nullableIdentifier = getNullableIdentifier(stripped.argument, state);

    if (nullableIdentifier === null) {
      return;
    }

    if (!nullableIdentifier.nullable.alwaysTruthy) {
      return;
    }

    report({
      context,
      fixReplacement: getTruthinessFix({
        context,
        expression: nullableIdentifier.expression,
        negated: true,
        nullable: nullableIdentifier.nullable,
        state,
      }),
      node: stripped,
    });

    return;
  }

  const nullableIdentifier = getNullableIdentifier(stripped, state);

  if (nullableIdentifier === null) {
    return;
  }

  if (!nullableIdentifier.nullable.alwaysTruthy) {
    return;
  }

  report({
    context,
    fixReplacement: getTruthinessFix({
      context,
      expression: nullableIdentifier.expression,
      negated: false,
      nullable: nullableIdentifier.nullable,
      state,
    }),
    node: expression,
  });
};

const getPairFix = ({ context, node, state }: { context: Context; node: ESTree.LogicalExpression; state: RuleState }) => {
  const pair = getNullishPair({ context, node });

  if (pair === null || !hasUsableImport(state) || isInsideCallbackArgument(node)) {
    return null;
  }

  const safeSubject = getSafeAutofixSubject(pair.subject);

  if (safeSubject === null) {
    return null;
  }

  const subject = getText({ context, node: safeSubject });
  const helperCall = `${helperName}(${subject})`;

  return pair.polarity === 'present' ? helperCall : `!${helperCall}`;
};

const getSingleComparisonFix = ({ context, comparison, state }: { context: Context; comparison: NullishComparison; state: RuleState }) => {
  if (
    !hasUsableImport(state) ||
    isInsideCallbackArgument(comparison.node) ||
    comparison.kind !== 'null' ||
    !['==', '!='].includes(comparison.node.operator)
  ) {
    return null;
  }

  const safeSubject = getSafeAutofixSubject(comparison.subject);

  if (safeSubject === null) {
    return null;
  }

  const subject = getText({ context, node: safeSubject });
  const helperCall = `${helperName}(${subject})`;

  return comparison.polarity === 'present' ? helperCall : `!${helperCall}`;
};

const shouldReportSingleComparison = (comparison: NullishComparison) => {
  return comparison.kind === 'null' && ['==', '!='].includes(comparison.node.operator);
};

const getSingleIdentifierParameter = (node: ESTree.ArrowFunctionExpression) => {
  if (node.params.length !== 1 || node.params[0]?.type !== 'Identifier') {
    return null;
  }

  return node.params[0];
};

const isIdentifierSubjectForParameter = ({
  context,
  parameter,
  subject,
}: {
  context: Context;
  parameter: ESTree.IdentifierReference;
  subject: ESTree.Expression;
}) => {
  const safeSubject = getSafeAutofixSubject(subject);

  return safeSubject !== null && getText({ context, node: safeSubject }) === parameter.name;
};

const getPositivePredicateSubject = ({ context, node }: { context: Context; node: ESTree.Expression }) => {
  const expression = stripTransparentExpression(node);

  if (expression.type === 'LogicalExpression') {
    const pair = getNullishPair({ context, node: expression });

    return pair?.polarity === 'present' ? pair.subject : null;
  }

  if (!isOrdinaryBinaryExpression(expression)) {
    return null;
  }

  const comparison = getComparison({ node: expression });

  return comparison?.polarity === 'present' && comparison.kind === 'null' && comparison.node.operator === '!=' ? comparison.subject : null;
};

const getFilterReplacement = ({ context, node, state }: { context: Context; node: ESTree.CallExpression; state: RuleState }) => {
  if (!hasUsableImport(state) || node.arguments.length !== 1) {
    return null;
  }

  const callee = stripTransparentExpression(node.callee);

  if (callee.type !== 'MemberExpression') {
    return null;
  }

  const property = callee.property;

  if (callee.computed || property.type !== 'Identifier' || property.name !== 'filter') {
    return null;
  }

  const predicate = stripTransparentExpression(node.arguments[0] as ESTree.Expression);

  if (predicate.type !== 'ArrowFunctionExpression') {
    return null;
  }

  const parameter = getSingleIdentifierParameter(predicate);

  if (parameter === null) {
    return null;
  }

  const body = stripTransparentExpression(predicate.body as ESTree.Expression);
  const predicateSubject = getPositivePredicateSubject({ context, node: body });

  if (predicateSubject === null || !isIdentifierSubjectForParameter({ context, parameter, subject: predicateSubject })) {
    return null;
  }

  return `${getText({ context, node: callee })}(${helperName})`;
};

export const preferIsNotNullOrUndefinedRule = defineRule({
  createOnce(context) {
    const state: RuleState = {
      exactImportAvailable: false,
      importShadowed: false,
      normalizedNames: new Set(),
      nullableNames: new Map(),
    };

    return {
      Program() {
        const sourceText = context.sourceCode.text;

        state.exactImportAvailable = exactImportPattern.test(sourceText);
        state.importShadowed = shadowPattern.test(sourceText.replace(exactImportPattern, ''));
        state.nullableNames = collectNullableNames(sourceText);
        state.normalizedNames = collectNormalizedNames(sourceText);
      },
      FunctionDeclaration(node) {
        collectFunctionParams({ node, sourceText: context.sourceCode.text, state });
      },
      FunctionExpression(node) {
        collectFunctionParams({ node, sourceText: context.sourceCode.text, state });
      },
      ArrowFunctionExpression(node) {
        collectFunctionParams({ node, sourceText: context.sourceCode.text, state });
      },
      VariableDeclarator(node) {
        collectBindingPattern({ pattern: node.id, sourceText: context.sourceCode.text, state });
      },
      PropertyDefinition(node) {
        if (node.key.type === 'Identifier') {
          collectNullableIdentifier({ identifier: node.key, sourceText: context.sourceCode.text, state });
        }
      },
      IfStatement(node) {
        reportTruthinessGate({ context, expression: node.test, state });
      },
      WhileStatement(node) {
        reportTruthinessGate({ context, expression: node.test, state });
      },
      DoWhileStatement(node) {
        reportTruthinessGate({ context, expression: node.test, state });
      },
      ConditionalExpression(node) {
        reportTruthinessGate({ context, expression: node.test, state });
      },
      LogicalExpression(node) {
        const pairFix = getPairFix({ context, node, state });

        if (getNullishPair({ context, node }) !== null) {
          report({
            context,
            fixReplacement: pairFix,
            node,
          });

          return;
        }

        if (node.operator === '&&') {
          if (isInsideConditionalTest(node) || isInsideBooleanConversion(node)) {
            return;
          }

          reportTruthinessGate({ context, expression: node.left, state });
        }
      },
      BinaryExpression(node) {
        if (node.operator === 'in') {
          return;
        }

        if (hasNullishPairParent({ context, node })) {
          return;
        }

        const comparison = getComparison({ node });

        if (comparison === null) {
          return;
        }

        if (!shouldReportSingleComparison(comparison)) {
          return;
        }

        report({
          context,
          fixReplacement: getSingleComparisonFix({ context, comparison, state }),
          node,
        });
      },
      CallExpression(node) {
        const replacement = getFilterReplacement({ context, node, state });

        if (replacement === null) {
          return;
        }

        report({
          context,
          fixReplacement: replacement,
          node,
        });
      },
    };
  },
  meta: {
    docs: {
      description: 'Prefer isNotNullOrUndefined for explicit nullability checks.',
    },
    fixable: 'code',
    type: 'suggestion',
  },
});
