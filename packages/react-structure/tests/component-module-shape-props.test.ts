import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/react-structure/component-module-shape';

const createReactStructureFixture = async (input: string) => {
  return createFixture({ input, ruleId });
};

afterEach(cleanupFixtures);

describe(`${ruleId} props`, () => {
  it('accepts exported props types directly before components', async () => {
    const fixture = await createReactStructureFixture(
      'export type PickerProps = {\n  value: string;\n};\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts interface props directly before components when parsed by Oxlint', async () => {
    const fixture = await createReactStructureFixture(
      'interface PickerProps {\n  value: string;\n}\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts comments between props type and component', async () => {
    const fixture = await createReactStructureFixture(
      'type PickerProps = {\n  value: string;\n};\n// Component keeps the picker label visible.\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('reports props types separated from components by constants', async () => {
    const fixture = await createReactStructureFixture(
      "type PickerProps = {\n  value: string;\n};\nconst LABEL = 'Pick';\nexport const Picker = ({ value }: PickerProps) => <div>{LABEL}{value}</div>;\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected the props type to be directly before this component.' }),
    );
  });

  it('reports local props types declared below components', async () => {
    const fixture = await createReactStructureFixture(
      'export const Picker = ({ value }: PickerProps) => <div>{value}</div>;\ntype PickerProps = {\n  value: string;\n};\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected the props type to be directly before this component.' }),
    );
  });

  it('accepts generic props type names', async () => {
    const fixture = await createReactStructureFixture(
      'type ComponentProps<T> = {\n  value: T;\n};\nexport const Picker = ({ value }: ComponentProps<string>) => <div>{value}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts imported props types because no local type can be moved directly above the component', async () => {
    const fixture = await createReactStructureFixture(
      "import { type PickerProps } from './Picker.types';\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts destructured props without type annotations', async () => {
    const fixture = await createReactStructureFixture('export const Picker = ({ value }) => <div>{value}</div>;\n');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts components after type-only exports and enum or const declarations when props are direct', async () => {
    const fixture = await createReactStructureFixture(
      "export type PickerValue = string;\nenum PickerMode {\n  Compact = 'compact',\n}\nconst LABEL = 'Pick';\ntype PickerProps = {\n  value: PickerValue;\n};\nexport const Picker = ({ value }: PickerProps) => <div>{LABEL}{PickerMode.Compact}{value}</div>;\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });
});
