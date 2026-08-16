import { describe, it, expect } from 'vitest';
import {
  signalsForOption,
  scenarioLevelFor,
  scenarioEvidence,
  mergeWithDimensions,
  buildResponse,
} from '@/lib/scenarios/scenario-signals';
import { resolveLevel, SCORING_VERSION } from '@/lib/scenarios/evidence-hierarchy';

const scenario = {
  id: 's1', scenario_key: 'incomplete_info', version: 2, scenario_type: 'workstyle',
  scenario_text: 'You have incomplete information but need to recommend today.',
};

const optA = {
  id: 'o1', option_text: 'Analyse what you have deeply before acting.',
  dimension_signal_mapping: [
    { dimension: 'analytical_depth', signal_direction: 'draws_toward', signal_strength: 'moderate' },
    { dimension: 'detail_orientation', signal_direction: 'draws_toward', signal_strength: 'moderate' },
  ],
};
const optC = {
  id: 'o3', option_text: 'Form an approach and test the riskiest assumption.',
  dimension_signal_mapping: [
    { dimension: 'ambiguity_tolerance', signal_direction: 'draws_toward', signal_strength: 'moderate' },
    { dimension: 'analytical_depth', signal_direction: 'draws_away', signal_strength: 'weak' },
  ],
};

const sig = (dimension, direction = 'draws_toward', strength = 'moderate', scenarioId = 's1') =>
  ({ dimension, signal_direction: direction, signal_strength: strength, scenario_id: scenarioId });

const response = (signals, over = {}) => ({
  scenario_id: over.scenario_id || 's1', scenario_version: 2, completed_at: '2026-08-01T10:00:00.000Z',
  dimension_signals_generated: signals, ...over,
});

describe('a workstyle option carries signals, never a correct answer', () => {
  it('maps an option onto known dimensions with labels', () => {
    const out = signalsForOption(optA, scenario);
    expect(out.map(s => s.dimension)).toEqual(['analytical_depth', 'detail_orientation']);
    expect(out[0].dimension_label).toBe('Analytical depth');
  });

  it('ignores unknown dimensions and clamps invented strengths to weak', () => {
    const out = signalsForOption({
      dimension_signal_mapping: [
        { dimension: 'not_a_dimension', signal_direction: 'draws_toward' },
        { dimension: 'teamwork', signal_direction: 'draws_toward', signal_strength: 'strong' },
      ],
    }, scenario);
    expect(out).toHaveLength(1);
    expect(out[0].signal_strength).toBe('weak');
  });

  it('records the version and scoring version answered against', () => {
    const row = buildResponse({ scenario, option: optA, context: { response_context: 'onboarding' } });
    expect(row.scenario_version).toBe(2);
    expect(row.scoring_version).toBe(SCORING_VERSION);
    expect(row.selected_option_id).toBe('o1');
    expect(row).not.toHaveProperty('is_correct');
  });

  it('produces no signals for a performance scenario', () => {
    expect(signalsForOption(optA, { ...scenario, scenario_type: 'performance_objective' })).toEqual([]);
  });
});

describe('one answer is only an Initial Signal', () => {
  it('caps a single response, whatever its strength', () => {
    expect(scenarioLevelFor([sig('analytical_depth')])).toBe('initial_signal');
    const ev = scenarioEvidence([response(signalsForOption(optA, scenario))]);
    expect(ev.find(e => e.dimension === 'analytical_depth').scenario_level).toBe('initial_signal');
    expect(ev.find(e => e.dimension === 'analytical_depth').scenario_level_label).toBe('Initial Signal');
  });

  it('raises to some, then stronger, as the pattern repeats', () => {
    // Thresholds are configuration (see PATTERN_THRESHOLDS): two answers is still
    // only an initial signal, three consistent ones read as some evidence.
    expect(scenarioLevelFor([sig('teamwork', 'draws_toward', 'moderate', 's1'), sig('teamwork', 'draws_toward', 'weak', 's2')])).toBe('initial_signal');
    expect(scenarioLevelFor([
      sig('teamwork', 'draws_toward', 'moderate', 's1'),
      sig('teamwork', 'draws_toward', 'moderate', 's2'),
      sig('teamwork', 'draws_toward', 'weak', 's3'),
    ])).toBe('stronger');
    expect(scenarioLevelFor(['s1', 's2', 's3', 's4'].map(id => sig('teamwork', 'draws_toward', 'weak', id)))).toBe('some');
  });

  it('never averages contradictory answers', () => {
    const level = scenarioLevelFor([
      sig('analytical_depth', 'draws_toward', 'moderate', 's1'),
      sig('analytical_depth', 'draws_away', 'weak', 's2'),
    ]);
    expect(level).toBe('conflicting');
    const ev = scenarioEvidence([
      response(signalsForOption(optA, scenario)),
      response(signalsForOption(optC, scenario), { scenario_id: 's2' }),
    ]);
    const depth = ev.find(e => e.dimension === 'analytical_depth');
    expect(depth.scenario_level_label).toBe('Conflicting Scenario Evidence');
    expect(depth.direction).toBe('unclear');
  });

  it('writes student-facing language as a signal, not a verdict', () => {
    const ev = scenarioEvidence([response([sig('teamwork')])]);
    expect(ev[0].statement).toContain('another signal about');
    expect(ev[0].statement).not.toMatch(/you are highly/i);
  });
});

describe('behaviour outweighs a hypothetical answer', () => {
  it('does not let scenario evidence displace moderate or strong behaviour', () => {
    expect(resolveLevel({ behaviouralLevel: 'strong', scenarioLevel: 'stronger' })).toMatchObject({ level: 'strong', source: 'behaviour' });
    expect(resolveLevel({ behaviouralLevel: 'moderate', scenarioLevel: 'stronger' })).toMatchObject({ level: 'moderate', source: 'behaviour' });
  });

  it('lets scenario evidence fill an untested dimension, capped at moderate', () => {
    expect(resolveLevel({ behaviouralLevel: 'unknown', scenarioLevel: 'initial_signal' })).toMatchObject({ level: 'weak', source: 'scenario' });
    expect(resolveLevel({ behaviouralLevel: 'unknown', scenarioLevel: 'stronger' })).toMatchObject({ level: 'moderate', source: 'scenario' });
  });

  it('merges without overwriting the behavioural record', () => {
    const dimensions = [
      { dimension: 'analytical_depth', current_evidence_level: 'strong', behavioral_evidence_count: 3 },
      { dimension: 'teamwork', current_evidence_level: 'unknown', behavioral_evidence_count: 0 },
    ];
    const merged = mergeWithDimensions(dimensions, [response([sig('analytical_depth'), sig('teamwork')])]);
    const depth = merged.find(d => d.dimension === 'analytical_depth');
    expect(depth.current_evidence_level).toBe('strong');
    expect(depth.resolved_evidence_level).toBe('strong');
    expect(depth.level_source).toBe('behaviour');
    expect(depth.scenario_note).toContain('signal');
    const team = merged.find(d => d.dimension === 'teamwork');
    expect(team.resolved_evidence_level).toBe('weak');
    expect(team.level_source).toBe('scenario');
  });
});