import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupFixtures,
  createFixture,
  createFixtureSet,
  type Fixture,
  readFixture,
  runOxfmt,
  runOxlintFix as runOxlintFixForRule,
  runOxlintJson,
} from './test-helpers.ts';

const ruleId = '@mkaradeniz/nullability/prefer-is-not-null-or-undefined';
const message = 'Prefer isNotNullOrUndefined for nullability checks';
const importLine = "import { isNotNullOrUndefined } from 'is-not-null-or-undefined';\n";

type FixCase = {
  input: string;
  name: string;
  output: string;
};

type ReportCase = {
  count?: number;
  input: string;
  name: string;
};

const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

const expectFixtureDiagnostics = async (fixture: Fixture, count: number) => {
  const result = await runOxlintJson({ fixture, ruleId });

  expect(result.diagnostics).toHaveLength(count);

  for (const diagnostic of result.diagnostics) {
    expect(diagnostic.code).toBe('@mkaradeniz/nullability(prefer-is-not-null-or-undefined)');
    expect(diagnostic.message).toContain(message);
  }
};

const expectNoFix = async (input: string, count = 1) => {
  const fixture = await createFixture({ input, ruleId });

  await expectFixtureDiagnostics(fixture, count);
  await expect(runOxlintFix(fixture)).resolves.toBe(false);
  await expect(readFixture(fixture)).resolves.toBe(input);
};

const expectCleanCases = async (cases: Array<ReportCase>) => {
  const fixture = await createFixtureSet({
    inputs: cases.map(({ input }) => input),
    ruleId,
  });

  await expectFixtureDiagnostics(fixture, 0);
  await expect(runOxlintFix(fixture)).resolves.toBe(false);
};

const expectNoFixCases = async (cases: Array<ReportCase>) => {
  const fixture = await createFixtureSet({
    inputs: cases.map(({ input }) => input),
    ruleId,
  });
  const expectedCount = cases.reduce((count, reportCase) => count + (reportCase.count ?? 1), 0);

  await expectFixtureDiagnostics(fixture, expectedCount);
  await expect(runOxlintFix(fixture)).resolves.toBe(false);
};

const expectFix = async ({ input, output }: FixCase) => {
  const fixture = await createFixture({ input, ruleId });

  await expect(runOxlintFix(fixture)).resolves.toBe(true);
  await expect(readFixture(fixture)).resolves.toBe(output);
  await expect(runOxlintFix(fixture)).resolves.toBe(false);
  await expectFixtureDiagnostics(fixture, 0);
};

const expectFixCases = async (cases: Array<FixCase>) => {
  const fixture = await createFixtureSet({
    inputs: cases.map(({ input }) => input),
    ruleId,
  });

  await expect(runOxlintFix(fixture)).resolves.toBe(true);

  const outputs = await Promise.all(fixture.fixturePaths.map(fixturePath => readFixture({ ...fixture, fixturePath })));

  for (const [index, fixCase] of cases.entries()) {
    expect(outputs[index], fixCase.name).toBe(fixCase.output);
  }

  await expect(runOxlintFix(fixture)).resolves.toBe(false);
  await expectFixtureDiagnostics(fixture, 0);
};

afterEach(cleanupFixtures);

