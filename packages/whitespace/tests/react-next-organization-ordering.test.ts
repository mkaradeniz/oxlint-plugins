import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';

afterEach(cleanupFixtures);

const outOfOrderCases = [
  {
    expected: 'Expected this component group to appear before state.',
    name: 'reads after state',
    source: "const [title, setTitle] = React.useState('');\n  const group = useGroupBySlug({ slug });",
  },
  {
    expected: 'Expected this component group to appear before state.',
    name: 'writes after state',
    source: "const [title, setTitle] = React.useState('');\n  const save = useMutation(api.groups.save);",
  },
  {
    expected: 'Expected this component group to appear before effects.',
    name: 'callbacks after effects',
    source: 'React.useEffect(() => sync(), []);\n  const submit = React.useCallback(() => save(), [save]);',
  },
  {
    expected: 'Expected this component group to appear before handlers.',
    name: 'handlers before effects',
    source: 'const submit = () => save();\n  React.useEffect(() => sync(), []);',
  },
  {
    expected: 'Expected this component group to appear before guards.',
    name: 'handlers after guards',
    source: 'if (disabled) {\n    return null;\n  }\n  const submit = () => save();',
  },
] as const;

describe(`${ruleId} ordering`, () => {
  it.each(outOfOrderCases)('reports out-of-order %s', async ({ expected, source }) => {
    const input = `export const ExpenseForm = () => {\n  ${source}\n\n  return <form />;\n};\n`;
    const fixture = await createFixture({ input, ruleId });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(await readFixture(fixture)).toBe(input);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/whitespace(react-next-organization)',
        message: expected,
      }),
    );
  });

  it('reports exact messages when order diagnostics are enabled explicitly', async () => {
    const fixture = await createFixture({
      input:
        "export const ExpenseForm = () => {\n  const [title, setTitle] = React.useState('');\n  const group = useGroupBySlug({ slug });\n\n  return <form>{title}</form>;\n};\n",
      ruleId,
      ruleOptions: { orderDiagnostics: true },
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        message: 'Expected this component group to appear before state.',
      }),
    );
  });
});
