import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import plugin, { recommended } from '../index.ts';
import { packageRoot } from './test-helpers.ts';

describe('recommended', () => {
  it('loads the published package and enables every rule as an error', async () => {
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as { name: string };
    const pluginName = plugin.meta?.name as string;

    expect(recommended.jsPlugins).toEqual([{ name: pluginName, specifier: manifest.name }]);
    expect(recommended.rules).toEqual(Object.fromEntries(Object.keys(plugin.rules).map(rule => [`${pluginName}/${rule}`, 'error'])));
  });
});
