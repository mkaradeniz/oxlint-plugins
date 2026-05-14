import { type Context, type ESTree, type Range, type Ranged } from '@oxlint/plugins';

import { functionReturnsJsx } from '../internal/component-detection.ts';
import {
  classifyStatements,
  type ClassifiedStatement,
  getHookGroups,
  getIdentifierName,
  getOrderDiagnosticsEnabled,
  type GroupName,
} from './react-next-organization-groups.ts';

export const spacingMessage = 'Expected a blank line between these component groups.';

const getLineBreak = ({ sourceText }: { sourceText: string }) => {
  return sourceText.includes('\r\n') ? '\r\n' : '\n';
};

const getIndentation = ({ offset, sourceText }: { offset: number; sourceText: string }) => {
  const lineStart = sourceText.lastIndexOf('\n', offset - 1) + 1;
  const [indentation] = /^[\t ]*/.exec(sourceText.slice(lineStart, offset)) as RegExpExecArray;

  return indentation;
};

const getWhitespaceFix = ({ current, previous, sourceText }: { current: Ranged; previous: Ranged; sourceText: string }) => {
  const range: Range = [previous.range[1], current.range[0]];
  const existingWhitespace = sourceText.slice(range[0], range[1]);

  if (!/^\s*$/.test(existingWhitespace)) {
    return null;
  }

  const replacement = `${getLineBreak({ sourceText })}${getLineBreak({ sourceText })}${getIndentation({ offset: current.range[0], sourceText })}`;

  if (existingWhitespace === replacement) {
    return null;
  }

  return {
    range,
    replacement,
  };
};

const reportOrderingProblems = ({
  context,
  enabled,
  statements,
}: {
  context: Context;
  enabled: boolean;
  statements: Array<ClassifiedStatement>;
}) => {
  let highestSeen = -1;
  let highestSeenGroup: GroupName | null = null;
  let hasOrderingProblem = false;

  for (const current of statements) {
    if (current.order < highestSeen && highestSeenGroup !== null) {
      hasOrderingProblem = true;

      if (enabled) {
        context.report({
          message: `Expected this component group to appear before ${highestSeenGroup}.`,
          node: current.statement,
        });
      }
    }

    if (current.order > highestSeen) {
      highestSeen = current.order;
      highestSeenGroup = current.group;
    }
  }

  return hasOrderingProblem;
};

const reportSpacingProblems = ({
  context,
  sourceText,
  statements,
}: {
  context: Context;
  sourceText: string;
  statements: Array<ClassifiedStatement>;
}) => {
  for (const [index, current] of statements.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = statements[index - 1] as ClassifiedStatement;

    const statementSpacingOwnsCurrent = current.group === 'guards' || current.group === 'returns';
    const shouldSeparate =
      !statementSpacingOwnsCurrent && (current.group !== previous.group || (current.group === 'effects' && previous.group === 'effects'));

    if (!shouldSeparate) {
      continue;
    }

    const fix = getWhitespaceFix({ current: current.statement, previous: previous.statement, sourceText });

    if (fix === null) {
      continue;
    }

    context.report({
      fix: fixer => fixer.replaceTextRange(fix.range, fix.replacement),
      message: spacingMessage,
      node: current.statement,
    });
  }
};

const isPascalCase = ({ name }: { name: string | null }) => {
  return name !== null && /^[A-Z]/.test(name);
};

const isTopLevelDeclaration = ({ node }: { node: ESTree.Node }): boolean => {
  const parent = node.parent;

  if (parent?.type === 'Program' || parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration') {
    return true;
  }

  return parent?.type === 'VariableDeclarator' && isTopLevelDeclaration({ node: parent.parent });
};

const getArrowComponentName = ({ node }: { node: ESTree.ArrowFunctionExpression }) => {
  const parent = node.parent;

  if (parent?.type !== 'VariableDeclarator') {
    return null;
  }

  return getIdentifierName({ node: parent.id });
};

export const checkFunctionBody = ({
  context,
  node,
  sourceText,
}: {
  context: Context;
  node: ESTree.ArrowFunctionExpression | ESTree.Function;
  sourceText: string;
}) => {
  if (node.body?.type !== 'BlockStatement' || !isTopLevelDeclaration({ node })) {
    return;
  }

  const functionName = node.type === 'ArrowFunctionExpression' ? getArrowComponentName({ node }) : getIdentifierName({ node: node.id });

  if (!isPascalCase({ name: functionName })) {
    return;
  }

  if (!functionReturnsJsx({ node })) {
    return;
  }

  const statements = classifyStatements({ hookGroups: getHookGroups({ context }), statements: node.body.body });

  if (statements.length < 2) {
    return;
  }

  if (reportOrderingProblems({ context, enabled: getOrderDiagnosticsEnabled({ context }), statements })) {
    return;
  }

  reportSpacingProblems({ context, sourceText, statements });
};
