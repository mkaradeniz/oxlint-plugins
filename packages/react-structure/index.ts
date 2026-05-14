import { definePlugin, eslintCompatPlugin } from '@oxlint/plugins';

import { componentModuleShapeRule } from './rules/component-module-shape.ts';

const plugin = eslintCompatPlugin(
  definePlugin({
    meta: {
      name: '@mkaradeniz/react-structure',
    },
    rules: {
      'component-module-shape': componentModuleShapeRule,
    },
  }),
);

export default plugin;
