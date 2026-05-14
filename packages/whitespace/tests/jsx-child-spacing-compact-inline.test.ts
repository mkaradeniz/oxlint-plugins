import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/jsx-child-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} compact and inline flow`, () => {
  it('does not match lowercase compact parent config against uppercase components', async () => {
    const fixture = await createFixture({
      input: 'const view = <Button>\n  <Icon />\n  <span>Save</span>\n</Button>;\n',
      ruleId,
      ruleOptions: { compactParents: ['button'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <Button>\n  <Icon />\n\n  <span>Save</span>\n</Button>;\n');
  });

  it('uses JSX member expression property names for compact parent matching', async () => {
    const input = 'const view = <Toolbar.Button>\n  <Icon />\n  <span>Save</span>\n</Toolbar.Button>;\n';
    const fixture = await createFixture({ input, ruleId, ruleOptions: { compactParents: ['Button'] } });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not match full JSX member expression names as compact parents', async () => {
    const fixture = await createFixture({
      input: 'const view = <Toolbar.Button>\n  <Icon />\n  <span>Save</span>\n</Toolbar.Button>;\n',
      ruleId,
      ruleOptions: { compactParents: ['Toolbar.Button'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <Toolbar.Button>\n  <Icon />\n\n  <span>Save</span>\n</Toolbar.Button>;\n',
    );
  });

  it('replaces default compact parents when custom compact parent config is provided', async () => {
    const fixture = await createFixture({
      input: 'const view = <Button>\n  <Icon />\n  <span>Save</span>\n</Button>;\n',
      ruleId,
      ruleOptions: { compactParents: ['ToolbarButton'] },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <Button>\n  <Icon />\n\n  <span>Save</span>\n</Button>;\n');
  });

  it('uses default compact parent exceptions for Button, IconButton, and Link', async () => {
    const input =
      'const view = <>\n  <Button>\n    <Icon />\n    <span>Save</span>\n  </Button>\n  <IconButton>\n    <Icon />\n    <span>Save</span>\n  </IconButton>\n  <Link>\n    <Icon />\n    <span>Save</span>\n  </Link>\n</>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <>\n  <Button>\n    <Icon />\n    <span>Save</span>\n  </Button>\n\n  <IconButton>\n    <Icon />\n    <span>Save</span>\n  </IconButton>\n\n  <Link>\n    <Icon />\n    <span>Save</span>\n  </Link>\n</>;\n',
    );
  });

  it('does not split explicit JSX space expressions before or after children', async () => {
    const input = "const view = <div>\n  {' '}\n  <Icon />{' '}\n</div>;\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not split text before or after inline children', async () => {
    const input = 'const view = <p>\n  Paid by\n  <strong>{name}</strong>\n  today\n</p>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not split br elements before or after inline children', async () => {
    const input = 'const view = <p>\n  <br />\n  <span>{name}</span>\n  <br />\n</p>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not split inline code and prose flow', async () => {
    const input = 'const view = <p>\n  <code>{value}</code>\n  means value\n</p>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores empty and whitespace-only expression containers', async () => {
    const input = "const view = <div>\n  <Header />\n  {}\n  {'   '}\n  <Footer />\n</div>;\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('preserves tab indentation when adding JSX child spacing', async () => {
    const fixture = await createFixture({ input: 'const view = <div>\n\t<Header />\n\t<Main />\n</div>;\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const view = <div>\n\t<Header />\n\n\t<Main />\n</div>;\n');
  });

  it('preserves CRLF with nested indentation', async () => {
    const fixture = await createFixture({
      input: 'const view = <div>\r\n  <section>\r\n    <Header />\r\n    <Main />\r\n  </section>\r\n</div>;\r\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const view = <div>\r\n  <section>\r\n    <Header />\r\n\r\n    <Main />\r\n  </section>\r\n</div>;\r\n',
    );
  });

  it('keeps already spaced JSX idempotent', async () => {
    const input = 'const view = <div>\n  <Header />\n\n  <Main />\n</div>;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('keeps multiple blank lines converged with oxfmt', async () => {
    const fixture = await createFixture({ input: 'const view = <div>\n  <Header />\n\n\n  <Main />\n</div>;\n', ruleId });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });
});
