import { describe, it, expect } from 'vitest';
import {
  EXPERIMENT_TYPES, EFFORT_SCALE, smallestUsefulEffort, typeForUncertainty,
  dimensionsForUncertainty, missionCoverage, testBrief, stepUncertaintyLine,
  outreachBrief, campusRelevance, evidenceRequirementFallback, normalizeEffort,
} from '@/lib/experiment-types';

describe('experiment types', () => {
  it('supports all eight kinds of test', () => {
    expect(EXPERIMENT_TYPES).toHaveLength(8);
    expect(EXPERIMENT_TYPES.map(t => t.id)).toContain('human_reality');
    expect(EXPERIMENT_TYPES.map(t => t.id)).toContain('combined');
  });

  it('offers short efforts before long ones and never assumes 30 days', () => {
    expect(EFFORT_SCALE[0].id).toBe('15-30 minutes');
    expect(EFFORT_SCALE.at(-1).id).toBe('multi-week');
    expect(EFFORT_SCALE.every(e => e.hours <= 25)).toBe(true);
    expect(normalizeEffort('30 days')).toBeNull();
  });

  it('answers a lifestyle unknown by speaking to someone, not by a work sample', () => {
    expect(typeForUncertainty('lifestyle_tradeoff')).toBe('human_reality');
    expect(smallestUsefulEffort('human_reality')).toBe('1 hour');
    expect(typeForUncertainty('attention_to_detail')).toBe('work_sample');
  });
});

describe('uncertainty to decision dimensions', () => {
  it('connects an uncertainty to the dimensions it would move', () => {
    expect(dimensionsForUncertainty('attention_to_detail')).toContain('detail_orientation');
    expect(dimensionsForUncertainty('analytical_intensity')).toContain('analytical_depth');
    expect(dimensionsForUncertainty('')).toEqual([]);
  });
});

describe('testBrief', () => {
  const target = { id: 'attention_to_detail', label: 'Detail orientation', question: 'Do you enjoy analyzing a company in enough detail to want this type of work?' };

  it('identifies an uncertainty, its dimensions, and an effort', () => {
    const b = testBrief({ path: { path_name: 'Investment Banking' }, target });
    expect(b.uncertainty_id).toBe('attention_to_detail');
    expect(b.biggest_unknown).toMatch(/enough detail/);
    expect(b.framing).toBe('You are exploring Investment Banking.');
    expect(b.decision_dimension_ids.length).toBeGreaterThan(0);
    expect(b.what_you_learn).toContain('Detail orientation');
    expect(b.effort).toBe('2-3 hours');
    expect(b.why_it_matters).toMatch(/Investment Banking/);
  });

  it('says so when the evidence is unsettled rather than untested', () => {
    const b = testBrief({ path: { path_name: 'Consulting' }, target: { ...target, contradicted: true } });
    expect(b.why_it_matters).toMatch(/both ways/);
  });

  it('returns nothing when no uncertainty is open', () => {
    expect(testBrief({ path: { path_name: 'Consulting' }, target: null })).toBeNull();
  });
});

describe('missions create decision evidence', () => {
  it('recognises doing, observing, speaking and producing', () => {
    const c = missionCoverage([
      'Analyze the three-year revenue trend',
      'Attend the pitch event and notice your own reaction',
      'Ask an analyst about their actual week',
      'Write a one-page recommendation',
    ]);
    expect(c.covered).toEqual(['doing', 'observing', 'speaking', 'producing']);
    expect(c.ok).toBe(true);
  });

  it('flags a guide that only asks the student to read', () => {
    const c = missionCoverage(['Read three articles about the industry']);
    expect(c.missing).toContain('speaking');
    expect(c.missing).toContain('producing');
  });
});

describe('student-facing framing', () => {
  const experiment = {
    test_question: 'Would the lifestyle tradeoff be acceptable to you?',
    uncertainty_label: 'Entrepreneurial ambiguity',
  };

  it('ties a step to the uncertainty being tested', () => {
    expect(stepUncertaintyLine(experiment)).toMatch(/one question: Would the lifestyle/);
    expect(stepUncertaintyLine({})).toBeNull();
  });

  it('makes outreach specific to the unknown', () => {
    const o = outreachBrief(experiment);
    expect(o.instruction).toMatch(/actual week/);
    expect(o.purpose).toBe(experiment.test_question);
    expect(outreachBrief({})).toBeNull();
  });

  it('explains why a campus event is relevant', () => {
    expect(campusRelevance(experiment)).toMatch(/You are testing entrepreneurial ambiguity/);
    expect(campusRelevance({})).toBeNull();
  });

  it('always defines what evidence would update the hypothesis', () => {
    expect(evidenceRequirementFallback(experiment)).toMatch(/update our answer to/);
    expect(evidenceRequirementFallback({})).toMatch(/how the work felt/);
  });
});