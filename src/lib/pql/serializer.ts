import type { Expression, Query, Value } from './parser';

function serializeValue(value: Value): string {
  if (value.kind === 'function') return `${value.value}()`;
  if (!value.quoted && /^[^\s(),=!<>~"']+$/.test(value.value)) return value.value;
  return `"${value.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function precedence(expression: Expression): number {
  if (expression.kind === 'or') return 1;
  if (expression.kind === 'and') return 2;
  if (expression.kind === 'not') return 3;
  return 4;
}
function serializeExpression(expression: Expression, parentPrecedence = 0): string {
  const ownPrecedence = precedence(expression);
  let result: string;
  if (expression.kind === 'and' || expression.kind === 'or') result = `${serializeExpression(expression.left, ownPrecedence)} ${expression.kind.toUpperCase()} ${serializeExpression(expression.right, ownPrecedence)}`;
  else if (expression.kind === 'not') result = `NOT ${serializeExpression(expression.expression, ownPrecedence)}`;
  else {
  const operator = expression.operator.toUpperCase();
  if (expression.operator.startsWith('is ')) result = `${expression.field} ${operator}`;
  else if (expression.operator === 'in' || expression.operator === 'not in') result = `${expression.field} ${operator} (${expression.values.map(serializeValue).join(', ')})`;
  else result = `${expression.field} ${operator} ${serializeValue(expression.values[0])}`;
  }
  return ownPrecedence < parentPrecedence ? `(${result})` : result;
}
export function serialize(query: Query): string {
  const expression = query.expression ? serializeExpression(query.expression) : '';
  const ordering = query.orderBy.length ? `ORDER BY ${query.orderBy.map(o => `${o.field} ${o.direction.toUpperCase()}`).join(', ')}` : '';
  return [expression, ordering].filter(Boolean).join(' ');
}
