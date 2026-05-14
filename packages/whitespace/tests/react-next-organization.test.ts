import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxfmt, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(ruleId, () => {
  it('adds blank lines between correctly ordered component groups', async () => {
    const fixture = await createFixture({
      input:
        "export const ExpenseForm = () => {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  const addExpense = useMutation(api.expenses.add);\n  const [title, setTitle] = React.useState('');\n  const formId = React.useId();\n  const total = amount + tip;\n  const submit = React.useCallback(() => {\n    return addExpense({ title });\n  }, [addExpense, title]);\n  React.useEffect(() => {\n    syncCategory();\n  }, []);\n  const save = async () => {\n    await submit();\n  };\n  if (group === null) {\n    return null;\n  }\n  return <form id={formId}>{total}</form>;\n};\n",
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      "export const ExpenseForm = () => {\n  const router = useRouter();\n\n  const group = useGroupBySlug({ slug });\n\n  const addExpense = useMutation(api.expenses.add);\n\n  const [title, setTitle] = React.useState('');\n\n  const formId = React.useId();\n\n  const total = amount + tip;\n\n  const submit = React.useCallback(() => {\n    return addExpense({ title });\n  }, [addExpense, title]);\n\n  React.useEffect(() => {\n    syncCategory();\n  }, []);\n\n  const save = async () => {\n    await submit();\n  };\n  if (group === null) {\n    return null;\n  }\n  return <form id={formId}>{total}</form>;\n};\n",
    );
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });

  it('adds blank lines inside function declaration components', async () => {
    const fixture = await createFixture({
      input:
        'export function ExpenseForm() {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n}\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export function ExpenseForm() {\n  const router = useRouter();\n\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n}\n',
    );
  });

  it('preserves CRLF line endings when adding component group spacing', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\r\n  const router = useRouter();\r\n  const group = useGroupBySlug({ slug });\r\n  return <form>{group.id}</form>;\r\n};\r\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const ExpenseForm = () => {\r\n  const router = useRouter();\r\n\r\n  const group = useGroupBySlug({ slug });\r\n  return <form>{group.id}</form>;\r\n};\r\n',
    );
  });

  it('does not move comments while trying to add component group spacing', async () => {
    const input =
      'export const ExpenseForm = () => {\n  const router = useRouter();\n  // Keep this comment with the read phase.\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('does not add duplicate spacing between already separated component groups', async () => {
    const input =
      'export const ExpenseForm = () => {\n  const router = useRouter();\n\n  const group = useGroupBySlug({ slug });\n  return <form>{group.id}</form>;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('keeps component group spacing converged with oxfmt', async () => {
    const fixture = await createFixture({
      input:
        "export const ExpenseForm=()=>{const router=useRouter();const group=useGroupBySlug({slug});const addExpense=useMutation(api.expenses.add);const [title,setTitle]=React.useState('');return <form>{title}</form>;};\n",
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });
});
