import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/jsx-child-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(ruleId, () => {
  it('adds blank lines between significant JSX element children', async () => {
    const fixture = await createFixture({ input: 'const view = <div>\n  <Header />\n  <Main />\n  <Footer />\n</div>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n  <Header />\n\n  <Main />\n\n  <Footer />\n</div>;\n');
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('preserves CRLF line endings when adding JSX child spacing', async () => {
    const fixture = await createFixture({ input: 'const view = <div>\r\n  <Header />\r\n  <Main />\r\n</div>;\r\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\r\n  <Header />\r\n\r\n  <Main />\r\n</div>;\r\n');
  });

  it('adds blank lines between fragment children and expression containers', async () => {
    const fixture = await createFixture({
      input: 'const view = <>\n  {items.map(item => (\n    <Item key={item.id} />\n  ))}\n  <Button>Apply</Button>\n</>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <>\n  {items.map(item => (\n    <Item key={item.id} />\n  ))}\n\n  <Button>Apply</Button>\n</>;\n',
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('does not split compact parent controls', async () => {
    const fixture = await createFixture({ input: 'const view = <Button>\n  <Icon className="size-4" />\n  Save\n</Button>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const view = <Button>\n  <Icon className="size-4" />\n  Save\n</Button>;\n');
  });

  it('does not add blank lines inside same-line mixed prose flow', async () => {
    const fixture = await createFixture({ input: 'const view = <p>Paid by {payer.name}</p>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const view = <p>Paid by {payer.name}</p>;\n');
  });

  it('does not add blank lines between adjacent same-line JSX children', async () => {
    const input = 'const view = <div><Header /><Main /></div>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not split explicit JSX space expressions from inline prose controls', async () => {
    const fixture = await createFixture({
      input: "const view = <div>\n  or{' '}\n  <button type=\"button\">share the link</button>{' '}\n</div>;\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      "const view = <div>\n  or{' '}\n  <button type=\"button\">share the link</button>{' '}\n</div>;\n",
    );
  });

  it('does not split inline JSX elements adjacent to prose text', async () => {
    const fixture = await createFixture({
      input:
        'const view = <>\n  <b>Receipt <Amount cents={amount} /></b>\n  <br />\n  {count} people will see their balance change.\n</>;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <>\n  <b>Receipt <Amount cents={amount} /></b>\n  <br />\n  {count} people will see their balance change.\n</>;\n',
    );
  });

  it('adds blank lines between adjacent expression containers', async () => {
    const fixture = await createFixture({ input: 'const view = <p>\n  {name}\n  {amount}\n</p>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <p>\n  {name}\n\n  {amount}\n</p>;\n');
  });

  it('adds blank lines between separate inline element siblings', async () => {
    const fixture = await createFixture({ input: 'const view = <p>\n  <span>{name}</span>\n  <span>{amount}</span>\n</p>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <p>\n  <span>{name}</span>\n\n  <span>{amount}</span>\n</p>;\n');
  });

  it('uses configured compact parent exceptions', async () => {
    const fixture = await createFixture({
      input: 'const view = <ToolbarButton>\n  <Icon />\n  <span>Save</span>\n</ToolbarButton>;\n',
      ruleId,
      ruleOptions: { compactParents: ['ToolbarButton'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const view = <ToolbarButton>\n  <Icon />\n  <span>Save</span>\n</ToolbarButton>;\n');
  });

  it('matches compact parent exceptions against JSX member expression names', async () => {
    const input = 'const view = <Toolbar.Button>\n  <Icon />\n  <span>Save</span>\n</Toolbar.Button>;\n';
    const fixture = await createFixture({
      input,
      ruleId,
      ruleOptions: { compactParents: ['Button'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not treat namespaced JSX parent names as compact exceptions', async () => {
    const fixture = await createFixture({
      input: 'const view = <svg:path>\n  <Icon />\n  <span>Save</span>\n</svg:path>;\n',
      ruleId,
      ruleOptions: { compactParents: ['path'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <svg:path>\n  <Icon />\n\n  <span>Save</span>\n</svg:path>;\n');
  });

  it('keeps JSX child spacing converged with oxfmt', async () => {
    const fixture = await createFixture({ input: 'const view=<div><Header/><Main/><Footer/></div>;\n', ruleId });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = (\n  <div>\n    <Header />\n\n    <Main />\n\n    <Footer />\n  </div>\n);\n',
    );
  });
});
