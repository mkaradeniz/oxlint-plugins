import { afterAll, describe, it } from 'vitest';

import { cleanupFixtures, expectRuleCases } from './test-helpers.ts';

const ruleId = '@mkaradeniz/test-hygiene/no-real-time-wait';
const message = 'Do not wait for real time in tests';

describe.concurrent(ruleId, () => {
  it('reports setTimeout promises, awaited sleep helpers, timer promises, and page.waitForTimeout', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { it } from 'vitest';

it('waits', async () => {
  await new Promise(resolve => setTimeout(resolve, 100)); // reported
  await new Promise(r => globalThis.setTimeout(r, 100)); // reported
  await new Promise(resolve => setTimeout(() => resolve(), 50)); // reported
  await new Promise(function (resolve) { // reported
    setTimeout(resolve, 10);
  });
  const pending = new Promise<void>(resolve => { // reported
    return setTimeout(() => {
      resolve();
    }, 10);
  });
  await pending;
  await sleep(10); // reported
  await delay(10); // reported
});
`,
        },
        {
          input: `import { setTimeout as wait } from 'node:timers/promises';
import { setTimeout } from 'timers/promises';

it('waits', async () => {
  await wait(10); // reported
  await setTimeout(10); // reported
});
`,
        },
        {
          input: `import { test } from '@playwright/test';

test('waits', async ({ page }) => {
  await page.waitForTimeout(500); // reported
  page.waitForTimeout(500); // reported
});
`,
          path: 'e2e/login.spec.ts',
        },
      ],
      message,
      ruleId,
    });
  });

  it('allows condition waits, timeout guards, unawaited helpers, and fake timers', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { expect, it, vi } from 'vitest';

it('waits for conditions', async () => {
  await vi.waitFor(() => expect(spy).toHaveBeenCalled());
  await expect.poll(() => counter.value).toBe(3);
  await new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
  await new Promise(resolve => emitter.once('ready', resolve));
  const timer = setTimeout(callback, 100);
  clearTimeout(timer);
  const later = sleep(10);
  await helpers.sleep(10);
  await scheduler.delay;
});
`,
        },
        {
          input: `import { afterEach, beforeEach, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('advances fake time', async () => {
  const done = new Promise(resolve => setTimeout(resolve, 1000));
  vi.advanceTimersByTime(1000);
  await done;
  const slept = sleep(100);
  await vi.advanceTimersByTimeAsync(100);
  await slept;
});
`,
        },
        {
          input: `import { mock, test } from 'node:test';

test('uses mock timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const done = new Promise(resolve => setTimeout(resolve, 1000));
  t.mock.timers.tick(1000);
  await done;
});
`,
        },
      ],
      message,
      ruleId,
    });
  });

  it('still reports page.waitForTimeout when fake timers are enabled', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `test('waits', async ({ page }) => {
  await page.clock.install();
  await page.waitForTimeout(100); // reported
});
`,
          path: 'tests/clock.spec.ts',
        },
      ],
      message,
      ruleId,
    });
  });

  it('ignores files outside the test file pattern', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `export const pause = async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  await sleep(10);
};
`,
          path: 'src/pause.ts',
        },
        {
          input: `await new Promise(resolve => setTimeout(resolve, 100)); // reported
`,
          path: 'tests/helpers/pause.ts',
        },
        {
          input: `await new Promise(resolve => setTimeout(resolve, 100)); // reported
`,
          path: 'src/__tests__/pause.ts',
        },
      ],
      message,
      ruleId,
    });
  });

  it('uses the testFilePattern option instead of the default pattern', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `await sleep(10); // reported
`,
          path: 'e2e/flows/checkout.ts',
        },
        {
          input: `await sleep(10);
`,
          path: 'src/checkout.test.ts',
        },
      ],
      message,
      ruleId,
      ruleOptions: { testFilePattern: '^e2e/' },
    });
  });
});

afterAll(async () => {
  await cleanupFixtures();
});
