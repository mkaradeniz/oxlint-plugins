import type { ESTree } from '@oxlint/plugins';

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

const transparentExpressionTypes = new Set([
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

export const unwrapExpression = (node: ESTree.Node): ESTree.Node => {
  let current = node;

  while (transparentExpressionTypes.has(current.type)) {
    current = (current as { expression: ESTree.Node }).expression;
  }

  return current;
};

export const isFunctionNode = (node: ESTree.Node): node is FunctionNode =>
  node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration';

export const getMemberChain = (node: ESTree.Node): Array<string> | null => {
  const current = unwrapExpression(node);

  if (current.type === 'Identifier') {
    return [current.name];
  }

  if (current.type !== 'MemberExpression') {
    return null;
  }

  const objectChain = getMemberChain(current.object);

  if (objectChain === null) {
    return null;
  }

  if (!current.computed && current.property.type === 'Identifier') {
    return [...objectChain, current.property.name];
  }

  if (current.computed && current.property.type === 'Literal' && typeof current.property.value === 'string') {
    return [...objectChain, current.property.value];
  }

  return null;
};

export const getCallChain = (node: ESTree.CallExpression): Array<string> | null => getMemberChain(node.callee);

export const chainEndsWith = (chain: Array<string> | null, suffix: Array<string>) => {
  if (chain === null || chain.length < suffix.length) {
    return false;
  }

  return suffix.every((part, index) => chain[chain.length - suffix.length + index] === part);
};

export const getPropertyName = (property: ESTree.ObjectPropertyKind): string | null => {
  if (property.type !== 'Property') {
    return null;
  }

  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name;
  }

  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }

  return null;
};

export const findProperties = (node: ESTree.Node, names: ReadonlySet<string>): Array<ESTree.ObjectProperty> => {
  const current = unwrapExpression(node);

  if (current.type !== 'ObjectExpression') {
    return [];
  }

  return current.properties.filter(
    (property): property is ESTree.ObjectProperty => property.type === 'Property' && names.has(getPropertyName(property) ?? ''),
  );
};

export const isStringLike = (node: ESTree.Node) => {
  const current = unwrapExpression(node);

  return (current.type === 'Literal' && typeof current.value === 'string') || current.type === 'TemplateLiteral';
};
