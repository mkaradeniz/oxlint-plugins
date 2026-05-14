import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupFixtures,
  createFixture,
  readFixture,
  runOxfmt,
  runOxlintFix as runOxlintFixForRule,
  runOxlintJson,
} from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} edges`, () => {
  it('classifies async handlers', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  React.useEffect(() => sync(), []);\n  const submit = async () => save();\n  return <form onSubmit={submit} />;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const ExpenseForm = () => {\n  React.useEffect(() => sync(), []);\n\n  const submit = async () => save();\n  return <form onSubmit={submit} />;\n};\n',
    );
  });

  it('classifies guards with consequent and nested block returns', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  const submit = () => save();\n  if (disabled) {\n    return null;\n  }\n  if (missing) {\n    {\n      return null;\n    }\n  }\n  return <form onSubmit={submit} />;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('leaves non-return if statements unclassified', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  const total = amount + tip;\n  if (total > 0) {\n    sync(total);\n  }\n  return <form>{total}</form>;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('classifies return statements for ordering diagnostics', async () => {
    const fixture = await createFixture({
      input: 'export const ExpenseForm = () => {\n  return <form />;\n  const submit = () => save();\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Expected this component group to appear before returns.' }),
    );
  });

  it('ignores optional-chained hook calls and hook aliases', async () => {
    const fixture = await createFixture({
      input:
        "export const ExpenseForm = () => {\n  const useLocalState = React.useState;\n  const { useReducer } = React;\n  const [title] = React.useState?.('');\n  const [name] = useLocalState('');\n  const [state] = useReducer(reducer, initialState);\n  return <form>{title ?? name ?? state.title}</form>;\n};\n",
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('organizes Next page async functions when they return JSX', async () => {
    const fixture = await createFixture({
      input:
        'export default async function Page() {\n  const paramsValue = React.use(params);\n  const group = useGroupBySlug({ slug: paramsValue.slug });\n  return <form>{group.id}</form>;\n}\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export default async function Page() {\n  const paramsValue = React.use(params);\n\n  const group = useGroupBySlug({ slug: paramsValue.slug });\n  return <form>{group.id}</form>;\n}\n',
    );
  });

  it('ignores server components without hooks and components with too little to organize', async () => {
    const input =
      "export const ServerPanel = () => {\n  const title = 'Overview';\n  return <section>{title}</section>;\n};\n\nexport const EmptyPanel = () => {\n  return <section />;\n};\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('keeps a full realistic component converged with oxfmt', async () => {
    const fixture = await createFixture({
      input:
        "export const ExpenseForm=()=>{const paramsValue=React.use(params);const group=useGroupBySlug({slug:paramsValue.slug});const save=useMutation(api.groups.save);const [title,setTitle]=React.useState('');const formId=React.useId();const total=React.useMemo(()=>amount+tip,[amount,tip]);const submit=React.useCallback(()=>save({title,total}),[save,title,total]);React.useEffect(()=>sync(title),[title]);const cancel=()=>setTitle('');if(!group){return null;}return <form id={formId}>{title}<button onClick={cancel}>Cancel</button></form>;};\n",
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
  });
});
