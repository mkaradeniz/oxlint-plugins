import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/react-structure/component-module-shape';

const createReactStructureFixture = async (input: string, fixtureRelativePath?: string) => {
  return fixtureRelativePath === undefined
    ? createFixture({ input, ruleId })
    : createFixture({
        fixtureRelativePath,
        input,
        ruleId,
      });
};

afterEach(cleanupFixtures);

describe(ruleId, () => {
  it('reports more than one component in a module', async () => {
    const fixture = await createReactStructureFixture(
      'type FirstProps = {\n  value: string;\n};\nexport const First = ({ value }: FirstProps) => <div>{value}</div>;\ntype SecondProps = {\n  label: string;\n};\nexport const Second = ({ label }: SecondProps) => <div>{label}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/react-structure(component-module-shape)',
        message: 'Expected one component per module.',
      }),
    );
  });

  it('reports when the props type is not directly before the component', async () => {
    const fixture = await createReactStructureFixture(
      "type PickerProps = {\n  value: string;\n};\nconst OPTIONS = ['a', 'b'];\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/react-structure(component-module-shape)',
        message: 'Expected the props type to be directly before this component.',
      }),
    );
  });

  it('reports helper functions below the component', async () => {
    const fixture = await createReactStructureFixture(
      'type PickerProps = {\n  value: string;\n};\nexport const Picker = ({ value }: PickerProps) => <div>{normalize(value)}</div>;\nconst normalize = (value: string) => value.trim();\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/react-structure(component-module-shape)',
        message: 'Expected helper functions to be defined outside this component module.',
      }),
    );
  });

  it('reports helpers below components with multiline destructured props', async () => {
    const fixture = await createReactStructureFixture(
      "import { type ReactNode } from 'react';\n\ntype ParticipantActionLineProps = {\n  action: string;\n  meta?: ReactNode;\n};\n\nexport const ParticipantActionLine = ({\n  action,\n  meta,\n}: ParticipantActionLineProps) => {\n  return <div>{action}{meta}</div>;\n};\n\nconst isShortName = ({ name }: { name: string }) => name.length <= 8;\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/react-structure(component-module-shape)',
        message: 'Expected helper functions to be defined outside this component module.',
      }),
    );
  });

  it('reports helper function declarations below the component', async () => {
    const fixture = await createReactStructureFixture(
      'type PickerProps = {\n  value: string;\n};\nexport const Picker = ({ value }: PickerProps) => <div>{normalize(value)}</div>;\nfunction normalize(value: string) {\n  return value.trim();\n}\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/react-structure(component-module-shape)',
        message: 'Expected helper functions to be defined outside this component module.',
      }),
    );
  });

  it('does not treat all-caps route handlers as components', async () => {
    const fixture = await createReactStructureFixture(
      "export const POST = async () => {\n  return Response.json({ ok: true });\n};\n\nconst renderOtpEmail = ({ otp }: { otp: string }) => {\n  return '<p>' + otp + '</p>';\n};\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('does not treat PascalCase non-JSX factories as components', async () => {
    const fixture = await createReactStructureFixture(
      "export const CreateParticipantAction = () => {\n  return { type: 'join' };\n};\n\nconst normalizeAction = (action: string) => action.trim();\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('does not treat conditional or try-returning non-JSX functions as components', async () => {
    const fixture = await createReactStructureFixture(
      "export function CreateParticipantAction() {\n  if (enabled) {\n    return { type: 'join' };\n  }\n\n  try {\n    return { type: 'leave' };\n  } catch {\n    return { type: 'fallback' };\n  } finally {\n    cleanup();\n  }\n}\n\nexport function EmptyParticipantAction() {\n  return;\n}\n\nconst normalizeAction = (action: string) => action.trim();\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes function declaration components and wrapped JSX returns', async () => {
    const fixture = await createReactStructureFixture(
      'type PickerProps = {\n  value: string;\n};\nexport function Picker({ value }: PickerProps) {\n  return value ? null : (<div>{value}</div> as React.ReactNode);\n}\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes alternate branch JSX returns', async () => {
    const fixture = await createReactStructureFixture(
      "type PickerProps = {\n  value: string;\n};\nexport function Picker({ value }: PickerProps) {\n  if (value === '') {\n    return null;\n  } else {\n    return <div>{value}</div>;\n  }\n}\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes TypeScript-wrapped JSX returns', async () => {
    const asFixture = await createReactStructureFixture(
      'export const AsPicker = () => {\n  return <div>Pick</div> as React.ReactNode;\n};\n',
    );
    const satisfiesFixture = await createReactStructureFixture(
      'export const SatisfiesPicker = () => {\n  return <div>Pick</div> satisfies React.ReactNode;\n};\n',
    );

    await expect(runOxlintJson({ fixture: asFixture, ruleId })).resolves.toMatchObject({ diagnostics: [] });
    await expect(runOxlintJson({ fixture: satisfiesFixture, ruleId })).resolves.toMatchObject({ diagnostics: [] });
  });

  it('accepts components without props type annotations', async () => {
    const fixture = await createReactStructureFixture('export const Picker = () => <div>Pick one</div>;\n');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts components whose parameter type does not use the Props suffix', async () => {
    const fixture = await createReactStructureFixture(
      'type PickerInput = {\n  value: string;\n};\nexport const Picker = ({ value }: PickerInput) => value && <div>{value}</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('ignores Next route convention modules', async () => {
    const fixture = await createReactStructureFixture(
      'export const metadata = {\n  title: \'Join group\',\n};\n\nexport default function Page() {\n  return <JoinPending slug="abc" />;\n}\n\ntype JoinPendingProps = {\n  slug: string;\n};\n\nconst JoinPending = ({ slug }: JoinPendingProps) => {\n  return <div>{slug}</div>;\n};\n',
      'src/app/g/[slug]/join/page.tsx',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('accepts constants above props and a single component', async () => {
    const fixture = await createReactStructureFixture(
      "const OPTIONS = ['a', 'b'];\nconst { PickerIcon } = icons;\ntype PickerProps = {\n  value: string;\n};\nexport const Picker = ({ value }: PickerProps) => <div>{value}</div>;\nconst pickerLabel = 'Picker';\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });
});
