import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/react-structure/component-module-shape';

const createReactStructureFixture = async (input: string, fixtureRelativePath: string) => {
  return createFixture({ fixtureRelativePath, input, ruleId });
};

const routeModuleInput =
  'export const metadata = {\n  title: "Pick",\n};\n\nexport default function Page() {\n  return <Picker />;\n}\n\ntype PickerProps = {\n  value: string;\n};\n\nconst Picker = ({ value = "Pick" }: Partial<PickerProps>) => <div>{value}</div>;\n';
const tsConventionModuleInput =
  'export const metadata = {\n  title: "Pick",\n};\n\nexport const GET = async () => {\n  return Response.json({ ok: true });\n};\n';

afterEach(cleanupFixtures);

describe(`${ruleId} Next convention modules`, () => {
  it.each([
    'src/app/page.tsx',
    'src/app/(marketing)/page.tsx',
    'src/app/(marketing)/layout.tsx',
    'src/app/(marketing)/loading.tsx',
    'src/app/(marketing)/error.tsx',
    'src/app/(marketing)/not-found.tsx',
    'src/app/(marketing)/template.tsx',
    'src/app/(marketing)/opengraph-image.tsx',
    'src/app/(marketing)/twitter-image.tsx',
    'src/app/(marketing)/icon.tsx',
    'src/app/(marketing)/apple-icon.tsx',
  ])('ignores %s', async fixtureRelativePath => {
    const fixture = await createReactStructureFixture(routeModuleInput, fixtureRelativePath);

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it.each([
    'src/app/(marketing)/route.ts',
    'src/app/(marketing)/manifest.ts',
    'src/app/(marketing)/robots.ts',
    'src/app/(marketing)/sitemap.ts',
  ])('parses and ignores %s', async fixtureRelativePath => {
    const fixture = await createReactStructureFixture(tsConventionModuleInput, fixtureRelativePath);

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('handles Windows-style route convention paths', async () => {
    const fixture = await createReactStructureFixture(routeModuleInput, 'src\\app\\g\\[slug]\\page.tsx');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('does not ignore non-route files named page.tsx', async () => {
    const fixture = await createReactStructureFixture(routeModuleInput, 'src/components/page.tsx');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });
});
