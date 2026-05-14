import { definePlugin, eslintCompatPlugin } from '@oxlint/plugins';

import { noMutationRule } from './rules/no-mutation.ts';

const plugin = eslintCompatPlugin(
  definePlugin({
    meta: {
      name: '@mkaradeniz/array',
    },
    rules: {
      'no-mutation': noMutationRule,
    },
  }),
);

export default plugin;
