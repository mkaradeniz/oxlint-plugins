import { describe, expect, it } from 'vitest';

import { functionReturnsJsx } from '../internal/component-detection.ts';

const jsxElement = { type: 'JSXElement' };
const identifier = { type: 'Identifier' };

const arrow = (body: unknown) => {
  return {
    body,
    type: 'ArrowFunctionExpression',
  } as Parameters<typeof functionReturnsJsx>[0]['node'];
};

const fn = (body: unknown) => {
  return {
    body,
    type: 'FunctionDeclaration',
  } as Parameters<typeof functionReturnsJsx>[0]['node'];
};

const block = (...body: Array<unknown>) => {
  return {
    body,
    type: 'BlockStatement',
  };
};

const returns = (argument: unknown) => {
  return {
    argument,
    type: 'ReturnStatement',
  };
};

describe('component detection', () => {
  it('recognizes expression-bodied JSX and wrapped JSX', () => {
    expect(functionReturnsJsx({ node: arrow(jsxElement) })).toBe(true);
    expect(
      functionReturnsJsx({
        node: arrow({
          alternate: jsxElement,
          consequent: identifier,
          type: 'ConditionalExpression',
        }),
      }),
    ).toBe(true);
    expect(
      functionReturnsJsx({
        node: arrow({
          left: identifier,
          right: jsxElement,
          type: 'LogicalExpression',
        }),
      }),
    ).toBe(true);
  });

  it('rejects non-JSX expressions and empty function bodies', () => {
    expect(functionReturnsJsx({ node: arrow(identifier) })).toBe(false);
    expect(
      functionReturnsJsx({
        node: arrow({
          expression: identifier,
          type: 'TSAsExpression',
        }),
      }),
    ).toBe(false);
    expect(functionReturnsJsx({ node: fn(null) })).toBe(false);
    expect(functionReturnsJsx({ node: fn(block(returns(null))) })).toBe(false);
  });

  it('recognizes JSX from if statements and try handlers or finalizers', () => {
    expect(
      functionReturnsJsx({
        node: fn(
          block({
            alternate: block(returns(jsxElement)),
            consequent: block(returns(identifier)),
            type: 'IfStatement',
          }),
        ),
      }),
    ).toBe(true);
    expect(
      functionReturnsJsx({
        node: fn(
          block({
            block: block(returns(identifier)),
            finalizer: null,
            handler: {
              body: block(returns(jsxElement)),
            },
            type: 'TryStatement',
          }),
        ),
      }),
    ).toBe(true);
    expect(
      functionReturnsJsx({
        node: fn(
          block({
            block: block(returns(identifier)),
            finalizer: block(returns(jsxElement)),
            handler: null,
            type: 'TryStatement',
          }),
        ),
      }),
    ).toBe(true);
  });
});
