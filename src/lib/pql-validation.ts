import { parse, resolve, type Context } from '@/lib/pql';

/** Validation used by the query bar before applying a query. */
export function validatePql(source: string, context: Context) {
  const parsed = parse(source);
  return parsed.ok ? resolve(source, parsed.query, context) : parsed;
}
