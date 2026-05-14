import { defineRule, type Context, type ESTree } from '@oxlint/plugins';

import { functionReturnsJsx, isFunctionLikeExpression, isPascalCase } from './component-detection.ts';

type TopLevelNode = ESTree.Program['body'][number];

type ComponentRecord = {
  name: string;
  node: TopLevelNode;
  propsTypeName: string | null;
};

const oneComponentMessage = 'Expected one component per module.';
const propsTypeMessage = 'Expected the props type to be directly before this component.';
const helperBelowMessage = 'Expected helper functions to be defined outside this component module.';
const nextConventionModulePattern =
  /(?:^|\/)app\/(?:.*\/)?(?:apple-icon|error|global-error|icon|layout|loading|manifest|not-found|opengraph-image|page|robots|route|sitemap|template|twitter-image)\.(?:ts|tsx)$/;

const getIdentifierName = ({ node }: { node: ESTree.Node | null | undefined }) => {
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

const isNextConventionModule = ({ filename }: { filename: string }) => {
  return nextConventionModulePattern.test(filename.replaceAll('\\', '/'));
};

const unwrapDeclaration = ({ node }: { node: TopLevelNode }) => {
  return node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' ? node.declaration : node;
};

const getPropsTypeName = ({ context, node }: { context: Context; node: ESTree.ArrowFunctionExpression | ESTree.Function }) => {
  const [firstParam] = node.params;

  if (firstParam === undefined) {
    return null;
  }

  const source = context.sourceCode.text.slice(firstParam.range[0], firstParam.range[1]);
  const match = source.match(/:\s*([A-Za-z][A-Za-z0-9]*Props)\b/);

  return match?.[1] ?? null;
};

const getComponentFunctionExpression = (expression: ESTree.Expression | null): ESTree.ArrowFunctionExpression | ESTree.Function | null => {
  if (isFunctionLikeExpression(expression)) {
    return expression;
  }

  if (expression?.type !== 'CallExpression') {
    return null;
  }

  if (!['React.forwardRef', 'React.memo', 'forwardRef', 'memo'].includes(getCalleeName({ callee: expression.callee }) ?? '')) {
    return null;
  }

  const [firstArgument] = expression.arguments;

  if (firstArgument === undefined || firstArgument.type === 'SpreadElement') {
    return null;
  }

  return isFunctionLikeExpression(firstArgument) ? firstArgument : null;
};

const getComponentRecords = ({ context, node }: { context: Context; node: TopLevelNode }): Array<ComponentRecord> => {
  const declaration = unwrapDeclaration({ node });

  if (declaration?.type === 'FunctionDeclaration') {
    const name = getIdentifierName({ node: declaration.id });

    if (name === null) {
      return functionReturnsJsx({ node: declaration })
        ? [{ name: 'default', node, propsTypeName: getPropsTypeName({ context, node: declaration }) }]
        : [];
    }

    return isPascalCase({ name }) && functionReturnsJsx({ node: declaration })
      ? [{ name, node, propsTypeName: getPropsTypeName({ context, node: declaration }) }]
      : [];
  }

  if (declaration?.type !== 'VariableDeclaration') {
    return [];
  }

  return declaration.declarations
    .map(declarator => ({
      declarator,
      expression: getComponentFunctionExpression(declarator.init),
    }))
    .filter(({ declarator, expression }) => {
      return (
        isPascalCase({ name: getIdentifierName({ node: declarator.id }) }) &&
        expression !== null &&
        functionReturnsJsx({ node: expression })
      );
    })
    .map(component => ({
      name: getIdentifierName({ node: component.declarator.id }) as string,
      node,
      propsTypeName: getPropsTypeName({ context, node: component.expression as ESTree.ArrowFunctionExpression | ESTree.Function }),
    }));
};

const getLocalTypeName = ({ node }: { node: TopLevelNode }) => {
  const declaration = unwrapDeclaration({ node });

  return declaration?.type === 'TSInterfaceDeclaration' || declaration?.type === 'TSTypeAliasDeclaration'
    ? getIdentifierName({ node: declaration.id })
    : null;
};

const getFunctionLikeName = ({ node }: { node: TopLevelNode }) => {
  const declaration = unwrapDeclaration({ node });

  if (declaration?.type === 'FunctionDeclaration') {
    return getIdentifierName({ node: declaration.id });
  }

  if (declaration?.type !== 'VariableDeclaration') {
    return null;
  }

  const helper = declaration.declarations.find(declarator => isFunctionLikeExpression(declarator.init));

  return helper === undefined ? null : getIdentifierName({ node: helper.id });
};

const reportComponentCount = ({ components, context }: { components: Array<ComponentRecord>; context: Context }) => {
  for (const component of components.slice(1)) {
    context.report({
      message: oneComponentMessage,
      node: component.node,
    });
  }
};

const reportPropsTypePlacement = ({
  body,
  components,
  context,
}: {
  body: Array<TopLevelNode>;
  components: Array<ComponentRecord>;
  context: Context;
}) => {
  const localTypeNames = new Set(body.map(node => getLocalTypeName({ node })).filter(typeName => typeName !== null));

  for (const component of components) {
    if (component.propsTypeName === null || !localTypeNames.has(component.propsTypeName)) {
      continue;
    }

    const index = body.indexOf(component.node);
    const previousNode = body[index - 1];
    const previousTypeName = previousNode === undefined ? null : getLocalTypeName({ node: previousNode });

    if (previousTypeName === component.propsTypeName) {
      continue;
    }

    context.report({
      message: propsTypeMessage,
      node: component.node,
    });
  }
};

const reportHelpersBelowComponent = ({
  body,
  components,
  context,
}: {
  body: Array<TopLevelNode>;
  components: Array<ComponentRecord>;
  context: Context;
}) => {
  const firstComponent = components[0];

  if (firstComponent === undefined) {
    return;
  }

  const firstComponentIndex = body.indexOf(firstComponent.node);
  const componentNodes = new Set(components.map(component => component.node));

  for (const node of body.slice(firstComponentIndex + 1)) {
    const name = getFunctionLikeName({ node });

    if (name === null || componentNodes.has(node)) {
      continue;
    }

    context.report({
      message: helperBelowMessage,
      node,
    });
  }
};

export const componentModuleShapeRule = defineRule({
  createOnce(context) {
    return {
      Program(node) {
        if (isNextConventionModule({ filename: context.filename })) {
          return;
        }

        const body = node.body;
        const components = body.flatMap(topLevelNode => getComponentRecords({ context, node: topLevelNode }));

        reportComponentCount({ components, context });
        reportPropsTypePlacement({ body, components, context });
        reportHelpersBelowComponent({ body, components, context });
      },
    };
  },
  meta: {
    docs: {
      description: 'Report component module shape issues.',
    },
    messages: {
      helperBelowComponent: helperBelowMessage,
      multipleComponents: oneComponentMessage,
      propsTypePlacement: propsTypeMessage,
    },
    type: 'suggestion',
  },
});
