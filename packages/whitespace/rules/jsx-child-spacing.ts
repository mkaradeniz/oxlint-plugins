import { defineRule, type Context, type ESTree, type Range, type Ranged } from '@oxlint/plugins';

type SignificantChild = ESTree.JSXElement | ESTree.JSXExpressionContainer | ESTree.JSXFragment | ESTree.JSXSpreadChild;

type JsxParent = ESTree.JSXElement | ESTree.JSXFragment;

type Options = {
  compactParents?: Array<string>;
};

const defaultCompactParents = ['Button', 'IconButton', 'Link'];
const message = 'Expected a blank line between these JSX children.';

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

  if (!/^\s+$/.test(existingWhitespace) || !existingWhitespace.includes('\n')) {
    return null;
  }

  const lineBreak = getLineBreak({ sourceText });
  const replacement = `${lineBreak}${lineBreak}${getIndentation({ offset: current.range[0], sourceText })}`;

  if (existingWhitespace === replacement) {
    return null;
  }

  return {
    range,
    replacement,
  };
};

const getOptions = ({ context }: { context: Context }): Required<Options> => {
  const options = context.options[0] as Options | undefined;

  return {
    compactParents: options?.compactParents ?? defaultCompactParents,
  };
};

const getJsxElementName = ({ name }: { name: ESTree.JSXElementName }): string | null => {
  if (name.type === 'JSXIdentifier') {
    return name.name;
  }

  if (name.type === 'JSXMemberExpression') {
    return getJsxElementName({ name: name.property });
  }

  return null;
};

const isCompactParent = ({ compactParents, parent }: { compactParents: Array<string>; parent: JsxParent }) => {
  if (parent.type === 'JSXFragment') {
    return false;
  }

  const name = getJsxElementName({ name: parent.openingElement.name });

  return name !== null && compactParents.includes(name);
};

const isSignificantChild = (child: ESTree.JSXChild): child is SignificantChild => {
  if (child.type === 'JSXExpressionContainer' && child.expression.type === 'Literal') {
    const value = child.expression.value;

    if (value === null || value === false || (typeof value === 'string' && value.trim() === '')) {
      return false;
    }
  }

  return (
    child.type === 'JSXElement' ||
    child.type === 'JSXFragment' ||
    child.type === 'JSXSpreadChild' ||
    (child.type === 'JSXExpressionContainer' && child.expression.type !== 'JSXEmptyExpression')
  );
};

const isNonWhitespaceText = ({ child }: { child: ESTree.JSXChild | undefined }) => {
  return child?.type === 'JSXText' && child.value.trim() !== '';
};

const isInlineBreakElement = ({ child }: { child: SignificantChild }) => {
  return child.type === 'JSXElement' && getJsxElementName({ name: child.openingElement.name }) === 'br';
};

const isInlineFlowChild = ({ child, children }: { child: SignificantChild; children: Array<ESTree.JSXChild> }) => {
  const index = children.indexOf(child);

  return (
    isInlineBreakElement({ child }) ||
    isNonWhitespaceText({ child: children[index - 1] }) ||
    isNonWhitespaceText({ child: children[index + 1] })
  );
};

const checkJsxChildren = ({ context, parent, sourceText }: { context: Context; parent: JsxParent; sourceText: string }) => {
  const options = getOptions({ context });

  if (isCompactParent({ compactParents: options.compactParents, parent })) {
    return;
  }

  const children = parent.children.filter(isSignificantChild);

  for (const [index, current] of children.entries()) {
    if (index === 0) {
      continue;
    }

    const previous = children[index - 1] as SignificantChild;

    if (
      isInlineFlowChild({ child: previous, children: parent.children }) ||
      isInlineFlowChild({ child: current, children: parent.children })
    ) {
      continue;
    }

    const fix = getWhitespaceFix({ current, previous, sourceText });

    if (fix === null) {
      continue;
    }

    context.report({
      fix: fixer => fixer.replaceTextRange(fix.range, fix.replacement),
      message,
      node: current,
    });
  }
};

export const jsxChildSpacingRule = defineRule({
  createOnce(context) {
    return {
      JSXElement(node) {
        checkJsxChildren({ context, parent: node, sourceText: context.sourceCode.text });
      },
      JSXFragment(node) {
        checkJsxChildren({ context, parent: node, sourceText: context.sourceCode.text });
      },
    };
  },
  meta: {
    docs: {
      description: 'Require blank lines between significant JSX children.',
    },
    fixable: 'whitespace',
    messages: {
      missingJsxChildSpacing: message,
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          compactParents: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
        },
        type: 'object',
      },
    ],
    type: 'layout',
  },
});
