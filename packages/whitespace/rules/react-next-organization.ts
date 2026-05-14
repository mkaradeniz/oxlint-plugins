import { defineRule } from '@oxlint/plugins';

import { checkFunctionBody, spacingMessage } from './react-next-organization-check.ts';

export const reactNextOrganizationRule = defineRule({
  createOnce(context) {
    return {
      ArrowFunctionExpression(node) {
        checkFunctionBody({ context, node, sourceText: context.sourceCode.text });
      },
      FunctionDeclaration(node) {
        checkFunctionBody({ context, node, sourceText: context.sourceCode.text });
      },
    };
  },
  meta: {
    docs: {
      description: 'Require conservative blank-line organization inside React and Next.js component bodies.',
    },
    fixable: 'whitespace',
    messages: {
      missingGroupSpacing: spacingMessage,
      outOfOrderGroup: 'Expected this component group to appear earlier.',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          hookGroups: {
            additionalProperties: {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            type: 'object',
          },
          orderDiagnostics: {
            type: 'boolean',
          },
        },
        type: 'object',
      },
    ],
    type: 'layout',
  },
});
