import { type ESTree } from '@oxlint/plugins';

type StatementLike = ESTree.FunctionBody | ESTree.Statement;

const isJsxExpression = ({ expression }: { expression: ESTree.Expression | null }): boolean => {
  if (expression === null) {
    return false;
  }

  switch (expression.type) {
    case 'JSXElement':
    case 'JSXFragment':
      return true;
    case 'ConditionalExpression':
      return isJsxExpression({ expression: expression.consequent }) || isJsxExpression({ expression: expression.alternate });
    case 'LogicalExpression':
      return isJsxExpression({ expression: expression.left }) || isJsxExpression({ expression: expression.right });
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
      return isJsxExpression({ expression: expression.expression });
    default:
      return false;
  }
};

const statementReturnsJsx = ({ statement }: { statement: StatementLike }): boolean => {
  switch (statement.type) {
    case 'BlockStatement':
      return statement.body.some(child => statementReturnsJsx({ statement: child }));
    case 'IfStatement':
      return (
        statementReturnsJsx({ statement: statement.consequent }) ||
        (statement.alternate !== null && statementReturnsJsx({ statement: statement.alternate }))
      );
    case 'ReturnStatement':
      return isJsxExpression({ expression: statement.argument });
    case 'TryStatement':
      return (
        statementReturnsJsx({ statement: statement.block }) ||
        (statement.handler !== null && statementReturnsJsx({ statement: statement.handler.body })) ||
        (statement.finalizer !== null && statementReturnsJsx({ statement: statement.finalizer }))
      );
    default:
      return false;
  }
};

export const functionReturnsJsx = ({ node }: { node: ESTree.ArrowFunctionExpression | ESTree.Function }): boolean => {
  if (node.type === 'ArrowFunctionExpression') {
    return node.body.type === 'BlockStatement' ? statementReturnsJsx({ statement: node.body }) : isJsxExpression({ expression: node.body });
  }

  return node.body !== null && statementReturnsJsx({ statement: node.body });
};
