import { describe, expect, it } from 'vitest';

import {
  readinessScore,
  sortPaths,
  UNSCORED_READINESS,
} from './path-sort-filter';

/**
 * Shaped like a PathRecommendations row. Only the fields the best_fit
 * comparator reads are set; created_date and id feed the stable tiebreaker,
 * so they are pinned to keep the ordering assertions deterministic.
 */
function path(overrides = {}) {
  return {
    id: 'a',
    path_name: 'Brand marketing at a mid-size consumer company',
    confidence_level: 'medium',
    risk_level: 'moderate',
    readiness_score: 7,
    created_date: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

const names = (paths) => sortPaths(paths, 'best_fit').map((p) => p.id);

describe('readinessScore', () => {
  it('returns the stored score on the real 0–10 scale', () => {
    expect(readinessScore(path({ readiness_score: 9 }))).toBe(9);
    expect(readinessScore(path({ readiness_score: 5 }))).toBe(5);
  });

  it('preserves a genuine zero rather than treating it as missing', () => {
    expect(readinessScore(path({ readiness_score: 0 }))).toBe(0);
  });

  it('falls back to the unscored sentinel when the score is absent or null', () => {
    expect(readinessScore(path({ readiness_score: undefined }))).toBe(UNSCORED_READINESS);
    expect(readinessScore(path({ readiness_score: null }))).toBe(UNSCORED_READINESS);
    expect(readinessScore({})).toBe(UNSCORED_READINESS);
  });

  it('ranks the unscored sentinel below every value the 0–10 scale allows', () => {
    for (let score = 0; score <= 20; score += 1) {
      expect(UNSCORED_READINESS).toBeLessThan(score / 2);
    }
  });

  // Live scores are not integers: production rows include fractional
  // half-scores and run as low as 0.6.
  it('passes fractional scores through untouched', () => {
    expect(readinessScore(path({ readiness_score: 7.5 }))).toBe(7.5);
    expect(readinessScore(path({ readiness_score: 0.6 }))).toBe(0.6);
  });
});

describe('sortPaths — best_fit', () => {
  it('orders by confidence descending before anything else', () => {
    const paths = [
      path({ id: 'low', confidence_level: 'low' }),
      path({ id: 'high', confidence_level: 'high' }),
      path({ id: 'medium', confidence_level: 'medium' }),
    ];
    expect(names(paths)).toEqual(['high', 'medium', 'low']);
  });

  it('breaks a confidence tie on risk ascending', () => {
    const paths = [
      path({ id: 'risky', risk_level: 'high' }),
      path({ id: 'safe', risk_level: 'low' }),
    ];
    expect(names(paths)).toEqual(['safe', 'risky']);
  });

  it('breaks a confidence and risk tie on readiness descending', () => {
    const paths = [
      path({ id: 'five', readiness_score: 5 }),
      path({ id: 'nine', readiness_score: 9 }),
      path({ id: 'seven', readiness_score: 7 }),
    ];
    expect(names(paths)).toEqual(['nine', 'seven', 'five']);
  });

  /**
   * The regression this file exists for. readinessScore defaulted to 50,
   * a 0–100 leftover, so an unscored path beat every scored path — 50 is
   * above the 0–10 maximum. It must sort last instead.
   */
  it('sorts an unscored path below every scored path', () => {
    const paths = [
      path({ id: 'unscored', readiness_score: undefined }),
      path({ id: 'five', readiness_score: 5 }),
      path({ id: 'nine', readiness_score: 9 }),
    ];
    expect(names(paths)).toEqual(['nine', 'five', 'unscored']);
  });

  it('sorts a null score below every scored path too', () => {
    const paths = [
      path({ id: 'null-score', readiness_score: null }),
      path({ id: 'lowest-real', readiness_score: 5 }),
    ];
    expect(names(paths)).toEqual(['lowest-real', 'null-score']);
  });

  it('orders fractional scores correctly and keeps the lowest real score above unscored', () => {
    const paths = [
      path({ id: 'unscored', readiness_score: undefined }),
      path({ id: 'lowest-live', readiness_score: 0.6 }),
      path({ id: 'half', readiness_score: 7.5 }),
      path({ id: 'seven', readiness_score: 7 }),
    ];
    expect(names(paths)).toEqual(['half', 'seven', 'lowest-live', 'unscored']);
  });

  it('ranks a path genuinely scored zero above one that was never scored', () => {
    const paths = [
      path({ id: 'unscored', readiness_score: undefined }),
      path({ id: 'zero', readiness_score: 0 }),
    ];
    expect(names(paths)).toEqual(['zero', 'unscored']);
  });

  it('still lets confidence outrank readiness, so an unscored path can lead', () => {
    const paths = [
      path({ id: 'confident-unscored', confidence_level: 'high', readiness_score: undefined }),
      path({ id: 'unsure-ready', confidence_level: 'low', readiness_score: 9 }),
    ];
    expect(names(paths)).toEqual(['confident-unscored', 'unsure-ready']);
  });

  it('does not mutate the array it was given', () => {
    const paths = [
      path({ id: 'five', readiness_score: 5 }),
      path({ id: 'nine', readiness_score: 9 }),
    ];
    const before = paths.map((p) => p.id);
    sortPaths(paths, 'best_fit');
    expect(paths.map((p) => p.id)).toEqual(before);
  });
});
