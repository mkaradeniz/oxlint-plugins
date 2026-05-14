import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/react-structure/component-module-shape';

const createReactStructureFixture = async (input: string) => {
  return createFixture({ input, ruleId });
};

afterEach(cleanupFixtures);

describe(`${ruleId} helpers`, () => {
  it('reports multiple components when the second component is a default export', async () => {
    const fixture = await createReactStructureFixture(
      'export const Picker = () => <div>Pick</div>;\nexport default function Other() {\n  return <div>Other</div>;\n}\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });

  it('reports exported helper functions below components', async () => {
    const fixture = await createReactStructureFixture(
      'export const Picker = () => <div>{normalize(" pick ")}</div>;\nexport const normalize = (value: string) => value.trim();\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected helper functions to be defined outside this component module.' }),
    );
  });

  it('reports PascalCase non-JSX helpers below components', async () => {
    const fixture = await createReactStructureFixture(
      "export const Picker = () => <div>{CreateLabel()}</div>;\nconst CreateLabel = () => ({ label: 'Pick' });\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected helper functions to be defined outside this component module.' }),
    );
  });

  it('accepts nested helpers inside components', async () => {
    const fixture = await createReactStructureFixture(
      'export const Picker = () => {\n  const normalize = (value: string) => value.trim();\n\n  return <div>{normalize(" pick ")}</div>;\n};\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('reports helpers below components after type-only exports', async () => {
    const fixture = await createReactStructureFixture(
      'export const Picker = () => <div>{normalize(" pick ")}</div>;\nexport type PickerValue = string;\nconst normalize = (value: string) => value.trim();\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected helper functions to be defined outside this component module.' }),
    );
  });

  it('reports multiple declarator components in one variable declaration', async () => {
    const fixture = await createReactStructureFixture('export const Picker = () => <div>Pick</div>, Other = () => <div>Other</div>;\n');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });

  it('ignores destructured variable declarations as components', async () => {
    const fixture = await createReactStructureFixture(
      'const { Picker } = componentRegistry;\nexport const Other = () => <div>Other</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });
});
