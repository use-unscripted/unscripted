import { describe, it, expect } from 'vitest';
import { validateScenario, diffScenario } from '@/lib/scenarios/scenario-validation';
import { scorePerformanceResponse, hasValidatedScoring, taskPerformance } from '@/lib/scenarios/scenario-performance';

const workstyle = {
  id: 's1', title: 'Incomplete information', scenario_text: 'You must recommend today.',
  scenario_type: 'workstyle', source_type: 'professional_supplied', version: 1,
  dimensions_intended: ['analytical_depth', 'ambiguity_tolerance'],
  what_this_does_not_tell_us: 'It does not tell us how you work under a real deadline.',
};

const options = [
  { id: 'o1', option_text: 'Analyse what you have deeply before acting.', display_order: 1, dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
  { id: 'o2', option_text: 'Ask the two clarifying questions that matter most.', display_order: 2, dimension_signal_mapping: [{ dimension: 'research', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
  { id: 'o3', option_text: 'Form an approach and test the riskiest assumption.', display_order: 3, dimension_signal_mapping: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
  { id: 'o4', option_text: 'Bring the team together and split the problem.', display_order: 4, dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
];

describe('publishing a workstyle scenario', () => {
  it('publishes when it is grounded, mapped and honest about its limits', () => {
    expect(validateScenario(workstyle, options)).toMatchObject({ publishable: true, problems: [] });
  });

  it('refuses a correct answer or an answer key', () => {
    const withCorrect = validateScenario(workstyle, [{ ...options[0], is_correct: true }, ...options.slice(1)]);
    expect(withCorrect.publishable).toBe(false);
    expect(withCorrect.problems.join(' ')).toContain('must not mark an option correct');
    expect(validateScenario({ ...workstyle, answer_key_option_id: 'o1' }, options).problems.join(' ')).toContain('answer key');
  });

  it('refuses a strong claim from a single hypothetical option', () => {
    const strongClaim = [{ ...options[0], dimension_signal_mapping: [{ dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'strong' }] }, ...options.slice(1)];
    expect(validateScenario(workstyle, strongClaim).problems.join(' ')).toContain('only be weak or moderate');
  });

  it('refuses fewer than three options and a giveaway option', () => {
    expect(validateScenario(workstyle, options.slice(0, 2)).problems.join(' ')).toContain('three to five');
    const leading = [{ ...options[0], option_text: 'Give up and move on.' }, ...options.slice(1)];
    expect(validateScenario(workstyle, leading).problems.join(' ')).toContain('gives away');
    const named = [{ ...options[0], option_text: 'Do what a consultant would do here.' }, ...options.slice(1)];
    expect(validateScenario(workstyle, named).problems.join(' ')).toContain('gives away');
  });

  it('requires source grounding, intended dimensions and a limits note', () => {
    const bare = validateScenario({ ...workstyle, source_type: undefined, dimensions_intended: [], what_this_does_not_tell_us: '' }, options);
    expect(bare.publishable).toBe(false);
    expect(bare.problems).toHaveLength(3);
  });
});

describe('performance questions stay separate and validated', () => {
  const objective = {
    id: 'p1', title: 'Margin', scenario_text: 'Revenue 4m, COGS 3m. Gross margin?',
    scenario_type: 'performance_objective', source_type: 'industry_research', version: 1,
    dimensions_intended: ['quantitative_intensity'], what_this_does_not_tell_us: 'It does not tell us whether you enjoy this work.',
    accepted_answer_range: { low: 24.5, high: 25.5, unit: '%' }, answer_explanation: '1m of 4m is 25%.',
  };

  it('refuses to publish a performance question with no recorded scoring', () => {
    expect(validateScenario({ ...objective, accepted_answer_range: undefined, answer_explanation: undefined }, []).problems.join(' ')).toContain('needs its scoring recorded');
    expect(hasValidatedScoring(objective, [])).toBe(true);
  });

  it('scores an objective answer without producing any dimension signal', () => {
    const right = scorePerformanceResponse({ scenario: objective, numericAnswer: 25 });
    expect(right).toMatchObject({ is_correct: true, score: 1, max_score: 1 });
    expect(right).not.toHaveProperty('dimension_signals_generated');
    expect(scorePerformanceResponse({ scenario: objective, numericAnswer: 40 }).is_correct).toBe(false);
  });

  it('returns nothing when scoring was never validated', () => {
    expect(scorePerformanceResponse({ scenario: { ...objective, accepted_answer_range: undefined, answer_explanation: undefined }, numericAnswer: 25 })).toBeNull();
  });

  it('scores a rubric task against recorded levels', () => {
    const rubric = {
      scenario_type: 'performance_rubric', evaluation_version: 'rubric-v1',
      rubric_criteria: [
        { criterion: 'Assumptions stated', levels: [{ level: 'low', score: 1 }, { level: 'high', score: 3 }] },
        { criterion: 'Arithmetic', levels: [{ level: 'low', score: 1 }, { level: 'high', score: 3 }] },
      ],
    };
    const out = scorePerformanceResponse({ scenario: rubric, criterionScores: [{ criterion: 'Assumptions stated', score: 3 }, { criterion: 'Arithmetic', score: 2 }] });
    expect(out).toMatchObject({ score: 5, max_score: 6, evaluation_version: 'rubric-v1' });
  });

  it('reports task performance without mentioning fit', () => {
    const perf = taskPerformance([
      { performance_result: { is_correct: true, score: 1, max_score: 1 } },
      { performance_result: { is_correct: false, score: 0, max_score: 1 } },
    ]);
    expect(perf).toMatchObject({ answered: 2, accuracy: 50, score: 1, max_score: 2 });
    expect(perf.note).toContain('does not say whether a career fits');
  });
});

describe('versions are preserved, and a material edit makes a new one', () => {
  it('treats a rewritten option as material and reopens review', () => {
    const out = diffScenario({
      before: workstyle, after: workstyle,
      beforeOptions: options,
      afterOptions: [{ ...options[0], option_text: 'Wait for complete information before recommending.' }, ...options.slice(1)],
    });
    expect(out.material).toBe(true);
    expect(out.next_version).toBe(2);
    expect(out.validation_status_after).toBe('needs_rereview');
    expect(out.changes[0].label).toBe('Option text');
  });

  it('treats a remapped option and a changed scenario text as material', () => {
    const remapped = diffScenario({
      before: workstyle, after: workstyle, beforeOptions: options,
      afterOptions: [{ ...options[0], dimension_signal_mapping: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'weak' }] }, ...options.slice(1)],
    });
    expect(remapped.material).toBe(true);
    const rewritten = diffScenario({ before: workstyle, after: { ...workstyle, scenario_text: 'Different situation entirely.' }, beforeOptions: options, afterOptions: options });
    expect(rewritten.changes.some(c => c.field === 'scenario_text')).toBe(true);
  });

  it('leaves the version alone for a cosmetic edit', () => {
    const out = diffScenario({
      before: { ...workstyle, validation_status: 'published' },
      after: { ...workstyle, validation_status: 'published', title: 'Deciding without full information' },
      beforeOptions: options, afterOptions: options,
    });
    expect(out.material).toBe(false);
    expect(out.next_version).toBe(1);
    expect(out.validation_status_after).toBe('published');
  });
});