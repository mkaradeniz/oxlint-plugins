import { afterAll, describe, it } from 'vitest';

import { cleanupFixtures, expectRuleCases } from './test-helpers.ts';

const ruleId = '@mkaradeniz/test-hygiene/no-polling-loop';
const message = 'Do not poll in a sleep loop in tests';

describe.concurrent(ruleId, () => {
  it('reports while, do-while, and for loops that sleep between checks', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { setTimeout as wait } from 'node:timers/promises';

it('polls', async () => {
  while (!server.ready) { // reported
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  do { // reported
    status = await fetchStatus();
    await sleep(100);
  } while (status !== 'done');

  for (let attempt = 0; attempt < 10; attempt += 1) { // reported
    if (await isReady()) {
      break;
    }

    await wait(20);
    await delay(20);
  }
});
`,
        },
        {
          input: `test('polls the page', async ({ page }) => {
  while (!(await page.isVisible('#done'))) { // reported
    await page.waitForTimeout(100);
  }
});
`,
          path: 'e2e/done.spec.ts',
        },
      ],
      message,
      ruleId,
    });
  });

  it('allows loops without sleeps, sleeps in nested functions, iteration loops, and fake timers', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `it('loops', async () => {
  while (queue.length > 0) {
    await queue.shift()();
  }

  for (const item of items) {
    await sleep(10);
  }

  while (pending) {
    callbacks.push(async () => {
      await sleep(10);
    });
    pending = false;
  }
});
`,
        },
        {
          input: `import { vi } from 'vitest';

vi.useFakeTimers();

it('advances fake time in a loop', async () => {
  while (!done) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
});
`,
        },
        {
          input: `export const waitUntil = async (check: () => boolean) => {
  while (!check()) {
    await sleep(10);
  }
};
`,
          path: 'src/wait-until.ts',
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
          input: `while (!ready) { // reported
  await sleep(10);
}
`,
          path: 'support/wait.ts',
        },
      ],
      message,
      ruleId,
      ruleOptions: { testFilePattern: '^support/' },
    });
  });
});

afterAll(async () => {
  await cleanupFixtures();
});