describe(ruleId, () => {
  describe('annotation-aware truthiness gates', () => {
    it('reports nullable identifiers across control-flow gates without fixes when the import is missing', async () => {
      await expectNoFixCases([
        {
          input: `function render(value: { id: string } | null) {\n  if (value) return value.id;\n}\n`,
          name: 'if',
        },
        {
          input: `function render(value: { id: string } | undefined) {\n  while (value) break;\n}\n`,
          name: 'while',
        },
        {
          input: `function render(value: (() => void) | null) {\n  do {\n    value?.();\n  } while (value);\n}\n`,
          name: 'do while',
        },
        {
          input: `function render(value: object | null) {\n  return value ? 'set' : 'empty';\n}\n`,
          name: 'ternary',
        },
        {
          input: `function render(value: { id: string } | null) {\n  return <>{value && <span>{value.id}</span>}</>;\n}\n`,
          name: 'jsx logical rendering',
        },
        {
          input: `const render = (value: symbol | null) => value && String(value);\n`,
          name: 'arrow implicit logical return',
        },
      ]);
    });

    it('fixes always-truthy nullable gates when the exact import exists', async () => {
      await expectFixCases([
        {
          input: `${importLine}function render(value: { id: string } | null) {\n  if (value) return value.id;\n}\n`,
          name: 'if object',
          output: `${importLine}function render(value: { id: string } | null) {\n  if (isNotNullOrUndefined(value)) return value.id;\n}\n`,
        },
        {
          input: `${importLine}function render(value: object | undefined) {\n  return value ? 'set' : 'empty';\n}\n`,
          name: 'ternary object keyword',
          output: `${importLine}function render(value: object | undefined) {\n  return isNotNullOrUndefined(value) ? 'set' : 'empty';\n}\n`,
        },
        {
          input: `${importLine}function render(value: (() => void) | null) {\n  if (!value) return;\n  value();\n}\n`,
          name: 'negated function',
          output: `${importLine}function render(value: (() => void) | null) {\n  if (!isNotNullOrUndefined(value)) return;\n  value();\n}\n`,
        },
      ]);
    });

    it('tracks nullable local declarations, class fields, parameter properties, rest parameters, and deep annotations', async () => {
      await expectFixCases([
        {
          input: `${importLine}const value: { id: string } | null = getValue();\nif (value) read(value.id);\n`,
          name: 'variable declaration',
          output: `${importLine}const value: { id: string } | null = getValue();\nif (isNotNullOrUndefined(value)) read(value.id);\n`,
        },
        {
          input: `${importLine}class View {\n  value: { id: string } | undefined;\n  render() {\n    const value = this.value;\n    if (value) read(value.id);\n  }\n}\n`,
          name: 'class field and local alias',
          output: `${importLine}class View {\n  value: { id: string } | undefined;\n  render() {\n    const value = this.value;\n    if (isNotNullOrUndefined(value)) read(value.id);\n  }\n}\n`,
        },
        {
          input: `${importLine}class View {\n  constructor(private value: { id: string } | null) {}\n  render() {\n    if (value) read(value.id);\n  }\n}\n`,
          name: 'parameter property',
          output: `${importLine}class View {\n  constructor(private value: { id: string } | null) {}\n  render() {\n    if (isNotNullOrUndefined(value)) read(value.id);\n  }\n}\n`,
        },
        {
          input: `${importLine}function render(...values: Array<{ id: string } | null>) {\n  const value: { nested: Array<{ id: string }> } | undefined = values[0] ?? undefined;\n  if (value) read(value.nested);\n}\n`,
          name: 'rest parameter and nested annotation delimiters',
          output: `${importLine}function render(...values: Array<{ id: string } | null>) {\n  const value: { nested: Array<{ id: string }> } | undefined = values[0] ?? undefined;\n  if (isNotNullOrUndefined(value)) read(value.nested);\n}\n`,
        },
        {
          input: `${importLine}function render(value: { id: string } | null = null) {\n  if (value) read(value.id);\n}\n`,
          name: 'default parameter',
          output: `${importLine}function render(value: { id: string } | null = null) {\n  if (isNotNullOrUndefined(value)) read(value.id);\n}\n`,
        },
      ]);
    });

    it('handles transparent syntax around truthiness gates', async () => {
      await expectFixCases([
        {
          input: `${importLine}function render(value: { id: string } | null) {\n  if ((value)) read(value.id);\n}\n`,
          name: 'parentheses',
          output: `${importLine}function render(value: { id: string } | null) {\n  if ((isNotNullOrUndefined(value))) read(value.id);\n}\n`,
        },
        {
          input: `${importLine}function render(value: { id: string } | null) {\n  if (value as { id: string } | null) read(value.id);\n}\n`,
          name: 'as expression',
          output: `${importLine}function render(value: { id: string } | null) {\n  if (isNotNullOrUndefined(value)) read(value.id);\n}\n`,
        },
        {
          input: `${importLine}function render(value: { id: string } | null) {\n  if (value satisfies { id: string } | null) read(value.id);\n}\n`,
          name: 'satisfies expression',
          output: `${importLine}function render(value: { id: string } | null) {\n  if (isNotNullOrUndefined(value)) read(value.id);\n}\n`,
        },
      ]);
    });

    it('allows ambiguous primitive truthiness because it may intentionally test emptiness or zero', async () => {
      await expectCleanCases([
        {
          input: `${importLine}function render(value: string | null) {\n  if (value) return value;\n}\n`,
          name: 'string can be empty',
        },
        {
          input: `${importLine}function render(value: number | undefined) {\n  return value ? value : 0;\n}\n`,
          name: 'number can be zero',
        },
        {
          input: `${importLine}function render(value: string | null) {\n  if (!value) return 'empty';\n  return value;\n}\n`,
          name: 'negated string can be empty',
        },
        {
          input: `${importLine}function render(value: null | undefined) {\n  if (value) return value;\n}\n`,
          name: 'nullish-only annotation',
        },
        {
          input: `${importLine}type User = { id: string };\nfunction render(value: User | null) {\n  if (value) return value.id;\n}\n`,
          name: 'type reference is not semantically known',
        },
      ]);
    });

    it('does not report normalized values, optional properties, object type members, imported aliases, or destructuring bindings', async () => {
      await expectCleanCases([
        {
          input: `type Props = { value?: { id: string } | null };\nconst value = props.value ?? fallback;\nif (value) read(value.id);\n`,
          name: 'normalized local',
        },
        {
          input: `type Props = { value?: { id: string } | null };\nfunction render(props: Props) {\n  if (props.value) read(props.value.id);\n}\n`,
          name: 'object property annotation does not track bare value',
        },
        {
          input: `type Props = {\n  value?: { id: string } | null;\n};\nfunction render(value: { id: string }) {\n  if (value) read(value.id);\n}\n`,
          name: 'multiline object property annotation does not track bare value',
        },
        {
          input: `value: null | undefined;\n`,
          name: 'label-like syntax at file start',
        },
        {
          input: `type User = { id: string };\nfunction render(value: User | undefined) {\n  if (value) read(value.id);\n}\n`,
          name: 'imported or aliased object type remains semantic',
        },
        {
          input: `function render({ value }: { value: { id: string } | null }) {\n  if (value) read(value.id);\n}\n`,
          name: 'object destructuring binding ignored',
        },
        {
          input: `function render([value]: Array<{ id: string } | null>) {\n  if (value) read(value.id);\n}\n`,
          name: 'array destructuring binding ignored',
        },
      ]);
    });
  });

  describe('explicit nullish comparisons', () => {
    it('fixes positive nullish comparison pairs and loose positive checks', async () => {
      await expectFixCases([
        {
          input: `${importLine}if (value !== null && value !== undefined) read(value);\n`,
          name: 'null then undefined',
          output: `${importLine}if (isNotNullOrUndefined(value)) read(value);\n`,
        },
        {
          input: `${importLine}if (value !== undefined && value !== null) read(value);\n`,
          name: 'undefined then null',
          output: `${importLine}if (isNotNullOrUndefined(value)) read(value);\n`,
        },
        {
          input: `${importLine}if (value != null) read(value);\n`,
          name: 'loose not null',
          output: `${importLine}if (isNotNullOrUndefined(value)) read(value);\n`,
        },
        {
          input: `${importLine}if (null != value) read(value);\n`,
          name: 'loose not null reversed',
          output: `${importLine}if (isNotNullOrUndefined(value)) read(value);\n`,
        },
      ]);
    });

    it('fixes negative nullish comparison pairs and loose negative checks', async () => {
      await expectFixCases([
        {
          input: `${importLine}if (value === null || value === undefined) return null;\n`,
          name: 'null then undefined',
          output: `${importLine}if (!isNotNullOrUndefined(value)) return null;\n`,
        },
        {
          input: `${importLine}if (value === undefined || value === null) return null;\n`,
          name: 'undefined then null',
          output: `${importLine}if (!isNotNullOrUndefined(value)) return null;\n`,
        },
        {
          input: `${importLine}if (value == null) return null;\n`,
          name: 'loose null',
          output: `${importLine}if (!isNotNullOrUndefined(value)) return null;\n`,
        },
        {
          input: `${importLine}if (null == value) return null;\n`,
          name: 'loose null reversed',
          output: `${importLine}if (!isNotNullOrUndefined(value)) return null;\n`,
        },
      ]);
    });

    it('reports but does not fix non-identifier subjects because the fix would change evaluation count', async () => {
      await expectNoFixCases([
        {
          input: `${importLine}if (object.value !== null && object.value !== undefined) read(object.value);\n`,
          name: 'member expression pair',
        },
        {
          input: `${importLine}if (this.value !== null && this.value !== undefined) read(this.value);\n`,
          name: 'this member pair',
        },
        {
          input: `${importLine}if (items[index] !== null && items[index] !== undefined) read(items[index]);\n`,
          name: 'computed member pair',
        },
        {
          input: `${importLine}if (object?.value !== null && object?.value !== undefined) read(object.value);\n`,
          name: 'optional member pair',
        },
        {
          input: `${importLine}if (getValue() != null) read(getValue());\n`,
          name: 'call expression loose check',
        },
      ]);
    });

    it('does not report lookalike or semantically different comparisons', async () => {
      await expectCleanCases([
        {
          input: `if (value !== null && other !== undefined) read(value);\n`,
          name: 'different subjects',
        },
        {
          input: `if (value !== null && value !== null) read(value);\n`,
          name: 'duplicate null kind',
        },
        {
          input: `if (value !== null || value !== undefined) read(value);\n`,
          name: 'wrong positive operator',
        },
        {
          input: `if (value === null && value === undefined) return;\n`,
          name: 'wrong negative operator',
        },
        {
          input: `if ('value' in object) read(object.value);\n`,
          name: 'in operator',
        },
        {
          input: `const undefined = 1;\nif (value !== undefined) read(value);\n`,
          name: 'single undefined comparison remains ignored',
        },
      ]);
    });

    it('reports explicit comparisons without fixes when the import is missing, aliased, or shadowed', async () => {
      await expectNoFixCases([
        {
          input: `if (value !== null && value !== undefined) read(value);\n`,
          name: 'missing import',
        },
        {
          input: `import { isNotNullOrUndefined as present } from 'is-not-null-or-undefined';\nif (value != null) read(value);\n`,
          name: 'aliased import',
        },
        {
          input: `${importLine}const isNotNullOrUndefined = other;\nif (value != null) read(value);\n`,
          name: 'shadowed import',
        },
        {
          input: `${importLine}function isNotNullOrUndefined(value: unknown) {\n  return true;\n}\nif (value == null) read(value);\n`,
          name: 'function shadow',
        },
        {
          input: `${importLine}class isNotNullOrUndefined {}\nif (value != null) read(value);\n`,
          name: 'class shadow',
        },
      ]);
    });

    it('allows single strict nullish comparisons because the helper would change semantics', async () => {
      await expectCleanCases([
        {
          input: `${importLine}if (value !== null) read(value);\n`,
          name: 'not null only',
        },
        {
          input: `${importLine}if (value === undefined) return;\n`,
          name: 'undefined only',
        },
      ]);
    });
  });

  describe('filter predicates and local helper predicates', () => {
    it('fixes simple filter predicates', async () => {
      await expectFixCases([
        {
          input: `${importLine}const values = input.filter(value => value !== null && value !== undefined);\n`,
          name: 'strict pair',
          output: `${importLine}const values = input.filter(isNotNullOrUndefined);\n`,
        },
        {
          input: `${importLine}const values = input.filter((value) => value != null);\n`,
          name: 'parenthesized loose predicate',
          output: `${importLine}const values = input.filter(isNotNullOrUndefined);\n`,
        },
      ]);
    });

    it('reports local predicate helpers without fixes', async () => {
      await expectNoFixCases([
        {
          input: `const present = (value: unknown) => value !== null && value !== undefined;\n`,
          name: 'arrow helper',
        },
        {
          input: `function present(value: unknown) {\n  return value != null;\n}\n`,
          name: 'function helper',
        },
      ]);
    });

    it('reports filter predicates without unsafe fixes when import is unavailable, negated, or complex', async () => {
      await expectNoFixCases([
        {
          input: `const values = input.filter(value => value !== null && value !== undefined);\n`,
          name: 'missing import',
        },
        {
          input: `${importLine}const values = input.filter(value => value === null || value === undefined);\n`,
          name: 'negative strict pair',
        },
        {
          input: `${importLine}const values = input.filter(value => value !== null && value !== undefined && value.active);\n`,
          name: 'complex predicate',
          count: 1,
        },
      ]);
    });

    it('reports explicit nullish predicates without filter-specific fixes for non-filter and non-shorthand callback shapes', async () => {
      await expectNoFixCases([
        {
          input: `${importLine}const values = input.map(value => value !== null && value !== undefined);\n`,
          name: 'map is not filter',
        },
        {
          input: `${importLine}const values = input['filter'](value => value !== null && value !== undefined);\n`,
          name: 'computed filter property',
        },
        {
          input: `${importLine}const values = input.filter(function valuePresent(value) { return value != null; });\n`,
          name: 'function predicate',
        },
        {
          input: `${importLine}const values = input.filter(value => value != null, thisArg);\n`,
          name: 'extra thisArg',
        },
        {
          input: `${importLine}const values = input.filter(({ value }) => value !== null && value !== undefined);\n`,
          name: 'destructured parameter',
        },
      ]);
    });

    it('ignores callback and property lookalikes without nullish predicates', async () => {
      await expectCleanCases([
        {
          input: `${importLine}const filter = input.filter;\n`,
          name: 'filter property read',
        },
        {
          input: `${importLine}const values = input.filter;\n`,
          name: 'filter identifier read',
        },
        {
          input: `${importLine}const values = input.filter(value => Boolean(value));\n`,
          name: 'non-nullish filter predicate',
        },
        {
          input: `${importLine}const values = input.filter(value => value > null);\n`,
          name: 'filter predicate with non-equality null comparison',
        },
        {
          input: `${importLine}const values = input.filter(value => value === null);\n`,
          name: 'filter predicate with absent single null comparison',
        },
        {
          input: `${importLine}const values = input.filter(value => value !== undefined);\n`,
          name: 'filter predicate with undefined-only comparison',
        },
      ]);
    });
  });

  describe('allowed expressions and false positives', () => {
    it('allows known safe or intentionally non-gate contexts', async () => {
      await expectCleanCases([
        {
          input: `function render(value: boolean | null) {\n  if (value === true) return 'yes';\n}\n`,
          name: 'normal boolean comparison',
        },
        {
          input: `function render(value: string | null) {\n  return <span>{value}</span>;\n}\n`,
          name: 'direct JSX rendering',
        },
        {
          input: `function render(value: string | null) {\n  return <Input value={value} />;\n}\n`,
          name: 'JSX prop value',
        },
        {
          input: `function render(commentToDelete: string | null) {\n  return <DangerConfirmSheet open={commentToDelete !== null} />;\n}\n`,
          name: 'JSX prop null discriminant',
        },
        {
          input: `function render(value: string | null | undefined) {\n  return <Input ready={value !== null && value !== undefined} />;\n}\n`,
          name: 'JSX prop nullish pair',
        },
        {
          input: `function render(error: string | null, errorId: string) {\n  return <MoneyField ariaDescribedBy={error ? errorId : undefined} />;\n}\n`,
          name: 'JSX prop nullable string helper value',
        },
        {
          input: `function render(error: string | null) {\n  return error ? <div role="alert">{error}</div> : null;\n}\n`,
          name: 'nullable string JSX branch',
        },
        {
          input: `function render(value: string | null) {\n  const label = value ?? 'none';\n  if (label) return label;\n}\n`,
          name: 'nullish coalesced local',
        },
        {
          input: `function render(value: string | null) {\n  return value || 'none';\n}\n`,
          name: 'fallback display value',
        },
        {
          input: `function render(value: number | null) {\n  if (value > 0 && value !== null) return value;\n}\n`,
          name: 'mixed logical comparison is not a nullish pair',
        },
        {
          input: `function render(value: number | null) {\n  if (value > null) return value;\n}\n`,
          name: 'non-equality null comparison',
        },
        {
          input: `function render(value: unknown, other: unknown) {\n  if (value !== other) return value;\n}\n`,
          name: 'non-nullish identifier comparison',
        },
        {
          input: `function render(value: { id: string } | null) {\n  if (isNotNullOrUndefined(value) && value.id) return value.id;\n}\n`,
          name: 'already guarded',
        },
        {
          input: `function render({ value }: { value: string | null }) {\n  if (value) return value;\n}\n`,
          name: 'destructured local',
        },
        {
          input: `type Props = { activeClassName?: string; inactiveClassName?: string };\nfunction render({ activeClassName, inactiveClassName }: Props) {\n  const active = false;\n  return <button aria-selected={active} className={active ? activeClassName : inactiveClassName} />;\n}\n`,
          name: 'ternary branches are not parsed as annotations',
        },
        {
          input: `type Props = { timelineUnread?: boolean };\nfunction render({ timelineUnread = false }: Props) {\n  return <>{timelineUnread && <span />}</>;\n}\n`,
          name: 'optional boolean JSX rendering',
        },
        {
          input: `function render(group: { _id: string } | null | undefined, deviceId: string | null, me: { _id: string } | null | undefined) {\n  const member = useQuery(api.members.myMember, group && deviceId ? { deviceId, groupId: group._id } : 'skip');\n  const expenses = useQuery(api.expenses.list, group && deviceId && me ? { deviceId, groupId: group._id } : 'skip');\n  return [member, expenses];\n}\n`,
          name: 'multi-input query availability gates',
        },
        {
          input: `function prepare(group: { name: string } | null, settle: { total: number } | null) {\n  return Boolean(group && settle);\n}\n`,
          name: 'explicit Boolean conversion of availability gate',
        },
      ]);
    });
  });

  describe('formatting and diagnostics stability', () => {
    it('preserves comments, parentheses, multiline formatting, and idempotence', async () => {
      await expectFix({
        input: `${importLine}if ((value /* keep */ !== null) &&\n  value !== undefined) {\n  read(value);\n}\n`,
        name: 'comments and multiline pair',
        output: `${importLine}if (isNotNullOrUndefined(value)) {\n  read(value);\n}\n`,
      });
    });

    it('keeps CRLF fixes stable', async () => {
      await expectFix({
        input: `${importLine}if (value != null) {\r\n  read(value);\r\n}\r\n`,
        name: 'crlf',
        output: `${importLine}if (isNotNullOrUndefined(value)) {\r\n  read(value);\r\n}\r\n`,
      });
    });

    it('keeps semicolon-less fixes stable', async () => {
      await expectFix({
        input: `${importLine}if (value != null) {\n  read(value)\n}\n`,
        name: 'semicolon-less',
        output: `${importLine}if (isNotNullOrUndefined(value)) {\n  read(value)\n}\n`,
      });
    });

    it('preserves multiline filter call shape by replacing only the call expression', async () => {
      await expectFix({
        input: `${importLine}const values = input\n  .filter((value) => value !== null && value !== undefined)\n  .map(value => value.id);\n`,
        name: 'multiline filter',
        output: `${importLine}const values = input\n  .filter(isNotNullOrUndefined)\n  .map(value => value.id);\n`,
      });
    });

    it('reports repeated diagnostics without duplicates on the same expression', async () => {
      await expectNoFix(
        `function render(first: { id: string } | null, second: { id: string } | null) {\n  if (first) return first.id;\n  if (second) return second.id;\n}\n`,
        2,
      );
    });

    it('reports repeated diagnostics in one file with stable counts across comparison, filter, and truthiness forms', async () => {
      await expectNoFix(
        `function render(first: { id: string } | null, second: unknown, values: Array<unknown>) {\n  if (first) return first.id;\n  if (second != null) read(second);\n  return values.filter(value => value !== null && value !== undefined);\n}\n`,
        3,
      );
    });

    it('converges with oxfmt after fixes', async () => {
      const fixture = await createFixture({
        input: `${importLine}if(value!=null){read(value)}\n`,
        ruleId,
      });

      await runOxfmt(fixture);
      await expect(runOxlintFix(fixture)).resolves.toBe(true);
      await runOxfmt(fixture);
      await expect(runOxlintFix(fixture)).resolves.toBe(false);
      await expect(readFixture(fixture)).resolves.toBe(`${importLine}if (isNotNullOrUndefined(value)) {\n  read(value);\n}\n`);
    });
  });
});
