import { describe, expect, it } from 'vitest';
import { diffExperimentVersions, revisionPlan, similarity } from '@/lib/experiment-revision';

const base = {
  core_task: 'Build a simple three statement model for a medical device manufacturer.',
  test_question: 'Do I enjoy sustained quantitative work under a deadline?',
  decision_dimension_ids: ['quantitative_intensity', 'analytical_depth'],
  evidence_required: ['The completed spreadsheet', 'A short written summary'],
  instructions: ['Read the brief', 'Build the model', 'Write the summary'],
  outreach_required: false,
  difficulty_level: 'moderate',
  estimated_minutes_low: 45,
  estimated_minutes_high: 90,
  role_blueprint_id: 'bp_1',
  role_blueprint_version: 1,
  realistic_scenario: 'You are the analyst on a live deal and the model is due tomorrow.',
  evaluation_criteria: ['Assumptions stated', 'Arithmetic correct'],
};

const v = (patch) => ({ ...base, ...patch });

describe('material change detection', () => {
  it('treats a typo correction as minor', () => {
    const d = diffExperimentVersions(base, v({
      core_task: 'Build a simple three statement model for a medical device manufaturer.',
    }));
    expect(d.material).toBe(false);
    expect(d.changes[0].kind).toBe('minor');
  });

  it('treats formatting and punctuation as minor', () => {
    const d = diffExperimentVersions(base, v({
      core_task: '  Build a simple, three-statement model for a medical device manufacturer!  ',
    }));
    expect(d.material).toBe(false);
  });

  it('treats a non-substantive wording cleanup as minor', () => {
    const d = diffExperimentVersions(base, v({
      test_question: 'Do I enjoy sustained quantitative work under deadline?',
    }));
    expect(d.material).toBe(false);
  });

  it('flags a rewritten core task as material', () => {
    const d = diffExperimentVersions(base, v({
      core_task: 'Interview two practising bankers about how they spend a working day, then write up what surprised you.',
    }));
    expect(d.material).toBe(true);
    expect(d.material_changes.map(c => c.label)).toContain('Core task');
  });

  it('flags a change to the decision dimensions as material', () => {
    const d = diffExperimentVersions(base, v({ decision_dimension_ids: ['quantitative_intensity', 'client_interaction'] }));
    expect(d.material).toBe(true);
    expect(d.summary).toMatch(/Career dimensions tested/);
  });

  it('ignores a reordering of an unordered list but not of the mission sequence', () => {
    expect(diffExperimentVersions(base, v({ decision_dimension_ids: ['analytical_depth', 'quantitative_intensity'] })).material).toBe(false);
    expect(diffExperimentVersions(base, v({ instructions: ['Build the model', 'Read the brief', 'Write the summary'] })).material).toBe(true);
  });

  it('flags evidence, outreach, difficulty, time, blueprint and rubric changes', () => {
    const cases = [
      { evidence_required: ['The completed spreadsheet'] },
      { outreach_required: true },
      { difficulty_level: 'challenging' },
      { estimated_minutes_high: 180 },
      { role_blueprint_id: 'bp_2' },
      { evaluation_criteria: ['Assumptions stated', 'Arithmetic correct', 'Sensitivity table included'] },
    ];
    cases.forEach(patch => expect(diffExperimentVersions(base, v(patch)).material).toBe(true));
  });

  it('does not invalidate for presentation-only fields', () => {
    const d = diffExperimentVersions({ ...base, title: 'Old title' }, v({ title: 'A clearer title' }));
    expect(d.material).toBe(false);
    expect(d.changes.some(c => c.label === 'Presentation')).toBe(true);
  });

  it('reports no change when nothing moved', () => {
    expect(diffExperimentVersions(base, v({})).changes).toHaveLength(0);
  });
});

describe('revision plan', () => {
  const validation = { experiment_version: 3, validation_status: 'published' };

  it('keeps the version and the reviews on a minor edit', () => {
    const plan = revisionPlan({ validation, diff: diffExperimentVersions(base, v({ core_task: base.core_task + '.' })) });
    expect(plan).toMatchObject({ material: false, next_version: 3, supersede_reviews: false, validation_status: 'published' });
  });

  it('bumps the version and re-opens review on a material edit', () => {
    const diff = diffExperimentVersions(base, v({ core_task: 'Shadow a nurse for an afternoon and record what you saw.' }));
    const plan = revisionPlan({ validation, diff });
    expect(plan).toMatchObject({ material: true, next_version: 4, supersede_reviews: true, validation_status: 'needs_rereview' });
  });
});

describe('similarity', () => {
  it('is 1 for text that differs only in formatting', () => {
    expect(similarity('Build   the MODEL.', 'build the model')).toBe(1);
  });
  it('is high for a typo and low for a rewrite', () => {
    expect(similarity('build the model', 'build the modle')).toBeGreaterThan(0.85);
    expect(similarity('build the model', 'interview a practising nurse')).toBeLessThan(0.5);
  });
});