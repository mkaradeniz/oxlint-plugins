import { afterAll, describe, it } from 'vitest';

import { cleanupFixtures, expectRuleCases } from './test-helpers.ts';

const ruleId = '@mkaradeniz/test-hygiene/require-skip-reason';
const message = 'Add a `// quarantine: <issue reference> <reason>` comment';

describe.concurrent(ruleId, () => {
  it('reports skipped, pending, and fixme tests without a quarantine comment', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { describe, it, test } from 'vitest';

it.skip('a', () => {}); // reported
test.skip('b', () => {}); // reported
describe.skip('c', () => {}); // reported
it.todo('d'); // reported
test.todo('e'); // reported
it.concurrent.skip('f', async () => {}); // reported
it.skip.each([1, 2])('g %i', value => {}); // reported
xit('h', () => {}); // reported
xdescribe('i', () => {}); // reported
// skipped until the API is back
it.skip('j', () => {}); // reported
/* quarantine: APP-924 flaky on CI */
it.skip('k', () => {}); // reported
// quarantine: flaky on CI
it.skip('l', () => {}); // reported
// quarantine: APP-924
it.skip('m', () => {}); // reported
// quarantine: APP-924 flaky on CI

it.skip('n', () => {}); // reported
`,
        },
        {
          input: `import { test } from '@playwright/test';

test.fixme('a', async () => {}); // reported
test.describe.skip('b', () => {}); // reported
test.describe.fixme('c', () => {}); // reported

test('d', async () => {
  test.skip(); // reported
  test.skip(true, 'broken'); // reported
  test.fixme(); // reported
});
`,
          path: 'e2e/skip.spec.ts',
        },
        {
          input: `import { describe, it, test } from 'node:test';

test('a', { skip: true }, () => {}); // reported
it('b', { todo: true }, () => {}); // reported
describe('c', { skip: 'not ready' }, () => {}); // reported
test('d', { todo: \`later\` }); // reported

test('e', async t => {
  await t.test('f', { skip: true }, () => {}); // reported
});
`,
        },
      ],
      message,
      ruleId,
    });
  });

  it('allows quarantined skips, conditional skips, and active tests', async () => {
    await expectRuleCases({
      cases: [
        {
          input: `import { describe, it, test } from 'vitest';

// quarantine: APP-924 flaky clock on CI
it.skip('a', () => {});
// quarantine: #123 waits for the upstream fix
describe.skip('b', () => {});
// quarantine: mkaradeniz/oxlint-plugins#7 depends on a release
it.todo('c');
// quarantine: https://linear.app/apps/issue/APP-924 needs a seeded database
test.skip.each([1])('d %i', value => {});
// quarantine: APP-1 blocked by staging
await it.skip('e', () => {});

it.skipIf(process.platform === 'win32')('f', () => {});
it.runIf(isCi)('g', () => {});
it('h', () => {});
it.only('i', () => {});
`,
        },
        {
          input: `import { test } from '@playwright/test';

test('a', async ({ browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit has no clipboard API');
  test.fixme(isMobile, 'Layout differs on mobile');
});

test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no WebUSB');
`,
          path: 'e2e/conditional.spec.ts',
        },
        {
          input: `import { test } from 'node:test';

test('a', { skip: process.platform === 'win32' }, () => {});
test('b', { skip: false, todo: false }, () => {});

// quarantine: APP-924 depends on the mock server
test('c', { skip: true }, () => {});

test('d', t => {
  t.skip('not supported here');
  t.todo();
});
`,
        },
        {
          input: `it.skip('a', () => {});
`,
          path: 'src/setup.ts',
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
