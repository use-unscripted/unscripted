import { describe, it, expect } from 'vitest';
import { orderedOptions } from '@/lib/scenarios/scenario-randomize';
import { scenarioContradictions } from '@/lib/scenarios/scenario-contradictions';
import { validateScenario } from '@/lib/scenarios/scenario-validation';
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { taskPerformance } from '@/lib/scenarios/scenario-performance';
import {
  ONBOARDING_SCENARIOS, ROLE_SCENARIOS, PERFORMANCE_QUESTIONS,
  scenariosForCareer, performanceForCareer, scenarioByKey, scenariosForDimension,
} from '@/lib/scenarios/scenario-library';

describe('the shipped library is publishable on its own rules', () => {
  it('passes validation for every workstyle scenario', () => {
    [...ONBOARDING_SCENARIOS, ...ROLE_SCENARIOS].forEach(s => {
      expect(validateScenario(s, s.options), s.scenario_key).toMatchObject({ publishable: true });
    });
  });

  it('records scoring on every performance question, and no option signals', () => {
    PERFORMANCE_QUESTIONS.forEach(q => {
      expect(validateScenario(q, q.options), q.scenario_key).toMatchObject({ publishable: true });
      expect(q.options).toHaveLength(0);
      expect(q.answer_explanation).toBeTruthy();
    });
  });

  it('gives onboarding five broad scenarios and no career of its own', () => {
    expect(ONBOARDING_SCENARIOS).toHaveLength(5);
    expect(ONBOARDING_SCENARIOS.every(s => s.context_type === 'onboarding' && !s.career_title)).toBe(true);
  });

  it('serves career-relevant scenarios, and falls back to the broad ones', () => {
    expect(scenariosForCareer('Healthcare Boutique Investment Banking')[0].scenario_key).toBe('role_discrepancy_before_deadline');
    expect(scenariosForCareer('Product Manager at a startup')[0].scenario_key).toBe('role_feature_prioritization');
    expect(performanceForCareer('Investment Banking Analyst').scenario_key).toBe('perf_enterprise_value');
    expect(scenariosForCareer('Marine Biology')[0].context_type).toBe('onboarding');
    expect(performanceForCareer('Marine Biology')).toBeNull();
  });

  it('finds a cheap scenario for an untested dimension', () => {
    const [s] = scenariosForDimension('ambiguity_tolerance', { careerName: 'Management Consultant', limit: 1 });
    expect(s.scenario_key).toBe('role_incomplete_client_information');
  });
});

describe('option order is randomised without moving the meaning', () => {
  const scenario = scenarioByKey('ob_incomplete_information');

  it('keeps every option and its mapping intact', () => {
    const shuffled = orderedOptions(scenario, 'user-a');
    expect(shuffled).toHaveLength(scenario.options.length);
    shuffled.forEach(o => {
      const original = scenario.options.find(x => x.id === o.id);
      expect(o.dimension_signal_mapping).toEqual(original.dimension_signal_mapping);
    });
  });

  it('gives the same student the same order twice, and never mutates the library', () => {
    const first = orderedOptions(scenario, 'user-a').map(o => o.id);
    expect(orderedOptions(scenario, 'user-a').map(o => o.id)).toEqual(first);
    expect(scenario.options.map(o => o.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not put the same tendency in the same slot for every student', () => {
    const orders = ['a', 'b', 'c', 'd', 'e', 'f'].map(k => orderedOptions(scenario, k).map(o => o.id).join('|'));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('leaves a scored question in its authored order', () => {
    const perf = { scenario_type: 'performance_objective', scenario_key: 'p', options: [{ id: '1' }, { id: '2' }, { id: '3' }] };
    expect(orderedOptions(perf, 'user-a').map(o => o.id)).toEqual(['1', '2', '3']);
  });
});

describe('workstyle and performance stay separate', () => {
  const workstyleRow = {
    scenario_id: 'role_discrepancy_before_deadline',
    dimension_signals_generated: [{ dimension: 'detail_orientation', dimension_label: 'Detail orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' }],
  };
  const performanceRow = {
    scenario_id: 'perf_enterprise_value',
    dimension_signals_generated: [],
    performance_result: { is_correct: true, score: 1, max_score: 1 },
  };

  it('keeps a scored answer out of dimension evidence', () => {
    const rows = scenarioEvidence([workstyleRow, performanceRow]);
    expect(rows).toHaveLength(1);
    expect(rows[0].dimension).toBe('detail_orientation');
  });

  it('keeps workstyle answers out of task performance', () => {
    const perf = taskPerformance([workstyleRow, performanceRow]);
    expect(perf.answered).toBe(1);
    expect(perf.accuracy).toBe(100);
    expect(perf.note).toContain('does not say whether a career fits');
  });
});

describe('a contradiction becomes a real experiment to run', () => {
  const profile = { self_reported_energizers: ['Working independently'] };
  const responses = [
    { scenario_id: 's1', dimension_signals_generated: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
    { scenario_id: 's2', dimension_signals_generated: [{ dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
  ];

  it('names the disagreement and refuses to resolve it', () => {
    const out = scenarioContradictions({ profile, responses, dimensions: [] });
    expect(out).toHaveLength(1);
    expect(out[0].dimension).toBe('independent_work');
    expect(out[0].detail).toContain('leaned toward');
    expect(out[0].resolution).toContain('do not know which');
  });

  it('stays quiet on a single answer', () => {
    expect(scenarioContradictions({ profile, responses: [responses[0]], dimensions: [] })).toEqual([]);
  });

  it('stays quiet once real work has settled the dimension', () => {
    const settled = scenarioContradictions({
      profile, responses,
      dimensions: [{ dimension: 'independent_work', current_evidence_level: 'strong' }],
    });
    expect(settled).toEqual([]);
  });

  it('flags scenario answers that disagree with each other', () => {
    const mixed = scenarioContradictions({
      profile: {},
      responses: [
        { scenario_id: 's1', dimension_signals_generated: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' }] },
        { scenario_id: 's2', dimension_signals_generated: [{ dimension: 'ambiguity_tolerance', signal_direction: 'draws_away', signal_strength: 'weak' }] },
      ],
      dimensions: [],
    });
    expect(mixed[0].title).toContain('point both ways');
  });
});