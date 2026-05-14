import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { packageRoot, runPnpmExec } from './test-helpers.ts';

const componentShapeCode = '@mkaradeniz/react-structure(component-module-shape)';
const whitespaceCode = '@mkaradeniz/whitespace(statement-spacing)';
const fixturePaths = new Set<string>();

const componentModuleInput =
  'export const First = () => {\n  return <div>First</div>;\n};\n\nexport const Second = () => {\n  return <div>Second</div>;\n};\n\nconst normalize = (value: string) => {\n  return value.trim();\n};\n';
const whitespaceInput = 'import { value } from "./value";\nconst doubled = value * 2;\n';

const createRepoFixture = async ({
  fixtureRelativePath,
  input = componentModuleInput,
}: {
  fixtureRelativePath: string;
  input?: string;
}) => {
  const fixturePath = path.join(packageRoot, fixtureRelativePath);

  fixturePaths.add(fixturePath);
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, input);

  return fixturePath;
};

const runRootOxlintJson = async ({ fixturePath }: { fixturePath: string }) => {
  const result = await runPnpmExec({
    args: ['oxlint', '-c', 'oxlint.config.ts', '--format', 'json', fixturePath],
  }).catch(error => error as { stdout: string });
  const jsonStart = result.stdout.indexOf('{');

  return JSON.parse(result.stdout.slice(jsonStart)) as { diagnostics: Array<{ code?: string }> };
};

afterEach(async () => {
  await Promise.all(Array.from(fixturePaths, fixturePath => rm(fixturePath, { force: true })));

  fixturePaths.clear();
});

describe('react-structure dev config', () => {
  it('uses shared whitespace rules for package linting', async () => {
    const fixturePath = await createRepoFixture({
      fixtureRelativePath: '__oxlint_whitespace_fixture.ts',
      input: whitespaceInput,
    });

    const result = await runRootOxlintJson({ fixturePath });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: whitespaceCode }));
  });

  it('does not dogfood component-module-shape against this package', async () => {
    const fixturePath = await createRepoFixture({
      fixtureRelativePath: '__oxlint_component_shape_fixture.tsx',
    });

    const result = await runRootOxlintJson({ fixturePath });

    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: componentShapeCode }));
  });
});
