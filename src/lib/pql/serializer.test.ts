import { describe, expect, it } from 'vitest';
import { parse } from './parser';
import { serialize } from './serializer';
import { execute } from './evaluator';
import { fixtureContext, fixtureIssues } from './fixtures';

describe('serialization at parser limits', () => {
  const roundTrip = (source: string) => {
    const original = parse(source);
    expect(original.ok).toBe(true);
    if (!original.ok) throw new Error(original.diagnostic.message);
    const serialized = serialize(original.query);
    expect(serialized.length).toBeLessThanOrEqual(4096);
    expect(parse(serialized).ok).toBe(true);
    expect(execute(serialized, fixtureIssues, fixtureContext)).toEqual(execute(source, fixtureIssues, fixtureContext));
  };
  it('keeps quoted values at 4096 UTF-16 units, including an optimal single quote', () => {
    const double = `text="${'a'.repeat(4089)}"`;
    const single = `text='${'"'.repeat(4089)}'`;
    expect(double.length).toBe(4096);
    expect(single.length).toBe(4096);
    roundTrip(double);
    roundTrip(single);
  });
  it('keeps a 500-token query within the token limit when ASC was omitted', () => {
    const source = `NOT ${Array(124).fill('priority=1').join(' OR ')} ORDER BY priority ASC`;
    const parsed = parse(source);
    expect(parsed.ok && parsed.tokens.length - 1).toBe(500);
    roundTrip(source);
  });
  it('preserves grouping and escaped quote and slash semantics', () => {
    roundTrip(`NOT(text~'"\\\\' OR status=done) AND priority IN(0,1,2) ORDER BY created DESC`);
  });
});
