import { afterEach, describe, expect, it } from 'vitest';

import { cleanupFixtures, createFixture, readFixture, runOxlintFix as runOxlintFixForRule } from './test-helpers.ts';

const ruleId = '@mkaradeniz/whitespace/react-next-organization';
const runOxlintFix = async (fixture: Awaited<ReturnType<typeof createFixture>>) => runOxlintFixForRule({ fixture, ruleId });

afterEach(cleanupFixtures);

const laterGroupByHook = [
  ['React.use', 'const value = React.use(params);', 'const group = useQuery(api.groups.get);'],
  ['useRouter', 'const router = useRouter();', 'const group = useQuery(api.groups.get);'],
  ['useParams', 'const paramsValue = useParams();', 'const group = useQuery(api.groups.get);'],
  ['useSearchParams', 'const search = useSearchParams();', 'const group = useQuery(api.groups.get);'],
  ['useDeviceId', 'const deviceId = useDeviceId();', 'const group = useQuery(api.groups.get);'],
  ['useAuthActions', 'const auth = useAuthActions();', 'const group = useQuery(api.groups.get);'],
  ['useQuery', 'const group = useQuery(api.groups.get);', 'const save = useMutation(api.groups.save);'],
  ['useGroupBySlug', 'const group = useGroupBySlug({ slug });', 'const save = useMutation(api.groups.save);'],
  ['useGroupCategories', 'const categories = useGroupCategories({ groupId });', 'const save = useMutation(api.groups.save);'],
  ['useMutation', 'const save = useMutation(api.groups.save);', "const [title, setTitle] = React.useState('');"],
  ['useAction', 'const runAction = useAction(api.groups.run);', "const [title, setTitle] = React.useState('');"],
  ['React.useState', "const [title, setTitle] = React.useState('');", 'const inputRef = React.useRef(null);'],
  ['React.useReducer', 'const [state, dispatch] = React.useReducer(reducer, initialState);', 'const inputRef = React.useRef(null);'],
  ['React.useRef', 'const inputRef = React.useRef(null);', 'const total = amount + tip;'],
  ['React.useId', 'const formId = React.useId();', 'const total = amount + tip;'],
  ['plain derived const', 'const total = amount + tip;', 'const submit = React.useCallback(() => save(total), [save, total]);'],
  [
    'React.useMemo',
    'const total = React.useMemo(() => amount + tip, [amount, tip]);',
    'const submit = React.useCallback(() => save(total), [save, total]);',
  ],
  [
    'React.useCallback',
    'const submit = React.useCallback(() => save(total), [save, total]);',
    'React.useEffect(() => sync(submit), [submit]);',
  ],
  ['React.useEffect', 'React.useEffect(() => syncTitle(), []);', 'const submit = () => save();'],
  ['React.useLayoutEffect', 'React.useLayoutEffect(() => syncLayout(), []);', 'const submit = () => save();'],
] as const;

describe(`${ruleId} hook groups`, () => {
  it.each(laterGroupByHook)('classifies %s', async (_name, firstLine, secondLine) => {
    const fixture = await createFixture({
      input: `export const ExpenseForm = () => {\n  ${firstLine}\n  ${secondLine}\n  return <form />;\n};\n`,
      ruleId,
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      `export const ExpenseForm = () => {\n  ${firstLine}\n\n  ${secondLine}\n  return <form />;\n};\n`,
    );
  });

  it('classifies custom hooks in every configured group', async () => {
    const fixture = await createFixture({
      input:
        'export const ExpenseForm = () => {\n  const context = useCustomContext();\n  const read = useCustomRead();\n  const write = useCustomWrite();\n  const state = useCustomState();\n  const ref = useCustomRef();\n  const derived = useCustomDerived();\n  const callback = useCustomCallback();\n  useCustomEffect();\n  const handler = () => callback();\n  return <form>{handler.name}</form>;\n};\n',
      ruleId,
      ruleOptions: {
        hookGroups: {
          callbacks: ['useCustomCallback'],
          context: ['useCustomContext'],
          derived: ['useCustomDerived'],
          effects: ['useCustomEffect'],
          reads: ['useCustomRead'],
          refs: ['useCustomRef'],
          state: ['useCustomState'],
          writes: ['useCustomWrite'],
        },
      },
    });

    await expect(runOxlintFix(fixture)).resolves.toBe(true);
    await expect(readFixture(fixture)).resolves.toBe(
      'export const ExpenseForm = () => {\n  const context = useCustomContext();\n\n  const read = useCustomRead();\n\n  const write = useCustomWrite();\n\n  const state = useCustomState();\n\n  const ref = useCustomRef();\n\n  const derived = useCustomDerived();\n\n  const callback = useCustomCallback();\n\n  useCustomEffect();\n\n  const handler = () => callback();\n  return <form>{handler.name}</form>;\n};\n',
    );
  });
});
