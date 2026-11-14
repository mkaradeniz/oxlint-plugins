import type { Context } from '@oxlint/plugins';

export type TestFileOptions = {
  testFilePattern?: string;
};

export const defaultTestFilePattern = String.raw`(?:^|/)(?:tests|__tests__)/|\.(?:test|spec)\.[cm]?[jt]sx?$`;

export const testFileOptionsSchema = [
  {
    additionalProperties: false,
    properties: {
      testFilePattern: {
        type: 'string',
      },
    },
    type: 'object',
  },
];

const patternCache = new Map<string, RegExp>();

const getPattern = (source: string) => {
  const cached = patternCache.get(source);

  if (cached !== undefined) {
    return cached;
  }

  const pattern = new RegExp(source, 'u');

  patternCache.set(source, pattern);

  return pattern;
};

const toPosixPath = (value: string) => value.replaceAll('\\', '/');

const getRelativePath = ({ cwd, filename }: { cwd: string; filename: string }) => {
  const posixFilename = toPosixPath(filename);
  const posixCwd = toPosixPath(cwd).replace(/\/+$/u, '');

  return posixCwd !== '' && posixFilename.startsWith(`${posixCwd}/`) ? posixFilename.slice(posixCwd.length + 1) : posixFilename;
};

export const isTestFile = (context: Context) => {
  const options = context.options[0] as TestFileOptions | undefined;
  const pattern = getPattern(options?.testFilePattern ?? defaultTestFilePattern);

  return pattern.test(getRelativePath({ cwd: context.cwd, filename: context.filename }));
};
