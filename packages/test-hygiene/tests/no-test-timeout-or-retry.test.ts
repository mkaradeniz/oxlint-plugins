import { afterAll, describe, it } from 'vitest';

import { cleanupFixtures, expectRuleCases } from './test-helpers.ts';

const ruleId = '@mkaradeniz/test-hygiene/no-test-timeout-or-retry';
const timeoutMessage = 'Do not override test timeouts';
const retryMessage = 'Do not retry tests';

describe.concurrent(ruleId, () => {
  it('reports per-test timeout arguments, timeout options, and timeout config calls', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { describe, it, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 10_000 }); // reported

it('a', async () => {}, 5000); // reported
it.only('b', () => {}, TIMEOUT); // reported
test.concurrent('c', async () => {}, 2 * 1000); // reported
it('d', { timeout: 100 }, () => {}); // reported
it('e', () => {}, { timeout: 100 }); // reported
it.each([1, 2])('f %i', value => {}, 3000); // reported
describe('g', { timeout: 100 }, () => {}); // reported
`,
        },
        {
          input: `import { test } from '@playwright/test';

test.setTimeout(120_000); // reported
test.describe.configure({ mode: 'serial', timeout: 60_000 }); // reported
`,
          path: 'e2e/slow.spec.ts',
        },
        {
          input: `import { describe, it } from 'node:test';

describe('suite', { timeout: 500 }, () => { // reported
  it('case', { timeout: 100 }, async t => { // reported
    await t.test('subtest', { timeout: 50 }, () => {}); // reported
  });
});
jest.setTimeout(30_000); // reported
`,
        },
      ],
      message: timeoutMessage,
      ruleId,
    });
  });

  it('reports retry options and retry config calls', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `it('a', { retry: 3 }, () => {}); // reported
describe('b', { retry: 2 }, () => {}); // reported
vi.setConfig({ retry: 1 }); // reported
jest.retryTimes(2); // reported
`,
        },
        {
          input: `test.describe.configure({ retries: 2 }); // reported
test('a', { retries: 1 }, async () => {}); // reported
`,
          path: 'e2e/flaky.spec.ts',
        },
      ],
      message: retryMessage,
      ruleId,
    });
  });

  it('allows assertion timeouts, framework waits, plain tests, and serial mode', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('a', { tag: '@smoke' }, async ({ page }) => {
  await expect(page.getByText('done')).toBeVisible({ timeout: 10_000 });
  await page.waitForURL('/home', { timeout: 5000 });
  await expect.poll(() => count(), { timeout: 2000 }).toBe(1);
});
`,
          path: 'e2e/home.spec.ts',
        },
        {
          input: `import { describe, it, vi } from 'vitest';

vi.setConfig({ sequence: { shuffle: true } });

describe('suite', () => {
  it('works', () => {});
  it('works with options', { concurrent: true }, async () => {});
  it.todo('later');
  it.each([[1, 2]])('adds %i', (a, b) => {});
});
const ok = /x/.test('x', { timeout: 1 });
const match = server.setTimeout(5000);
`,
        },
        {
          input: `it('a', async () => {}, 5000);
`,
          path: 'src/setup.ts',
        },
      ],
      message: timeoutMessage,
      ruleId,
    });
  });
});

afterAll(async () => {
  await cleanupFixtures();
});
