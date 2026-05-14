import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/jsx-child-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} expressions`, () => {
  it('adds blank lines after conditional expression containers', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\n  {showHeader ? <Header /> : null}\n  <Main />\n</div>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  {showHeader ? <Header /> : null}\n\n  <Main />\n</div>;\n');
  });

  it('adds blank lines after logical expression containers', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\n  {showHeader && <Header />}\n  <Main />\n</div>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  {showHeader && <Header />}\n\n  <Main />\n</div>;\n');
  });

  it('adds blank lines after ternary branches that both render JSX', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\n  {kind === "a" ? <A /> : <B />}\n  <Footer />\n</div>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  {kind === "a" ? <A /> : <B />}\n\n  <Footer />\n</div>;\n');
  });

  it('does not add blank lines around null and false expression containers', async () => {
    const input = 'const view = <div>\n  <Header />\n  {null}\n  {false}\n  <Footer />\n</div>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not move JSX comments between children', async () => {
    const input = 'const view = <div>\n  <Header />\n  {/* Keep this comment attached. */}\n  <Main />\n</div>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not move comments attached to the next child', async () => {
    const input = 'const view = <div>\n  <Header />\n  {/* Main region */}\n  <Main />\n  <Footer />\n</div>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <div>\n  <Header />\n  {/* Main region */}\n  <Main />\n\n  <Footer />\n</div>;\n',
    );
  });

  it('adds blank lines after JSX spread children', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\n  {...children}\n  <Footer />\n</div>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  {...children}\n\n  <Footer />\n</div>;\n');
  });
});
