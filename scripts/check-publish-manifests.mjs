import { readFile } from 'node:fs/promises';

const publishablePackages = [
  'packages/whitespace/package.json',
  'packages/react-structure/package.json',
];

const runtimeDependencyFields = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

const forbiddenProtocols = ['catalog:', 'workspace:'];
const errors = [];

for (const packagePath of publishablePackages) {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  for (const field of runtimeDependencyFields) {
    const dependencies = packageJson[field] ?? {};

    for (const [name, specifier] of Object.entries(dependencies)) {
      if (
        typeof specifier === 'string' &&
        forbiddenProtocols.some((protocol) => specifier.startsWith(protocol))
      ) {
        errors.push(`${packagePath}: ${field}.${name} uses ${specifier}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(
    [
      'Publishable package manifests must not use workspace-only protocols in runtime dependency fields.',
      ...errors.map((error) => `- ${error}`),
    ].join('\n'),
  );
  process.exitCode = 1;
}
