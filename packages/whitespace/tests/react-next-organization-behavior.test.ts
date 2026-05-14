import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule, runOxlintJson } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

describe(`${ruleId} behavior`, () => {
  it('reports out-of-order groups without moving statements', async () => {
    const input =
      "export const ExpenseForm = () => {\n  const [title, setTitle] = React.useState('');\n  const group = useGroupBySlug({ slug });\n\n  return <form>{title}</form>;\n};\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: '@mkaradeniz/whitespace(react-next-organization)',
        message: 'Expected this component group to appear before state.',
      }),
    );
  });

  it('can suppress ordering diagnostics while still avoiding unsafe fixes', async () => {
    const input =
      "export const ExpenseForm = () => {\n  const [title, setTitle] = React.useState('');\n  const group = useGroupBySlug({ slug });\n\n  return <form>{title}</form>;\n};\n";
    const fixture = await createFixture({ input, ruleId, ruleOptions: { orderDiagnostics: false } });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('uses configured hook groups', async () => {
    const fixture = await createFixture({
      input:
        'export const CustomPanel = () => {\n  const thing = useCurrentThing();\n  const [open, setOpen] = React.useState(false);\n  return <section>{thing.name}</section>;\n};\n',
      ruleId,
      ruleOptions: {
        hookGroups: {
          reads: ['useCurrentThing'],
        },
      },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const CustomPanel = () => {\n  const thing = useCurrentThing();\n\n  const [open, setOpen] = React.useState(false);\n  return <section>{thing.name}</section>;\n};\n',
    );
  });

  it('does not classify unknown hooks', async () => {
    const fixture = await createFixture({
      input:
        'export const MysteryPanel = () => {\n  const value = useMysteryValue();\n  const other = useOtherThing();\n\n  return <section>{value ?? other}</section>;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('ignores nested functions and non-component top-level functions', async () => {
    const input =
      "export const ExpenseForm = () => {\n  const router = useRouter();\n\n  const renderInner = () => {\n    const group = useGroupBySlug({ slug });\n    const [title, setTitle] = React.useState('');\n    return <span>{title}</span>;\n  };\n\n  return <form>{renderInner()}</form>;\n};\n\nconst normalize = () => {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return group.id;\n};\n";
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores computed hook member calls and components with too few classified statements', async () => {
    const fixture = await createFixture({
      input:
        "export const ComputedPanel = () => {\n  const [title, setTitle] = React['useState']('');\n  return <section>{title}</section>;\n};\n\nexport const TinyPanel = () => {\n  return <section />;\n};\n",
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('ignores anonymous default arrow functions because they are not named components', async () => {
    const input =
      'export default () => {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return <section>{group.id}</section>;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores anonymous default function declarations because they are not named components', async () => {
    const input =
      'export default function () {\n  const router = useRouter();\n  const group = useGroupBySlug({ slug });\n  return <section>{group.id}</section>;\n}\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('skips unclassified statements while organizing component groups', async () => {
    const fixture = await createFixture({
      input: 'export const ExpenseForm = () => {\n  debugger;\n  const total = amount + tip;\n  return <form>{total}</form>;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('keeps statements within the same component group together', async () => {
    const input =
      'export const ExpenseForm = () => {\n  const total = amount + tip;\n  const label = formatMoney(total);\n  return <form>{label}</form>;\n};\n';
    const fixture = await createFixture({ input, ruleId });

    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe(input);
  });

  it('ignores unsupported member call shapes while classifying hooks', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  (React.useEffect).call(null, () => {});\n  const total = amount + tip;\n  return <form>{total}</form>;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });

  it('classifies function declarations as handlers and alternate returns as guards', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  const total = amount + tip;\n  function handleSubmit() {\n    save(total);\n  }\n  if (total === 0) {\n    noop();\n  } else {\n    return null;\n  }\n  return <form onSubmit={handleSubmit}>{total}</form>;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const ExpenseForm = () => {\n  const total = amount + tip;\n\n  function handleSubmit() {\n    save(total);\n  }\n  if (total === 0) {\n    noop();\n  } else {\n    return null;\n  }\n  return <form onSubmit={handleSubmit}>{total}</form>;\n};\n',
    );
  });

  it('separates adjacent effect hooks even when they share a component group', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  React.useEffect(() => {\n    syncTitle();\n  }, []);\n  React.useLayoutEffect(() => {\n    syncLayout();\n  }, []);\n  return <form />;\n};\n',
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const ExpenseForm = () => {\n  React.useEffect(() => {\n    syncTitle();\n  }, []);\n\n  React.useLayoutEffect(() => {\n    syncLayout();\n  }, []);\n  return <form />;\n};\n',
    );
  });

  it('ignores hook-like member calls with unsupported receiver shapes', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  const group = getHooks().useQuery(api.groups.get);\n  const total = amount + tip;\n  return <form>{group?.id ?? total}</form>;\n};\n',
      ruleId,
    });

    const result = await runOxlintJson({ fixture, ruleId });

    expect(result.diagnostics).toEqual([]);
  });
});
