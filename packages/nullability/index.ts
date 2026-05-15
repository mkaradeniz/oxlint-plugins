import { definePlugin, eslintCompatPlugin } from '@oxlint/plugins';

import { preferIsNotNullOrUndefinedRule } from './rules/prefer-is-not-null-or-undefined.ts';

const plugin = eslintCompatPlugin(
  definePlugin({
    meta: {
      name: '@mkaradeniz/nullability',
    },
    rules: {
      'prefer-is-not-null-or-undefined': preferIsNotNullOrUndefinedRule,
    },
  }),
);

export default plugin;
