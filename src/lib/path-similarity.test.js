import { describe, it, expect } from 'vitest';
import { canonicalTitle, compareTitles, titleSimilarity } from '../../base44/shared/path-similarity.js';
import { planPathDedupe } from '../../base44/shared/data-integrity.js';

describe('canonical career titles', () => {
  it('treats a qualifier as phrasing, not a different career', () => {
    expect(canonicalTitle('Healthcare-focused boutique investment banking'))
      .toBe(canonicalTitle('Healthcare boutique investment banking'));
  });

  it('expands short forms', () => {
    expect(canonicalTitle('Healthcare IB')).toBe(canonicalTitle('Healthcare investment banking'));
  });

  it('ignores word order, plurals and filler', () => {
    expect(canonicalTitle('Careers in Product Management'))
      .toBe(canonicalTitle('Product management role'));
  });
});

describe('comparing two titles', () => {
  it('calls the example pair the same career', () => {
    expect(compareTitles('Healthcare-focused boutique investment banking', 'Healthcare boutique investment banking').verdict)
      .toBe('same');
  });

  it('keeps genuinely different careers apart', () => {
    expect(compareTitles('Consulting', 'Educational Consulting for Creative Brands').verdict).toBe('different');
    expect(compareTitles('Nursing and Direct Clinical Care', 'Healthcare Administration').verdict).toBe('different');
    expect(compareTitles('Private Equity', 'Investment Banking').verdict).toBe('different');
    expect(titleSimilarity('Brand Communications and PR', 'Startup Founder')).toBeLessThan(0.6);
  });
});

describe('the dedupe plan', () => {
  const row = (id, path_name, created_date) => ({ id, path_name, created_date });

  it('merges the near-duplicate into the older row', () => {
    const plan = planPathDedupe([
      row('a', 'Healthcare boutique investment banking', '2026-01-01T10:00:00Z'),
      row('b', 'Healthcare-focused boutique investment banking', '2026-01-02T10:00:00Z'),
      row('c', 'Nursing and Direct Clinical Care', '2026-01-03T10:00:00Z'),
    ]);
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0].keep_id).toBe('a');
    expect(plan.merges[0].duplicate_id).toBe('b');
    expect(plan.review).toHaveLength(0);
  });

  it('reviews instead of merging when both rows carry work', () => {
    const counts = new Map([
      ['a', { experiments: 1, proof: 0, reflections: 0, updates: 0, cycles: 0 }],
      ['b', { experiments: 0, proof: 2, reflections: 0, updates: 0, cycles: 0 }],
    ]);
    const plan = planPathDedupe([
      row('a', 'Healthcare boutique investment banking', '2026-01-01T10:00:00Z'),
      row('b', 'Healthcare-focused boutique investment banking', '2026-01-02T10:00:00Z'),
    ], counts);
    expect(plan.merges).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
  });

  it('leaves an already merged row alone and never merges distinct paths', () => {
    const plan = planPathDedupe([
      row('a', 'Consulting', '2026-01-01T10:00:00Z'),
      row('b', 'Private Equity', '2026-01-01T10:00:00Z'),
      row('c', 'Law', '2026-01-01T10:00:00Z'),
      { ...row('d', 'Consulting', '2026-01-04T10:00:00Z'), integrity_status: 'merged' },
    ]);
    expect(plan.merges).toHaveLength(0);
    expect(plan.review).toHaveLength(0);
  });
});