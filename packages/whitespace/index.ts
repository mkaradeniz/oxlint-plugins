import { definePlugin, eslintCompatPlugin } from '@oxlint/plugins';

import { jsxChildSpacingRule } from './rules/jsx-child-spacing.ts';
import { reactNextOrganizationRule } from './rules/react-next-organization.ts';
import { statementSpacingRule } from './rules/statement-spacing.ts';

const plugin = eslintCompatPlugin(
  definePlugin({
    meta: {
      name: '@mkaradeniz/whitespace',
    },
    rules: {
      'jsx-child-spacing': jsxChildSpacingRule,
      'react-next-organization': reactNextOrganizationRule,
      'statement-spacing': statementSpacingRule,
    },
  }),
);

export default plugin;
