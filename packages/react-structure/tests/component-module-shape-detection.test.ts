import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/react-structure/component-module-shape';

const createReactStructureFixture = async (input: string, fixtureRelativePath?: string) => {
  return fixtureRelativePath === undefined ? createFixture({ input, ruleId }) : createFixture({ fixtureRelativePath, input, ruleId });
};

afterEach(cleanupFixtures);

describe(`${ruleId} detection`, () => {
  it('treats default exported function components in non-route files as components', async () => {
    const fixture = await createReactStructureFixture(
      'export default function Picker() {\n  return <div>Pick</div>;\n}\n\nexport const Other = () => <div>Other</div>;\n',
      'src/components/Picker/Picker.tsx',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });

  it('treats anonymous default component exports as components', async () => {
    const fixture = await createReactStructureFixture(
      'export default function () {\n  return <div>Pick</div>;\n}\n\nexport const Other = () => <div>Other</div>;\n',
      'src/components/Picker/Picker.tsx',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });

  it('ignores anonymous default functions that do not return JSX', async () => {
    const fixture = await createReactStructureFixture(
      "export default function () {\n  return { label: 'Pick' };\n}\n\nexport const Picker = () => <div>Pick</div>;\n",
      'src/components/Picker/Picker.tsx',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes React.memo and forwardRef wrapped components', async () => {
    const fixture = await createReactStructureFixture(
      'export const MemoPicker = React.memo(() => <div>Pick</div>);\nexport const RefPicker = React.forwardRef((props, ref) => <div ref={ref}>Pick</div>);\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });

  it('ignores unsupported wrapper calls instead of guessing component shape', async () => {
    const fixture = await createReactStructureFixture(
      'const pickerArgs = [];\nconst pickerImpl = () => <div>Pick</div>;\nexport const ComputedMemoPicker = React["memo"](() => <div>Pick</div>);\nexport const DynamicMemoPicker = React().memo(() => <div>Pick</div>);\nexport const EmptyMemoPicker = React.memo();\nexport const ReferencedMemoPicker = React.memo(pickerImpl);\nexport const SpreadMemoPicker = React.memo(...pickerArgs);\nexport const WrappedPicker = customWrapper(() => <div>Pick</div>);\nexport const Picker = () => <div>Pick</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes components assigned from function expressions', async () => {
    const fixture = await createReactStructureFixture('export const Picker = function Picker() {\n  return <div>Pick</div>;\n};\n');

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes fragment, conditional, logical, and try/catch JSX returns', async () => {
    const fixture = await createReactStructureFixture(
      'export const FragmentPicker = () => <><span>Pick</span></>;\nexport const ConditionalPicker = ({ ready }) => ready ? <div>Pick</div> : null;\nexport const LogicalPicker = ({ ready }) => ready && <div>Pick</div>;\nexport function TryPicker() {\n  try {\n    return <div>Pick</div>;\n  } catch {\n    return null;\n  }\n}\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics.filter(diagnostic => diagnostic.message === 'Expected one component per module.')).toHaveLength(3);
  });

  it('does not treat PascalCase helpers, lowercase JSX factories, or class components as function components', async () => {
    const fixture = await createReactStructureFixture(
      "export const CreateAction = () => ({ type: 'create' });\nexport const picker = () => <div>Pick</div>;\nexport class Picker extends React.Component {\n  render() {\n    return <div>Pick</div>;\n  }\n}\n",
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes acronym component names', async () => {
    const fixture = await createReactStructureFixture(
      'export const URLBadge = () => <div>URL</div>;\nexport const Other = () => <div>Other</div>;\n',
    );

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ message: 'Expected one component per module.' }));
  });
});
