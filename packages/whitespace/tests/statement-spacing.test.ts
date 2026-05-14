import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/statement-spacing';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(ruleId, () => {
  it('adds one blank line after a top-level import block', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\nconst value = cn('x');\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe("import { cn } from '@/lib/utils';\n\nconst value = cn('x');\n");
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('keeps consecutive imports grouped before separating the next statement', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\nimport { format } from '@/lib/format';\nconst value = cn(format(1));\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "import { cn } from '@/lib/utils';\nimport { format } from '@/lib/format';\n\nconst value = cn(format(1));\n",
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('does not change whitespace inside the import block', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\n\nimport { format } from '@/lib/format';\n\nconst value = cn(format(1));\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      "import { cn } from '@/lib/utils';\n\nimport { format } from '@/lib/format';\n\nconst value = cn(format(1));\n",
    );
  });

  it('keeps import block spacing converged with oxfmt', async () => {
    const fixture = await createFixture({
      input: "import{cn}from'@/lib/utils';\nconst value=cn('x');\n",
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe("import { cn } from '@/lib/utils';\n\nconst value = cn('x');\n");
  });

  it('preserves CRLF line endings when adding import block spacing', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\r\nconst value = cn('x');\r\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe("import { cn } from '@/lib/utils';\r\n\r\nconst value = cn('x');\r\n");
  });

  it('keeps type-only imports inside the import block', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\nimport { type ReactNode } from 'react';\nconst value: ReactNode = cn('x');\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "import { cn } from '@/lib/utils';\nimport { type ReactNode } from 'react';\n\nconst value: ReactNode = cn('x');\n",
    );
  });

  it('separates imports from exported value and type declarations', async () => {
    const fixture = await createFixture({
      input: "import { cn } from '@/lib/utils';\nexport const value = cn('x');\nexport type Value = typeof value;\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "import { cn } from '@/lib/utils';\n\nexport const value = cn('x');\nexport type Value = typeof value;\n",
    );
  });

  it('keeps side-effect imports inside the import block', async () => {
    const fixture = await createFixture({
      input: "import './globals.css';\nimport { cn } from '@/lib/utils';\nconst value = cn('x');\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "import './globals.css';\nimport { cn } from '@/lib/utils';\n\nconst value = cn('x');\n",
    );
  });

  it('does not move comments while trying to add import block spacing', async () => {
    const input = "import { cn } from '@/lib/utils';\n// Keep this header comment attached.\nconst value = cn('x');\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('separates re-export headers from following runtime work', async () => {
    const fixture = await createFixture({
      input: "export * from './tokens';\nexport { cn } from '@/lib/utils';\nconst value = cn('x');\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "export * from './tokens';\nexport { cn } from '@/lib/utils';\n\nconst value = cn('x');\n",
    );
  });

  it('adds one blank line before return statements with a previous sibling', async () => {
    const fixture = await createFixture({ input: 'const readValue = () => {\n  const value = 1;\n  return value;\n};\n', ruleId });

    await runOxlintFix(fixture);

    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n  const value = 1;\n\n  return value;\n};\n');
  });

  it('is idempotent after applying a return spacing fix', async () => {
    const fixture = await createFixture({ input: 'const readValue = () => {\n  const value = 1;\n  return value;\n};\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('does not add a blank line when return is the first statement in a block', async () => {
    const fixture = await createFixture({ input: 'const readValue = () => {\n  return 1;\n};\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n  return 1;\n};\n');
  });

  it('does not add duplicate blank lines before an already separated return', async () => {
    const fixture = await createFixture({ input: 'const readValue = () => {\n  const value = 1;\n\n  return value;\n};\n', ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n  const value = 1;\n\n  return value;\n};\n');
  });

  it('does not move comments while trying to add return spacing', async () => {
    const input =
      'const readValue = () => {\n  const value = 1;\n  // Keep this explanation attached to the return.\n  return value;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('converges with oxfmt instead of fighting formatter output', async () => {
    const fixture = await createFixture({ input: 'const readValue=()=>{\nconst value=1;\nreturn value;\n};\n', ruleId });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const readValue = () => {\n  const value = 1;\n\n  return value;\n};\n');
  });

  it('keeps all statement spacing fixes converged with oxfmt', async () => {
    const fixture = await createFixture({
      input:
        'const run=async()=>{\nconst value=read();\nif(!value){\nreturn null;\n}\nawait save();\nawait refetch();\nsetDone(true);\nconst response=jsonResponse();\nreturn response;\n};\n',
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(
      'const run = async () => {\n  const value = read();\n\n  if (!value) {\n    return null;\n  }\n\n  await save();\n  await refetch();\n\n  setDone(true);\n\n  const response = jsonResponse();\n\n  return response;\n};\n',
    );
  });
});
