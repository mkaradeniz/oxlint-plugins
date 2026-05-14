import { defineRule, type Context, type ESTree, type Range, type Ranged } from '@oxlint/plugins';

type ReportMissingSpacingInput = {
  context: Context;
  current: Ranged;
  message: string;
  previous: Ranged;
  sourceText: string;
};

type WhitespaceFixInput = {
  current: Ranged;
  previous: Ranged;
  sourceText: string;
};

type Locatable = {
  loc: {
    end: {
      line: number;
    };
    start: {
      line: number;
    };
  };
};

const returnMessage = 'Expected a blank line before this return statement.';
const siblingMessage = 'Expected a blank line between these statement groups.';

const getLineBreak = ({ sourceText }: { sourceText: string }) => {
  return sourceText.includes('\r\n') ? '\r\n' : '\n';
};

const getIndentation = ({ offset, sourceText }: { offset: number; sourceText: string }) => {
  const lineStart = sourceText.lastIndexOf('\n', offset - 1) + 1;
  const [indentation] = /^[\t ]*/.exec(sourceText.slice(lineStart, offset)) as RegExpExecArray;

  return indentation;
};

const getWhitespaceFix = ({ current, previous, sourceText }: WhitespaceFixInput) => {
  const range: Range = [previous.range[1], current.range[0]];
  const existingWhitespace = sourceText.slice(range[0], range[1]);

  if (!/^\s*$/.test(existingWhitespace)) {
    return null;
  }

  const lineBreak = getLineBreak({ sourceText });
  const indentation = getIndentation({ offset: current.range[0], sourceText });
  const replacement = `${lineBreak}${lineBreak}${indentation}`;

  if (existingWhitespace === replacement) {
    return null;
  }

  return {
    range,
    replacement,
  };
};

const isControlFlowStatement = ({ statement }: { statement: ESTree.Statement }) => {
  return [
    'DoWhileStatement',
    'ForInStatement',
    'ForOfStatement',
    'ForStatement',
    'IfStatement',
    'SwitchStatement',
    'TryStatement',
    'WhileStatement',
  ].includes(statement.type);
};

const isModuleHeaderStatement = ({ statement }: { statement: ESTree.Statement }) => {
  const type = statement.type as string;

  return (
    type === 'ImportDeclaration' ||
    type === 'ExportAllDeclaration' ||
    (type === 'ExportNamedDeclaration' && 'source' in statement && statement.source !== null)
  );
};

const isDeclarationStatement = ({ statement }: { statement: ESTree.Statement }) => {
  return [
    'ClassDeclaration',
    'FunctionDeclaration',
    'TSInterfaceDeclaration',
    'TSEnumDeclaration',
    'TSTypeAliasDeclaration',
    'VariableDeclaration',
  ].includes(statement.type);
};

const isActionStatement = ({ statement }: { statement: ESTree.Statement }) => {
  return statement.type === 'ExpressionStatement' || statement.type === 'ThrowStatement';
};

const isAwaitStatement = ({ statement }: { statement: ESTree.Statement }) => {
  return statement.type === 'ExpressionStatement' && statement.expression.type === 'AwaitExpression';
};

const isMultiline = ({ node }: { node: Locatable }) => {
  return node.loc.start.line !== node.loc.end.line;
};

const isFunctionLikeExpression = (expression: ESTree.Expression | null): expression is ESTree.ArrowFunctionExpression | ESTree.Function => {
  return expression?.type === 'ArrowFunctionExpression' || expression?.type === 'FunctionExpression';
};

const isMultilineFunctionLikeDeclaration = ({ statement }: { statement: ESTree.Statement }) => {
  if (statement.type === 'FunctionDeclaration') {
    return isMultiline({ node: statement });
  }

  return (
    statement.type === 'VariableDeclaration' &&
    statement.declarations.some(declaration => {
      const init = declaration.init;

      return isFunctionLikeExpression(init) && isMultiline({ node: init });
    })
  );
};

const needsBlankLineBetween = ({ current, previous }: { current: ESTree.Statement; previous: ESTree.Statement }) => {
  if (isModuleHeaderStatement({ statement: previous }) && !isModuleHeaderStatement({ statement: current })) {
    return siblingMessage;
  }

  if (current.type === 'ReturnStatement') {
    return returnMessage;
  }

  if (isControlFlowStatement({ statement: current }) || isControlFlowStatement({ statement: previous })) {
    return siblingMessage;
  }

  if (
    (isDeclarationStatement({ statement: previous }) && isActionStatement({ statement: current })) ||
    (isActionStatement({ statement: previous }) && isDeclarationStatement({ statement: current }))
  ) {
    return siblingMessage;
  }

  if (isAwaitStatement({ statement: previous }) && !isAwaitStatement({ statement: current })) {
    return siblingMessage;
  }

  if (isMultilineFunctionLikeDeclaration({ statement: previous }) && isMultilineFunctionLikeDeclaration({ statement: current })) {
    return siblingMessage;
  }

  return null;
};

const reportMissingSpacing = ({ context, current, message, previous, sourceText }: ReportMissingSpacingInput) => {
  const fix = getWhitespaceFix({ current, previous, sourceText });

  if (fix === null) {
    return;
  }

  context.report({
    fix: fixer => fixer.replaceTextRange(fix.range, fix.replacement),
    message,
    node: current,
  });
};

const checkStatementSequence = ({
  context,
  statements,
  sourceText,
}: {
  context: Context;
  sourceText: string;
  statements: Array<ESTree.Statement>;
}) => {
  for (const [index, current] of statements.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = statements[index - 1] as ESTree.Statement;

    const message = needsBlankLineBetween({ current, previous });

    if (message === null) {
      continue;
    }

    reportMissingSpacing({
      context,
      current,
      message,
      previous,
      sourceText,
    });
  }
};

export const statementSpacingRule = defineRule({
  createOnce(context) {
    return {
      BlockStatement(node) {
        const sourceText = context.sourceCode.text;

        checkStatementSequence({ context, sourceText, statements: node.body });
      },
      Program(node) {
        const sourceText = context.sourceCode.text;

        checkStatementSequence({ context, sourceText, statements: node.body });
      },
    };
  },
  meta: {
    docs: {
      description: 'Require blank lines between logical statement phases.',
    },
    fixable: 'whitespace',
    messages: {
      missingReturnSpacing: returnMessage,
      missingSiblingSpacing: siblingMessage,
    },
    type: 'layout',
  },
});
