import { afterAll, describe, it } from 'vitest';

import { cleanupFixtures, expectRuleCases } from './test-helpers.ts';

const ruleId = '@mkaradeniz/test-hygiene/no-wall-clock-assertion';
const message = 'Do not assert on elapsed wall-clock time in tests';

describe.concurrent(ruleId, () => {
  it('reports wall-clock deltas in assertions and comparisons', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import assert from 'node:assert/strict';
import { expect, it } from 'vitest';

it('measures time', async () => {
  const start = Date.now();
  await run();
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(100); // reported
  expect(Date.now() - start).toBeGreaterThanOrEqual(50); // reported
  expect(Date.now() - start < 100).toBe(true); // reported
  assert.ok(elapsed < 100); // reported
  assert(elapsed); // reported
});

it('measures performance', () => {
  let before;
  before = performance.now();
  const after = globalThis.performance.now();
  const duration = (after - before) as number;

  if (duration > 16) { // reported
    throw new Error('slow');
  }

  t.assert.equal(after - before, 0); // reported
});
`,
        },
      ],
      message,
      ruleId,
    });
  });

  it('allows timestamps, offsets from constants, fake time, and unrelated deltas', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { expect, it, vi } from 'vitest';

it('uses time values', () => {
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  const now = Date.now();
  const deadline = Date.now() + 1000;
  const yesterday = Date.now() - 86_400_000;
  const age = Date.now() - user.createdAt;

  expect(now).toBe(1_767_225_600_000);
  expect(yesterday).toBeLessThan(now);
  expect(age).toBeGreaterThan(0);
  expect(end - start).toBe(10);
  expect(Date.now()).toBeGreaterThanOrEqual(deadline);
  log(Date.now() - now);
});
`,
        },
        {
          input: `const start = Date.now();
const elapsed = Date.now() - start;

if (elapsed > 100) {
  report(elapsed);
}
`,
          path: 'src/metrics.ts',
        },
      ],
      message,
      ruleId,
    });
  });

  it('forgets a binding after it is reassigned to a non-clock value', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `let elapsed = Date.now() - start;
let start = Date.now();
elapsed = Date.now() - start;
expect(elapsed).toBeLessThan(5); // reported
elapsed = 3;
expect(elapsed).toBe(3);
`,
        },
      ],
      message,
      ruleId,
    });
  });
});

afterAll(async () => {
  await cleanupFixtures();
});
