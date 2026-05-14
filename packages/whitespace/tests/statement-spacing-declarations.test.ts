import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/statement-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} declarations`, () => {
  it('separates declaration runs from action statements', async () => {
    const fixture = await createFixture({
      input:
        'const update = () => {\n  const first = readFirst();\n  const second = readSecond();\n  setFirst(first);\n  setSecond(second);\n  const done = true;\n  log(done);\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const update = () => {\n  const first = readFirst();\n  const second = readSecond();\n\n  setFirst(first);\n  setSecond(second);\n\n  const done = true;\n\n  log(done);\n};\n',
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('separates class, type, interface, and enum declarations from action statements', async () => {
    const fixture = await createFixture({
      input:
        'class Result {}\nlog(Result);\ntype Value = string;\nlogValue();\ninterface Named {\n  name: string;\n}\nlogNamed();\nenum Status {\n  Ready = "ready",\n}\nlogStatus();\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'class Result {}\n\nlog(Result);\n\ntype Value = string;\n\nlogValue();\n\ninterface Named {\n  name: string;\n}\n\nlogNamed();\n\nenum Status {\n  Ready = "ready",\n}\n\nlogStatus();\n',
    );
  });

  it('separates action statements from following function declarations', async () => {
    const fixture = await createFixture({
      input: 'logStart();\nfunction readValue() {\n  return 1;\n}\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe('logStart();\n\nfunction readValue() {\n  return 1;\n}\n');
  });

  it('treats throw statements as action boundaries', async () => {
    const fixture = await createFixture({
      input: 'const message = readMessage();\nthrow new Error(message);\nconst fallback = readFallback();\nreturn fallback;\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const message = readMessage();\n\nthrow new Error(message);\n\nconst fallback = readFallback();\n\nreturn fallback;\n',
    );
  });

  it('separates consecutive multiline function-like declarations', async () => {
    const fixture = await createFixture({
      input: 'const saveComment = async () => {\n  await onUpdate();\n};\nconst deleteComment = async () => {\n  await onDelete();\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const saveComment = async () => {\n  await onUpdate();\n};\n\nconst deleteComment = async () => {\n  await onDelete();\n};\n',
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('separates consecutive multiline function declarations', async () => {
    const fixture = await createFixture({
      input: 'function saveComment() {\n  persistComment();\n}\nfunction deleteComment() {\n  removeComment();\n}\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'function saveComment() {\n  persistComment();\n}\n\nfunction deleteComment() {\n  removeComment();\n}\n',
    );
  });

  it('keeps one-line function declarations grouped', async () => {
    const input = 'const first = () => readFirst();\nconst second = () => readSecond();\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not treat multiline object declarations as function-like declarations', async () => {
    const input = 'const first = {\n  value: 1,\n};\nconst second = {\n  value: 2,\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });
});
