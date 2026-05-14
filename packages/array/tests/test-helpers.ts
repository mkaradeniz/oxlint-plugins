import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const oxfmtConfigPath = path.join(packageRoot, 'oxfmt.config.ts');
const defaultPluginName = '@mkaradeniz/array';
const defaultPluginPath = path.join(packageRoot, 'index.ts');
const tempDirectories = new Set<string>();

export type Fixture = {
  configPath: string;
  fixturePath: string;
  fixturePaths: Array<string>;
};

const createConfig = async ({
  configPath,
  pluginName,
  pluginPath,
  ruleId,
  ruleOptions,
}: {
  configPath: string;
  pluginName: string;
  pluginPath: string;
  ruleId: string;
  ruleOptions?: unknown;
}) => {
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
};

const createFixtureDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'oxlint-plugin-'));

  tempDirectories.add(directory);

  return directory;
};

export const createFixture = async ({
  fixtureRelativePath = 'fixture.tsx',
  input,
  pluginName = defaultPluginName,
  pluginPath = defaultPluginPath,
  ruleId,
  ruleOptions,
}: {
  fixtureRelativePath?: string;
  input: string;
  pluginName?: string;
  pluginPath?: string;
  ruleId: string;
  ruleOptions?: unknown;
}) => {
  const directory = await createFixtureDirectory();
  const configPath = path.join(directory, '.oxlintrc.json');
  const fixturePath = path.join(directory, fixtureRelativePath);

  await createConfig({
    configPath,
    pluginName,
    pluginPath,
    ruleId,
    ruleOptions,
  });
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, input);

  return {
    configPath,
    fixturePath,
    fixturePaths: [fixturePath],
  };
};

export const createFixtureSet = async ({
  fixtureExtension = 'tsx',
  inputs,
  pluginName = defaultPluginName,
  pluginPath = defaultPluginPath,
  ruleId,
  ruleOptions,
}: {
  fixtureExtension?: string;
  inputs: Array<string>;
  pluginName?: string;
  pluginPath?: string;
  ruleId: string;
  ruleOptions?: unknown;
}) => {
  const directory = await createFixtureDirectory();
  const configPath = path.join(directory, '.oxlintrc.json');
  const fixturePaths = inputs.map((_, index) => path.join(directory, `fixture-${index}.${fixtureExtension}`));

  await createConfig({
    configPath,
    pluginName,
    pluginPath,
    ruleId,
    ruleOptions,
  });

  await Promise.all(
    fixturePaths.map(async (fixturePath, index) => {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, inputs[index] as string);
    }),
  );

  return {
    configPath,
    fixturePath: fixturePaths[0] as string,
    fixturePaths,
  };
};

export const readFixture = async ({ fixturePath }: Fixture) => {
  return readFile(fixturePath, 'utf8');
};

const readFixtureFiles = async ({ fixturePaths }: Fixture) => {
  return Promise.all(fixturePaths.map(fixturePath => readFile(fixturePath, 'utf8')));
};

export const runPnpmExec = async ({ args }: { args: Array<string> }) => {
  const result = await execFileAsync('pnpm', ['exec', ...args], {
    cwd: packageRoot,
    maxBuffer: 1024 * 1024 * 4,
  });

  return result;
};

export const runOxlintFix = async ({ fixture, ruleId }: { fixture: Fixture; ruleId: string }) => {
  const before = await readFixtureFiles(fixture);

  await runPnpmExec({
    args: ['oxlint', '-A', 'all', '-D', ruleId, '--fix', '-c', fixture.configPath, ...fixture.fixturePaths],
  }).catch(error => {
    const stdout = (error as { stdout?: string }).stdout ?? '';

    if (stdout.startsWith('Failed to parse oxlint configuration file.')) {
      throw error;
    }
  });

  const after = await readFixtureFiles(fixture);

  return before.some((content, index) => content !== after[index]);
};

export const runOxlintJson = async ({ fixture, ruleId }: { fixture: Fixture; ruleId: string }) => {
  const result = await runPnpmExec({
    args: ['oxlint', '-A', 'all', '-D', ruleId, '-c', fixture.configPath, '--format', 'json', ...fixture.fixturePaths],
  }).catch(error => error as { stdout: string });

  return JSON.parse(result.stdout) as {
    diagnostics: Array<{
      code: string;
      message: string;
      ruleId: string;
    }>;
  };
};

export const runOxfmt = async ({ fixturePath }: Fixture) => {
  await runPnpmExec({
    args: ['oxfmt', '--write', '-c', oxfmtConfigPath, fixturePath],
  });
};

export const cleanupFixtures = async () => {
  await Promise.all(Array.from(tempDirectories, directory => rm(directory, { force: true, recursive: true })));

  tempDirectories.clear();
};
