import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/statement-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} control flow`, () => {
  it('wraps if statements with sibling whitespace', async () => {
    const fixture = await createFixture({
      input: 'const readValue = () => {\n  const value = read();\n  if (!value) {\n    return null;\n  }\n  setValue(value);\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const readValue = () => {\n  const value = read();\n\n  if (!value) {\n    return null;\n  }\n\n  setValue(value);\n};\n',
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('separates returns that follow control-flow statements', async () => {
    const fixture = await createFixture({
      input: 'const readValue = () => {\n  if (!ready) {\n    prepare();\n  }\n  return read();\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const readValue = () => {\n  if (!ready) {\n    prepare();\n  }\n\n  return read();\n};\n',
    );
  });

  it('separates consecutive guard if statements', async () => {
    const fixture = await createFixture({
      input: 'const save = () => {\n  if (pending) {\n    return;\n  }\n  if (!deviceId) {\n    return;\n  }\n  persist();\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const save = () => {\n  if (pending) {\n    return;\n  }\n\n  if (!deviceId) {\n    return;\n  }\n\n  persist();\n};\n',
    );
  });

  it('wraps loop, switch, and try statements with sibling whitespace', async () => {
    const fixture = await createFixture({
      input:
        'const run = () => {\n  prepare();\n  for (let index = 0; index < items.length; index += 1) {\n    visit(items[index]);\n  }\n  for (const item of items) {\n    visit(item);\n  }\n  for (const key in map) {\n    visit(map[key]);\n  }\n  while (pending()) {\n    tick();\n  }\n  do {\n    tick();\n  } while (pending());\n  switch (kind) {\n    case "a":\n      break;\n  }\n  try {\n    save();\n  } catch {\n    recover();\n  }\n  finish();\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const run = () => {\n  prepare();\n\n  for (let index = 0; index < items.length; index += 1) {\n    visit(items[index]);\n  }\n\n  for (const item of items) {\n    visit(item);\n  }\n\n  for (const key in map) {\n    visit(map[key]);\n  }\n\n  while (pending()) {\n    tick();\n  }\n\n  do {\n    tick();\n  } while (pending());\n\n  switch (kind) {\n    case "a":\n      break;\n  }\n\n  try {\n    save();\n  } catch {\n    recover();\n  }\n\n  finish();\n};\n',
    );
  });

  it('checks nested blocks independently', async () => {
    const fixture = await createFixture({
      input: 'const run = () => {\n  if (ready) {\n    const value = read();\n    setValue(value);\n    return;\n  }\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'const run = () => {\n  if (ready) {\n    const value = read();\n\n    setValue(value);\n\n    return;\n  }\n};\n',
    );
  });

  it('does not move comments while trying to wrap control flow', async () => {
    const input = 'const run = () => {\n  prepare();\n  // Keep this note with the branch.\n  if (ready) {\n    save();\n  }\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not split if and else branches', async () => {
    const fixture = await createFixture({
      input: 'const toggle = next => {\n  if (next.has(id)) {\n    next.delete(id);\n  } else {\n    next.add(id);\n  }\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      'const toggle = next => {\n  if (next.has(id)) {\n    next.delete(id);\n  } else {\n    next.add(id);\n  }\n};\n',
    );
  });
});
