import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/statement-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} misc syntax`, () => {
  it('separates await groups from following non-await work', async () => {
    const fixture = await createFixture({
      input: 'const save = async () => {\n  await onUpdate();\n  await refetch();\n  setEditingComment(null);\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const save = async () => {\n  await onUpdate();\n  await refetch();\n\n  setEditingComment(null);\n};\n',
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('separates top-level await groups from following non-await work', async () => {
    const fixture = await createFixture({
      input: 'await onUpdate();\nawait refetch();\nsetEditingComment(null);\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('await onUpdate();\nawait refetch();\n\nsetEditingComment(null);\n');
  });

  it('does not treat await inside variable declarations as await statement groups', async () => {
    const fixture = await createFixture({
      input: 'const first = await save();\nconst second = read();\nsetResult(second);\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const first = await save();\nconst second = read();\n\nsetResult(second);\n');
  });

  it('preserves tab indentation when adding statement spacing', async () => {
    const fixture = await createFixture({
      input: 'const readValue = () => {\n\tconst value = 1;\n\treturn value;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n\tconst value = 1;\n\n\treturn value;\n};\n');
  });

  it('preserves CRLF line endings with nested indentation', async () => {
    const fixture = await createFixture({
      input: 'const readValue = () => {\r\n  if (ready) {\r\n    const value = 1;\r\n    return value;\r\n  }\r\n};\r\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const readValue = () => {\r\n  if (ready) {\r\n    const value = 1;\r\n\r\n    return value;\r\n  }\r\n};\r\n',
    );
  });

  it('keeps multiple blank lines converged with oxfmt', async () => {
    const fixture = await createFixture({
      input: 'const readValue = () => {\n  const value = 1;\n\n\n  return value;\n};\n',
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n  const value = 1;\n\n  return value;\n};\n');
  });

  it('separates using declarations from following action statements when parsed by Oxlint', async () => {
    const fixture = await createFixture({
      input: 'const run = () => {\n  using resource = acquire();\n  use(resource);\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('const run = () => {\n  using resource = acquire();\n\n  use(resource);\n};\n');
  });

  it('separates decorated declarations from following action statements when parsed by Oxlint', async () => {
    const fixture = await createFixture({
      input: '@sealed\nclass Service {}\nlog(Service);\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('@sealed\nclass Service {}\n\nlog(Service);\n');
  });

  it('keeps semicolon-less input converged after oxfmt normalization', async () => {
    const fixture = await createFixture({
      input: 'const readValue=()=>{\nconst value=1\nreturn value\n}\n',
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('does not change files with no relevant statement boundaries', async () => {
    const input = 'setName(next);\nsetPlaceholderName(next);\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('leaves parse-error fixtures unchanged', async () => {
    const input = 'const broken = ;\nreturn broken;\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });
});
