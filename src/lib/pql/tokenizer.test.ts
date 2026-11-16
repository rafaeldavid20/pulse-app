import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenizer';

describe('PQL tokenizer', () => {
  it('keeps identifiers, relative dates, strings and operators distinct', () => {
    const result = tokenize('epic = TES-122 AND updated > -7d AND text ~ "a\\"b"');
    expect(result.ok && result.tokens.map(t => [t.kind, t.value])).toEqual([
      ['word', 'epic'], ['operator', '='], ['word', 'TES-122'], ['word', 'AND'],
      ['word', 'updated'], ['operator', '>'], ['word', '-7d'], ['word', 'AND'],
      ['word', 'text'], ['operator', '~'], ['string', 'a"b'], ['eof', ''],
    ]);
  });
  it('reports positions and enforces limits', () => {
    expect(tokenize('x = 1\nAND "oops')).toMatchObject({ ok: false, diagnostic: { code: 'UNCLOSED_STRING', start: 10, line: 2, column: 5 } });
    expect(tokenize('a'.repeat(4097))).toMatchObject({ ok: false, diagnostic: { code: 'TEXT_LIMIT' } });
    expect(tokenize(Array(501).fill('x').join(' '))).toMatchObject({ ok: false, diagnostic: { code: 'TOKEN_LIMIT' } });
  });
});
