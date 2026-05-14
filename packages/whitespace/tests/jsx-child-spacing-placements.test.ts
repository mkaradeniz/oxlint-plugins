import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/jsx-child-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} placements`, () => {
  it('adds blank lines to JSX inside return statements', async () => {
    const fixture = await createFixture({
      input: 'const View = () => {\n  return <div>\n    <Header />\n    <Main />\n  </div>;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const View = () => {\n  return <div>\n    <Header />\n\n    <Main />\n  </div>;\n};\n',
    );
  });

  it('adds blank lines to JSX assigned to const declarations', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\n  <Header />\n  <Main />\n</div>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  <Header />\n\n  <Main />\n</div>;\n');
  });

  it('adds blank lines to JSX inside array maps', async () => {
    const fixture = await createFixture({
      input: 'const view = items.map(item => <article key={item.id}>\n  <Header />\n  <Main />\n</article>);\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = items.map(item => <article key={item.id}>\n  <Header />\n\n  <Main />\n</article>);\n',
    );
  });

  it('adds blank lines to JSX inside conditional returns', async () => {
    const fixture = await createFixture({
      input:
        'const View = ({ ready }) => {\n  if (ready) {\n    return <div>\n      <Header />\n      <Main />\n    </div>;\n  }\n\n  return null;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const View = ({ ready }) => {\n  if (ready) {\n    return <div>\n      <Header />\n\n      <Main />\n    </div>;\n  }\n\n  return null;\n};\n',
    );
  });

  it('adds blank lines after oxfmt expands same-line JSX children', async () => {
    const fixture = await createFixture({ input: 'const view=<div><Header/><Main/></div>;\n', ruleId });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = (\n  <div>\n    <Header />\n\n    <Main />\n  </div>\n);\n');
  });
});
