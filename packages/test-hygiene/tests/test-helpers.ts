import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect } from 'vitest';

const execFileAsync = promisify(execFile);

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pluginName = '@mkaradeniz/test-hygiene';
const pluginPath = path.join(packageRoot, 'index.ts');
const oxlintPath = path.join(packageRoot, 'node_modules', '.bin', 'oxlint');
const tempDirectories = new Set<string>();

export type FixtureInput = {
  input: string;
  path?: string;
};

type Diagnostic = {
  code: string;
  filename: string;
  labels: Array<{ span: { line: number } }>;
  message: string;
};

const createFixtureDirectory = async () => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'oxlint-plugin-')));

  tempDirectories.add(directory);

  return directory;
};

export const lintFixtures = async ({
  inputs,
  ruleId,
  ruleOptions,
}: {
  inputs: Array<FixtureInput>;
  ruleId: string;
  ruleOptions?: unknown;
}) => {
  const directory = await createFixtureDirectory();
  const configPath = path.join(directory, '.oxlintrc.json');
  const fixturePaths = inputs.map(({ path: fixturePath }, index) => path.join(directory, fixturePath ?? `fixture-${index}.test.ts`));

  await writeFile(
    configPath,
    JSON.stringify({
      jsPlugins: [
        {
          name: pluginName,
          specifier: pluginPath,
        },
      ],
      rules: {
        [ruleId]: ruleOptions === undefined ? 'error' : ['error', ruleOptions],
      },
    }),
  );

  await Promise.all(
    fixturePaths.map(async (fixturePath, index) => {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, (inputs[index] as FixtureInput).input);
    }),
  );

  const result = await execFileAsync(oxlintPath, ['-A', 'all', '-D', ruleId, '-c', configPath, '--format', 'json', ...fixturePaths], {
    cwd: directory,
    maxBuffer: 1024 * 1024 * 4,
  }).catch(error => error as { stdout: string });

  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: Array<Diagnostic> };

  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    filename: path.relative(directory, path.resolve(directory, diagnostic.filename)),
  }));
};

export const cleanupFixtures = async () => {
  await Promise.all(Array.from(tempDirectories, directory => rm(directory, { force: true, recursive: true })));

  tempDirectories.clear();
};

const reportMarker = '// reported';

/**
 * Lints every case and expects one diagnostic on each line that ends with `// reported`.
 */
export const expectRuleCases = async ({
  cases,
  message,
  ruleId,
  ruleOptions,
}: {
  cases: Array<FixtureInput>;
  message: string;
  ruleId: string;
  ruleOptions?: unknown;
}) => {
  const diagnostics = await lintFixtures({ inputs: cases, ruleId, ruleOptions });
  const [pluginName, ruleName] = ruleId.split(/\/(?=[^/]+$)/u);
  const actual = diagnostics.map(diagnostic => ({
    filename: diagnostic.filename,
    line: diagnostic.labels[0]?.span.line,
  }));
  const expected = cases.flatMap(({ input, path: fixturePath }, index) =>
    input
      .split('\n')
      .flatMap((line, lineIndex) => (line.trimEnd().endsWith(reportMarker) ? [lineIndex + 1] : []))
      .map(line => ({ filename: fixturePath ?? `fixture-${index}.test.ts`, line })),
  );
  const sortKey = ({ filename, line }: { filename: string; line: number | undefined }) => `${filename}:${String(line).padStart(5, '0')}`;

  expect(actual.map(sortKey).sort()).toEqual(expected.map(sortKey).sort());

  for (const diagnostic of diagnostics) {
    expect(diagnostic.code).toBe(`${pluginName}(${ruleName})`);
    expect(diagnostic.message).toContain(message);
  }
};
