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

const ruleId = '@mkaradeniz/array/no-mutation';
const mutationMessage = 'Avoid mutating arrays';

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
    expect(diagnostic.code).toBe('@mkaradeniz/array(no-mutation)');
    expect(diagnostic.message).toContain(mutationMessage);
  }
};

const expectDiagnostics = async (input: string, count: number) => {
  const fixture = await createFixture({ input, ruleId });

  await expectFixtureDiagnostics(fixture, count);

  return fixture;
};

const expectCleanCases = async (cases: Array<ReportCase>) => {
  const fixture = await createFixtureSet({
    inputs: cases.map(({ input }) => input),
    ruleId,
  });

  await expectFixtureDiagnostics(fixture, 0);
  await expect(runOxlintFix(fixture)).resolves.toBe(false);
};

const expectClean = async (input: string) => {
  const fixture = await expectDiagnostics(input, 0);

  await expect(runOxlintFix(fixture)).resolves.toBe(false);
  await expect(readFixture(fixture)).resolves.toBe(input);
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

const expectNoFix = async (input: string, count = 1) => {
  const fixture = await expectDiagnostics(input, count);

  await expect(runOxlintFix(fixture)).resolves.toBe(false);
  await expect(readFixture(fixture)).resolves.toBe(input);
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
  describe.each([
    {
      immutable: 'toSorted',
      method: 'sort',
      valueArgs: 'compare',
    },
    {
      immutable: 'toReversed',
      method: 'reverse',
      valueArgs: '',
    },
    {
      immutable: 'toSpliced',
      method: 'splice',
      valueArgs: 'start, deleteCount, nextItem',
    },
  ])('$method()', ({ immutable, method, valueArgs }) => {
    const args = valueArgs.length > 0 ? valueArgs : '';
    const call = `${method}(${args})`;
    const fixedCall = `${immutable}(${args})`;

    const fixCases: Array<FixCase> = [
      {
        input: `const next = items.${call};\n`,
        name: 'fixes a variable initializer when the returned array is used',
        output: `const next = items.${fixedCall};\n`,
      },
      {
        input: `function read() {\n  return items.${call};\n}\n`,
        name: 'fixes return-value usage',
        output: `function read() {\n  return items.${fixedCall};\n}\n`,
      },
      {
        input: `const next = consume(items.${call});\n`,
        name: 'fixes call-argument usage',
        output: `const next = consume(items.${fixedCall});\n`,
      },
      {
        input: `const next = condition ? items.${call} : fallback;\n`,
        name: 'fixes ternary branches',
        output: `const next = condition ? items.${fixedCall} : fallback;\n`,
      },
      {
        input: `const next = enabled && items.${call};\n`,
        name: 'fixes logical expressions',
        output: `const next = enabled && items.${fixedCall};\n`,
      },
      {
        input: `const read = () => items.${call};\n`,
        name: 'fixes arrow implicit returns',
        output: `const read = () => items.${fixedCall};\n`,
      },
      {
        input: `const first = items.${call}[0];\n`,
        name: 'fixes indexed chained reads',
        output: `const first = items.${fixedCall}[0];\n`,
      },
      {
        input: `const mapped = items.${call}.map(project);\n`,
        name: 'fixes chained calls',
        output: `const mapped = items.${fixedCall}.map(project);\n`,
      },
      {
        input: `const next = state.items.${call};\n`,
        name: 'fixes object property receivers',
        output: `const next = state.items.${fixedCall};\n`,
      },
      {
        input: `const next = this.items.${call};\n`,
        name: 'fixes this property receivers',
        output: `const next = this.items.${fixedCall};\n`,
      },
      {
        input: `const next = state.groups.active.items.${call};\n`,
        name: 'fixes nested member receiver shapes',
        output: `const next = state.groups.active.items.${fixedCall};\n`,
      },
      {
        input: `const next = items?.${call};\n`,
        name: 'fixes optional chaining when the result is used',
        output: `const next = items?.${fixedCall};\n`,
      },
      {
        input: `const next = (items).${call};\n`,
        name: 'preserves receiver parentheses',
        output: `const next = (items).${fixedCall};\n`,
      },
      {
        input: `const next = items\n  .${method}(${args});\n`,
        name: 'preserves multiline member formatting',
        output: `const next = items\n  .${immutable}(${args});\n`,
      },
      {
        input:
          method === 'reverse'
            ? `const next = items.${method}(\n  // kept even though reverse takes no meaningful args\n);\n`
            : `const next = items.${method}(\n  first,\n  // keep argument comment\n  second,\n);\n`,
        name: 'preserves multiline arguments and comments',
        output:
          method === 'reverse'
            ? `const next = items.${immutable}(\n  // kept even though reverse takes no meaningful args\n);\n`
            : `const next = items.${immutable}(\n  first,\n  // keep argument comment\n  second,\n);\n`,
      },
      {
        input: `const next = items /* keep receiver comment */ .${call};\n`,
        name: 'preserves comments around the receiver',
        output: `const next = items /* keep receiver comment */ .${fixedCall};\n`,
      },
    ];

    it('applies exact safe fixes, preserves formatting, and is idempotent', async () => {
      await expectFixCases(fixCases);
    });

    const noFixCases: Array<ReportCase> = [
      {
        input: `items.${call};\n`,
        name: 'reports expression statements without producing an unused copy',
      },
      {
        input: `state.items.${call};\n`,
        name: 'reports object property expression statements without a fix',
      },
      {
        input: `this.items.${call};\n`,
        name: 'reports this property expression statements without a fix',
      },
      {
        input: `items?.${call};\n`,
        name: 'reports optional expression statements without a fix',
      },
      {
        input: `const next = items["${method}"](${args});\n`,
        name: 'reports literal computed property access but leaves it unfixed',
      },
      {
        input: `const next = getItems().${call};\n`,
        count: 0,
        name: 'ignores non-obviously-array function return receivers',
      },
      {
        input: `const next = cache.get("items").${call};\n`,
        count: 0,
        name: 'ignores non-obviously-array nested call receivers',
      },
    ];

    it('reports unsafe receiver and statement cases without fixes', async () => {
      await expectNoFixCases(noFixCases);
    });

    const freshCases: Array<ReportCase> = [
      {
        input: `const next = [].${call};\n`,
        name: 'ignores array literals',
      },
      {
        input: `const next = [first, second].${call};\n`,
        name: 'ignores populated array literals',
      },
      {
        input: `const next = [...items].${call};\n`,
        name: 'ignores spread copies',
      },
      {
        input: `const next = Array.from(items).${call};\n`,
        name: 'ignores Array.from copies',
      },
      {
        input: `const next = Array.of(first, second).${call};\n`,
        name: 'ignores Array.of temporaries',
      },
      {
        input: `const next = items.slice().${call};\n`,
        name: 'ignores slice copies',
      },
      {
        input: `const next = items.concat(extra).${call};\n`,
        name: 'ignores concat copies',
      },
      {
        input: `const next = Array.from([...items]).${call};\n`,
        name: 'ignores nested fresh copies',
      },
      {
        input: `const next = items.map(project).${call};\n`,
        name: 'ignores mapper-produced arrays',
      },
      {
        input: `const next = items.filter(Boolean).${call};\n`,
        name: 'ignores filter-produced arrays',
      },
    ];

    it('ignores fresh temporary arrays', async () => {
      await expectCleanCases(freshCases);
    });

    it('ignores dynamic computed access because the method is not syntactically known', async () => {
      await expectClean(`const next = items[method](${args});\n`);
    });
  });

  describe.each([
    {
      method: 'push',
      returnArgs: 'item',
      statementFixes: [
        {
          input: 'items.push(item);\n',
          name: 'rewrites direct variable append',
          output: 'items = [...items, item];\n',
        },
        {
          input: 'items.push(first, second);\n',
          name: 'preserves multiple append arguments',
          output: 'items = [...items, first, second];\n',
        },
        {
          input: 'this.items.push(item);\n',
          name: 'rewrites this property append',
          output: 'this.items = [...this.items, item];\n',
        },
        {
          input: 'state.items.push(item);\n',
          name: 'rewrites object property append',
          output: 'state.items = [...state.items, item];\n',
        },
        {
          input: 'state.groups.active.items.push(item);\n',
          name: 'rewrites nested member append',
          output: 'state.groups.active.items = [...state.groups.active.items, item];\n',
        },
        {
          input: 'items.push(\n  first,\n  // keep the item comment\n  second,\n);\n',
          name: 'preserves multiline append arguments',
          output: 'items = [...items, first,\n  // keep the item comment\n  second];\n',
        },
      ],
    },
    {
      method: 'unshift',
      returnArgs: 'item',
      statementFixes: [
        {
          input: 'items.unshift(item);\n',
          name: 'rewrites direct variable prepend',
          output: 'items = [item, ...items];\n',
        },
        {
          input: 'items.unshift(first, second);\n',
          name: 'preserves multiple prepend arguments',
          output: 'items = [first, second, ...items];\n',
        },
        {
          input: 'this.items.unshift(item);\n',
          name: 'rewrites this property prepend',
          output: 'this.items = [item, ...this.items];\n',
        },
        {
          input: 'state.items.unshift(item);\n',
          name: 'rewrites object property prepend',
          output: 'state.items = [item, ...state.items];\n',
        },
        {
          input: 'state.groups.active.items.unshift(item);\n',
          name: 'rewrites nested member prepend',
          output: 'state.groups.active.items = [item, ...state.groups.active.items];\n',
        },
        {
          input: 'items.unshift(\n  first,\n  // keep the item comment\n  second,\n);\n',
          name: 'preserves multiline prepend arguments',
          output: 'items = [first,\n  // keep the item comment\n  second, ...items];\n',
        },
      ],
    },
  ])('$method()', ({ method, returnArgs, statementFixes }) => {
    it('applies exact statement fixes and is idempotent', async () => {
      await expectFixCases(statementFixes);
    });

    const noFixCases: Array<ReportCase> = [
      {
        input: `const length = items.${method}(${returnArgs});\n`,
        name: 'reports assigned return length without a fix',
      },
      {
        input: `function add() {\n  return items.${method}(${returnArgs});\n}\n`,
        name: 'reports return length usage without a fix',
      },
      {
        input: `const length = consume(items.${method}(${returnArgs}));\n`,
        name: 'reports call-argument return length usage without a fix',
      },
      {
        input: `const length = condition ? items.${method}(${returnArgs}) : 0;\n`,
        name: 'reports ternary return length usage without a fix',
      },
      {
        input: `const length = enabled && items.${method}(${returnArgs});\n`,
        name: 'reports logical return length usage without a fix',
      },
      {
        input: `const add = () => items.${method}(${returnArgs});\n`,
        name: 'reports arrow implicit return length usage without a fix',
      },
      {
        input: `getItems().${method}(${returnArgs});\n`,
        count: 0,
        name: 'ignores non-obviously-array complex receivers',
      },
      {
        input: `items?.${method}(${returnArgs});\n`,
        name: 'reports optional mutation without invalid assignment fixes',
      },
      {
        input: `state[getKey()].items.${method}(${returnArgs});\n`,
        name: 'reports computed receivers that could change evaluation order',
      },
      {
        input: `items["${method}"](${returnArgs});\n`,
        name: 'reports literal computed property access but leaves it unfixed',
      },
      {
        input: `router.${method}("/g/" + slug);\n`,
        count: 0,
        name: 'ignores non-array object methods',
      },
      {
        input: `analytics.${method}(event);\n`,
        count: 0,
        name: 'ignores analytics-style object methods',
      },
    ];

    it('reports return-value and unsafe receiver cases without fixes', async () => {
      await expectNoFixCases(noFixCases);
    });

    const freshCases = [
      `[].${method}(${returnArgs});\n`,
      `[...items].${method}(${returnArgs});\n`,
      `Array.from(items).${method}(${returnArgs});\n`,
      `items.slice().${method}(${returnArgs});\n`,
      `items.concat(extra).${method}(${returnArgs});\n`,
      `Array.from([...items]).${method}(${returnArgs});\n`,
      `items.map(project).${method}(${returnArgs});\n`,
    ];

    it('ignores fresh temporary mutation', async () => {
      await expectCleanCases(freshCases.map(input => ({ input, name: input })));
    });
  });

  it('does not confuse similarly named object APIs with array mutation', async () => {
    await expectClean(
      `router.push(\`/g/\${encodeURIComponent(slug)}\${nextTab.path}\`);
history.pushState(state, "", url);
`,
    );
  });

  describe.each([
    {
      method: 'pop',
      readReplacement: 'at(-1)',
      statementReplacement: 'slice(0, -1)',
    },
    {
      method: 'shift',
      readReplacement: 'at(0)',
      statementReplacement: 'slice(1)',
    },
  ])('$method()', ({ method, readReplacement, statementReplacement }) => {
    const fixCases: Array<FixCase> = [
      {
        input: `items.${method}();\n`,
        name: 'rewrites direct variable removal statements',
        output: `items = items.${statementReplacement};\n`,
      },
      {
        input: `this.items.${method}();\n`,
        name: 'rewrites this property removal statements',
        output: `this.items = this.items.${statementReplacement};\n`,
      },
      {
        input: `state.items.${method}();\n`,
        name: 'rewrites object property removal statements',
        output: `state.items = state.items.${statementReplacement};\n`,
      },
      {
        input: `const item = items.${method}();\n`,
        name: 'rewrites assigned returned element reads',
        output: `const item = items.${readReplacement};\n`,
      },
      {
        input: `function read() {\n  return items.${method}();\n}\n`,
        name: 'rewrites returned element reads',
        output: `function read() {\n  return items.${readReplacement};\n}\n`,
      },
      {
        input: `const item = consume(items.${method}());\n`,
        name: 'rewrites call-argument element reads',
        output: `const item = consume(items.${readReplacement});\n`,
      },
      {
        input: `const item = condition ? items.${method}() : fallback;\n`,
        name: 'rewrites ternary element reads',
        output: `const item = condition ? items.${readReplacement} : fallback;\n`,
      },
      {
        input: `const item = enabled && items.${method}();\n`,
        name: 'rewrites logical element reads',
        output: `const item = enabled && items.${readReplacement};\n`,
      },
      {
        input: `const read = () => items.${method}();\n`,
        name: 'rewrites arrow implicit returned element reads',
        output: `const read = () => items.${readReplacement};\n`,
      },
    ];

    it('applies exact safe fixes and is idempotent', async () => {
      await expectFixCases(fixCases);
    });

    const noFixCases = [
      {
        input: `const item = items.${method}(unexpected);\n`,
        name: 'reports calls with unexpected arguments without assuming semantics',
      },
      {
        input: `items?.${method}();\n`,
        name: 'reports optional removal statements without invalid assignment fixes',
      },
      {
        input: `getItems().${method}();\n`,
        count: 0,
        name: 'ignores non-obviously-array complex removal receivers',
      },
      {
        input: `state[getKey()].items.${method}();\n`,
        name: 'reports computed removal receivers without duplicating evaluation',
      },
      {
        input: `items["${method}"]();\n`,
        name: 'reports literal computed property access but leaves it unfixed',
      },
      {
        input: `const mapped = items.${method}().map(project);\n`,
        name: 'reports nested element return usage without assuming element shape',
      },
    ];

    it('reports unsafe removal cases without fixes', async () => {
      await expectNoFixCases(noFixCases);
    });

    const freshCases = [
      `[].${method}();\n`,
      `[...items].${method}();\n`,
      `Array.from(items).${method}();\n`,
      `items.slice().${method}();\n`,
      `items.concat(extra).${method}();\n`,
      `items.filter(Boolean).${method}();\n`,
    ];

    it('ignores fresh temporary removal', async () => {
      await expectCleanCases(freshCases.map(input => ({ input, name: input })));
    });
  });

  describe.each([
    {
      method: 'fill',
      sampleArgs: 'value, start, end',
    },
    {
      method: 'copyWithin',
      sampleArgs: 'target, start, end',
    },
  ])('$method()', ({ method, sampleArgs }) => {
    const reportCases = [
      `items.${method}(${sampleArgs});\n`,
      `const next = items.${method}(${sampleArgs});\n`,
      `return items.${method}(${sampleArgs});\n`,
      `consume(items.${method}(${sampleArgs}));\n`,
      `condition ? items.${method}(${sampleArgs}) : fallback;\n`,
      `enabled && items.${method}(${sampleArgs});\n`,
      `const read = () => items.${method}(${sampleArgs});\n`,
      `state.items.${method}(${sampleArgs});\n`,
      `this.items.${method}(${sampleArgs});\n`,
      `state.groups.active.items.${method}(${sampleArgs});\n`,
      `items?.${method}(${sampleArgs});\n`,
      `items["${method}"](${sampleArgs});\n`,
      { count: 0, input: `getItems().${method}(${sampleArgs});\n` },
    ];

    it('reports without a fix in statement and value contexts', async () => {
      await expectNoFixCases(
        reportCases.map(reportCase =>
          typeof reportCase === 'string' ? { input: reportCase, name: reportCase } : { ...reportCase, name: reportCase.input },
        ),
      );
    });

    const freshCases = [
      `[].${method}(${sampleArgs});\n`,
      `[...items].${method}(${sampleArgs});\n`,
      `Array.from(items).${method}(${sampleArgs});\n`,
      `items.slice().${method}(${sampleArgs});\n`,
      `items.concat(extra).${method}(${sampleArgs});\n`,
      `Array.from([...items]).${method}(${sampleArgs});\n`,
    ];

    it('ignores fresh temporary writes', async () => {
      await expectCleanCases(freshCases.map(input => ({ input, name: input })));
    });
  });

  it('reports every mutating method once in a mixed file', async () => {
    await expectNoFix(
      `items.sort();
items.reverse();
items.splice(0, 1);
const length = items.push(item);
const last = items.pop(ignored);
const first = items.shift(ignored);
const length2 = items.unshift(item);
items.fill(value);
items.copyWithin(0, 1);
`,
      9,
    );
  });

  it('does not duplicate diagnostics for the same call', async () => {
    await expectDiagnostics('const next = items.sort().map(project);\n', 1);
  });

  it('reports likely array-like names syntactically because this rule is not type-aware', async () => {
    await expectNoFix('queue.sort();\nstack.sort();\n', 2);
  });

  it('does not report non-mutating methods, identifiers, property reads, or free calls', async () => {
    await expectClean(
      `const next = items.toSorted(compare);
const next2 = items.toReversed();
const next3 = items.toSpliced(0, 1);
const mapped = items.map(project);
const filtered = items.filter(Boolean);
const sorted = items.sorted();
sort(items);
const sort = createSorter();
const method = items.sort;
const callback = { sort: handler };
items.forEach(item => item.sortKey);
`,
    );
  });

  it('handles control-flow, callbacks, try/finally, class fields, and JSX-adjacent code', async () => {
    await expectNoFix(
      `class Store {
  items = [];
  read() {
    if (ready) this.items.sort();
    for (const item of batches) item.children.reverse();
    try {
      batches.forEach(batch => batch.items.splice(0, 1));
    } finally {
      this.items.fill(null);
    }
    return <List items={this.items.toSorted()} />;
  }
}
`,
      4,
    );
  });

  it('keeps semicolon-less fixes stable', async () => {
    await expectFix({
      input: 'const next = items.sort(compare)\n',
      name: 'semicolon-less sort replacement',
      output: 'const next = items.toSorted(compare)\n',
    });
  });

  it('keeps CRLF files stable when applying fixes', async () => {
    await expectFix({
      input: 'items.push(item);\r\n',
      name: 'CRLF append replacement',
      output: 'items = [...items, item];\r\n',
    });
  });

  it('converges with oxfmt after immutable fixes', async () => {
    const fixture = await createFixture({
      input: 'const next=items.sort((a,b)=>a-b)\nitems.push(next[0])\n',
      ruleId,
    });

    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await runOxfmt(fixture);
    await expect(runOxlintFix(fixture)).resolves.toBe(false);
    await expect(readFixture(fixture)).resolves.toBe('const next = items.toSorted((a, b) => a - b);\nitems = [...items, next[0]];\n');
  });
});
