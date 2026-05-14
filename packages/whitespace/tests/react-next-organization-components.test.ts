import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} components`, () => {
  it('ignores PascalCase functions that do not return JSX', async () => {
    const input =
      'export const CreateParticipantAction = () => {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return { router, group };\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores blockless arrow components', async () => {
    const input = 'export const ExpenseForm = () => <form />;\n';
    const fixture = await createFixture({ input, ruleId });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('ignores lowercase functions', async () => {
    const input =
      'export const normalize = () => {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return <span>{group.id}</span>;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores nested PascalCase inner components', async () => {
    const input =
      "export const ExpenseForm = () => {\n  const router = useRouter();\n\n  const InnerPanel = () => {\n    const group = useGroupBySlug({ slug });\n    const [title, setTitle] = React.useState('');\n    return <span>{title}</span>;\n  };\n\n  return <form>{router ? <InnerPanel /> : null}</form>;\n};\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('organizes default named function components', async () => {
    const fixture = await createFixture({
      input:
        'export default function ExpenseForm() {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n}\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export default function ExpenseForm() {\n  const router = useRouter();\n\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n}\n',
    );
  });
});
