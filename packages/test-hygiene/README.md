# @mkaradeniz/oxlint-plugin-test-hygiene

Oxlint rules for deterministic tests in Vitest, `node:test`, and Playwright.

## Install

```sh
pnpm add -D @mkaradeniz/oxlint-plugin-test-hygiene
```

## Usage

Extend the recommended config. It loads the plugin and enables every rule as an error.

```ts
import { recommended as testHygiene } from '@mkaradeniz/oxlint-plugin-test-hygiene';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [testHygiene],
});
```

To configure single rules, load the plugin yourself:

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: [
    {
      name: '@mkaradeniz/test-hygiene',
      specifier: '@mkaradeniz/oxlint-plugin-test-hygiene',
    },
  ],
  rules: {
    '@mkaradeniz/test-hygiene/no-real-time-wait': ['error', { testFilePattern: '^e2e/' }],
  },
});
```

## Test files

The rules check only test files. By default, a test file matches `*.test.*` or `*.spec.*`, or is in a `tests/` or `__tests__/` directory.

Each rule accepts a `testFilePattern` option. The value is a regular expression source. The rule tests it against the file path relative to the working directory, with forward slashes.

## Rules

- `@mkaradeniz/test-hygiene/no-real-time-wait`: reports `new Promise(resolve => setTimeout(resolve, ms))`, awaited `sleep(...)` and `delay(...)` calls, awaited `setTimeout` from `node:timers/promises`, and `page.waitForTimeout(...)`.
- `@mkaradeniz/test-hygiene/no-wall-clock-assertion`: reports a `Date.now()` or `performance.now()` delta in an `expect(...)` or `assert` call, or in a comparison.
- `@mkaradeniz/test-hygiene/no-test-timeout-or-retry`: reports a timeout argument after the test function, `timeout`, `retry`, and `retries` test options, `test.setTimeout(...)`, `jest.setTimeout(...)`, `jest.retryTimes(...)`, `vi.setConfig({ testTimeout, retry })`, and `test.describe.configure({ timeout, retries })`.
- `@mkaradeniz/test-hygiene/no-polling-loop`: reports a `while`, `do-while`, or `for` loop that awaits a sleep or a timer in its body.
- `@mkaradeniz/test-hygiene/require-skip-reason`: reports `it.skip`, `test.skip`, `describe.skip`, `it.todo`, `test.todo`, `test.fixme`, `xit`, `xtest`, `xdescribe`, and `node:test` `{ skip: true }` or `{ todo: true }` options without a quarantine comment on the line directly above.

A quarantine comment has an issue reference and a reason:

```ts
// quarantine: APP-924 flaky clock on CI
it.skip('renders the countdown', () => {});
```

The issue reference is a tracker key such as `APP-924`, a GitHub reference such as `#12` or `owner/repo#12`, or an `https://` URL.

## Allowed patterns

- Fake timers stay allowed: `vi.useFakeTimers()`, `vi.advanceTimersByTime(...)`, and `node:test` `mock.timers`. When a file enables fake timers, `no-real-time-wait` and `no-polling-loop` ignore timer-based waits in that file. `page.waitForTimeout(...)` always runs in real time and stays reported.
- Condition waits such as `vi.waitFor(...)`, `expect.poll(...)`, and Playwright locator assertions stay allowed, also with a `timeout` option.
- Conditional skips such as `it.skipIf(condition)`, `test.skip(browserName === 'webkit', 'reason')`, and `{ skip: process.platform === 'win32' }` stay allowed.

The rules are AST-based and do not use type information. They prefer a missed report on unusual code over a false report on normal code.
