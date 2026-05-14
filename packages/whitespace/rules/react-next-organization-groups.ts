import { type Context, type ESTree } from '@oxlint/plugins';

export type GroupName =
  | 'callbacks'
  | 'context'
  | 'derived'
  | 'effects'
  | 'guards'
  | 'handlers'
  | 'reads'
  | 'refs'
  | 'returns'
  | 'state'
  | 'writes';

export type HookGroups = Partial<Record<GroupName, Array<string>>>;

export type ClassifiedStatement = {
  group: GroupName;
  order: number;
  statement: ESTree.Statement;
};

type Options = {
  hookGroups?: HookGroups;
  orderDiagnostics?: boolean;
};

export const groupOrder: Array<GroupName> = [
  'context',
  'reads',
  'writes',
  'state',
  'refs',
  'derived',
  'callbacks',
  'effects',
  'handlers',
  'guards',
  'returns',
];

const defaultHookGroups: HookGroups = {
  callbacks: ['React.useCallback'],
  context: ['React.use', 'useRouter', 'useParams', 'useSearchParams', 'useDeviceId', 'useAuthActions'],
  derived: ['React.useMemo'],
  effects: ['React.useEffect', 'React.useLayoutEffect'],
  reads: ['useQuery', 'useGroupBySlug', 'useGroupCategories'],
  refs: ['React.useRef', 'React.useId'],
  state: ['React.useState', 'React.useReducer'],
  writes: ['useMutation', 'useAction'],
};

export const getHookGroups = ({ context }: { context: Context }) => {
  const options = context.options[0] as Options | undefined;

  return Object.fromEntries(
    Object.entries(defaultHookGroups).map(([group, hooks]) => [group, [...hooks, ...(options?.hookGroups?.[group as GroupName] ?? [])]]),
  ) as HookGroups;
};

export const getOrderDiagnosticsEnabled = ({ context }: { context: Context }) => {
  const options = context.options[0] as Options | undefined;

  return options?.orderDiagnostics ?? true;
};

export const getIdentifierName = ({ node }: { node: ESTree.Node | null | undefined }) => {
  return node?.type === 'Identifier' ? node.name : null;
};

const getCalleeName = ({ callee }: { callee: ESTree.CallExpression['callee'] }): string | null => {
  if (callee.type === 'Identifier') {
    return callee.name;
  }

  if (callee.type === 'MemberExpression' && !callee.computed) {
    const objectName = getCalleeName({ callee: callee.object as ESTree.CallExpression['callee'] });
    const propertyName = getIdentifierName({ node: callee.property });

    return objectName !== null && propertyName !== null ? `${objectName}.${propertyName}` : null;
  }

  return null;
};

const getCallGroup = ({ expression, hookGroups }: { expression: ESTree.Expression | null; hookGroups: HookGroups }) => {
  if (expression?.type !== 'CallExpression') {
    return null;
  }

  const calleeName = getCalleeName({ callee: expression.callee });

  if (calleeName === null) {
    return null;
  }

  for (const group of groupOrder) {
    if (hookGroups[group]?.includes(calleeName)) {
      return group;
    }
  }

  return null;
};

const isFunctionLikeExpression = (expression: ESTree.Expression | null) => {
  return expression?.type === 'ArrowFunctionExpression' || expression?.type === 'FunctionExpression';
};

const hasReturnStatement = ({ statement }: { statement: ESTree.Statement }): boolean => {
  if (statement.type === 'ReturnStatement') {
    return true;
  }

  if (statement.type !== 'BlockStatement') {
    return false;
  }

  return statement.body.some(child => hasReturnStatement({ statement: child }));
};

const classifyStatement = ({ hookGroups, statement }: { hookGroups: HookGroups; statement: ESTree.Statement }): GroupName | null => {
  if (statement.type === 'VariableDeclaration') {
    const hookGroup = statement.declarations
      .map(declaration => getCallGroup({ expression: declaration.init, hookGroups }))
      .find(group => group !== null);

    if (hookGroup !== undefined) {
      return hookGroup;
    }

    if (statement.declarations.some(declaration => isFunctionLikeExpression(declaration.init))) {
      return 'handlers';
    }

    return 'derived';
  }

  if (statement.type === 'ExpressionStatement') {
    return getCallGroup({ expression: statement.expression, hookGroups });
  }

  if (statement.type === 'FunctionDeclaration') {
    return 'handlers';
  }

  if (
    statement.type === 'IfStatement' &&
    (hasReturnStatement({ statement: statement.consequent }) ||
      (statement.alternate !== null && hasReturnStatement({ statement: statement.alternate })))
  ) {
    return 'guards';
  }

  if (statement.type === 'ReturnStatement') {
    return 'returns';
  }

  return null;
};

export const classifyStatements = ({ hookGroups, statements }: { hookGroups: HookGroups; statements: Array<ESTree.Statement> }) => {
  return statements
    .map(statement => {
      const group = classifyStatement({ hookGroups, statement });

      return group === null
        ? null
        : {
            group,
            order: groupOrder.indexOf(group),
            statement,
          };
    })
    .filter(statement => statement !== null);
};
