import { definePlugin, eslintCompatPlugin } from '@oxlint/plugins';

import { noPollingLoopRule } from './rules/no-polling-loop.ts';
import { noRealTimeWaitRule } from './rules/no-real-time-wait.ts';
import { noTestTimeoutOrRetryRule } from './rules/no-test-timeout-or-retry.ts';
import { noWallClockAssertionRule } from './rules/no-wall-clock-assertion.ts';
import { requireSkipReasonRule } from './rules/require-skip-reason.ts';

const pluginName = '@mkaradeniz/test-hygiene';

const plugin = eslintCompatPlugin(
  definePlugin({
    meta: {
      name: pluginName,
    },
    rules: {
      'no-polling-loop': noPollingLoopRule,
      'no-real-time-wait': noRealTimeWaitRule,
      'no-test-timeout-or-retry': noTestTimeoutOrRetryRule,
      'no-wall-clock-assertion': noWallClockAssertionRule,
      'require-skip-reason': requireSkipReasonRule,
    },
  }),
);

/**
 * Oxlint config that loads the plugin and enables every rule as an error.
 * Add it to the `extends` array of an `oxlint.config.ts`.
 */
export const recommended = {
  jsPlugins: [
    {
      name: pluginName,
      specifier: '@mkaradeniz/oxlint-plugin-test-hygiene',
    },
  ],
  rules: {
    '@mkaradeniz/test-hygiene/no-polling-loop': 'error',
    '@mkaradeniz/test-hygiene/no-real-time-wait': 'error',
    '@mkaradeniz/test-hygiene/no-test-timeout-or-retry': 'error',
    '@mkaradeniz/test-hygiene/no-wall-clock-assertion': 'error',
    '@mkaradeniz/test-hygiene/require-skip-reason': 'error',
  },
} satisfies {
  jsPlugins: Array<{ name: string; specifier: string }>;
  rules: Record<string, 'error'>;
};

export default plugin;
