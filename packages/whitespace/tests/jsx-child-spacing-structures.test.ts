import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/jsx-child-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} structures`, () => {
  it('adds blank lines between table row cells', async () => {
    const fixture = await createFixture({
      input: 'const view = <tr>\n  <td>Name</td>\n  <td>Amount</td>\n  <td>Status</td>\n</tr>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <tr>\n  <td>Name</td>\n\n  <td>Amount</td>\n\n  <td>Status</td>\n</tr>;\n',
    );
  });

  it('adds blank lines between list items', async () => {
    const fixture = await createFixture({ input: 'const view = <ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <ul>\n  <li>One</li>\n\n  <li>Two</li>\n</ul>;\n');
  });

  it('adds blank lines inside definition lists', async () => {
    const fixture = await createFixture({ input: 'const view = <dl>\n  <dt>Name</dt>\n  <dd>Amount</dd>\n</dl>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <dl>\n  <dt>Name</dt>\n\n  <dd>Amount</dd>\n</dl>;\n');
  });

  it('adds blank lines between nested fragment siblings', async () => {
    const fixture = await createFixture({ input: 'const view = <>\n  <>\n    <Header />\n  </>\n  <Main />\n</>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <>\n  <>\n    <Header />\n  </>\n\n  <Main />\n</>;\n');
  });

  it('adds blank lines between portal-like and slot-like children', async () => {
    const fixture = await createFixture({ input: 'const view = <Layer>\n  <Portal />\n  <Slot />\n</Layer>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <Layer>\n  <Portal />\n\n  <Slot />\n</Layer>;\n');
  });

  it('adds blank lines between SVG children', async () => {
    const fixture = await createFixture({ input: 'const view = <svg>\n  <path d="M0 0" />\n  <circle r="4" />\n</svg>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <svg>\n  <path d="M0 0" />\n\n  <circle r="4" />\n</svg>;\n');
  });
});
