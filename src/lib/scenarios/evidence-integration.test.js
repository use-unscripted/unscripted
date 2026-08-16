/**
 * The complete test student, at the level where the rules actually live.
 *
 * The narrative: says she prefers independent work, then repeatedly chooses
 * collaborative options in scenarios, gets a contradiction rather than a verdict,
 * runs a real collaborative experiment, enjoys it — and behaviour, not the
 * onboarding self-report, is what the reading ends up resting on.
 *
 * Then the reverse case: strong task performance, low experienced fit, and the
 * system must not conclude that doing it well means it suits her.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureEvidence,
  PATTERN_THRESHOLDS,
  EVIDENCE_SOURCE_TYPES,
  SCORING_VERSION,
  resolveLevel,
  thresholds,
} from '@/lib/scenarios/evidence-hierarchy';
import { scenarioLevelFor, scenarioEvidence, mergeWithDimensions } from '@/lib/scenarios/scenario-signals';
import { scenarioContradictions } from '@/lib/scenarios/scenario-contradictions';
import { dimensionSources, scenarioProvenance, performanceVsFit } from '@/lib/scenarios/dimension-sources';
import { scenarioPathEffect, MAX_SCENARIO_PATH_EFFECT } from '@/lib/scenarios/scenario-path-effect';
import { scenarioSignalsByVariable } from '@/lib/next-best-experiment';
import { buildRecordGraph } from '@/lib/evidence-graph';
import { scenarioAnalytics } from '../../../base44/shared/scenario-analytics.js';

const sig = (dimension, direction = 'draws_toward', strength = 'moderate') =>
  ({ dimension, dimension_label: dimension, signal_direction: direction, signal_strength: strength });

const answer = (id, signals, over = {}) => ({
  id,
  scenario_id: over.scenario_id || id,
  scenario_key: over.scenario_key || `key_${id}`,
  scenario_version: 1,
  selected_option_id: 'b',
  response_context: over.response_context || 'onboarding',
  scoring_version: SCORING_VERSION,
  completed_at: `2026-08-0${(Number(String(id).replace(/\D/g, '')) % 9) + 1}T10:00:00.000Z`,
  dimension_signals_generated: signals,
  ...over,
});

// Three collaborative answers across three different scenarios.
const collaborative = ['r1', 'r2', 'r3'].map(id => answer(id, [sig('teamwork')], { scenario_id: id }));
const profile = { self_reported_energizers: ['Working independently'] };

beforeEach(() => {
  configureEvidence({ config_version: SCORING_VERSION, pattern_thresholds: PATTERN_THRESHOLDS });
});

describe('evidence sources stay separate and configurable', () => {
  it('exposes the five source types', () => {
    expect(EVIDENCE_SOURCE_TYPES.map(s => s.id))
      .toEqual(['self_report', 'scenario', 'behavioural', 'performance', 'human']);
  });

  it('reads thresholds from configuration rather than from hard-coded numbers', () => {
    const three = [sig('teamwork'), sig('teamwork'), sig('teamwork')].map((s, i) => ({ ...s, scenario_id: `s${i}` }));
    expect(scenarioLevelFor(three)).toBe('stronger');
    configureEvidence({ pattern_thresholds: { some_responses: 4, stronger_responses: 9, stronger_distinct_scenarios: 9 } });
    expect(thresholds().some_responses).toBe(4);
    expect(scenarioLevelFor(three)).toBe('initial_signal');
  });

  it('shows all five sources for one dimension, with performance not applicable', () => {
    const breakdown = dimensionSources({
      dimension: {
        dimension: 'teamwork', dimension_label: 'Teamwork',
        current_evidence_level: 'unknown', confidence: 0,
        self_reported_preference: 'You said you prefer working on your own.',
      },
      responses: collaborative,
    });
    const byId = Object.fromEntries(breakdown.sources.map(s => [s.id, s]));
    expect(byId.self_report.applicable).toBe(true);
    expect(byId.scenario.state).toBe('Stronger Scenario Evidence');
    expect(byId.behavioural.state).toBe('Not tested yet');
    expect(byId.performance.state).toBe('Not applicable');
    expect(byId.human.state).toBe('None yet');
    // Hypothetical answers alone can never look settled.
    expect(breakdown.confidence).toBeLessThanOrEqual(35);
    expect(breakdown.scenario_heavy).toBe(true);
  });

  it('keeps full provenance for every scenario-derived reading', () => {
    const rows = scenarioProvenance({
      dimension: 'teamwork',
      responses: [answer('r9', [sig('teamwork')], { previous_option_id: 'a', response_context: 'experiment' })],
      scenarios: [{ id: 'r9', scenario_key: 'key_r9', title: 'A piece of work with three other people', options: [{ id: 'b', option_text: 'Work it through together.' }] }],
    });
    expect(rows[0]).toMatchObject({
      title: 'A piece of work with three other people',
      option_text: 'Work it through together.',
      direction: 'draws_toward',
      strength: 'moderate',
      context: 'experiment',
      revised: true,
      scenario_version: 1,
      response_id: 'r9',
      selected_option_id: 'b',
      scoring_version: SCORING_VERSION,
    });
    expect(rows[0].answered_at).toBeTruthy();
  });
});

describe('the contradiction becomes a real test, not a verdict', () => {
  it('names the disagreement between what she said and what she chose', () => {
    const out = scenarioContradictions({ profile, responses: collaborative, dimensions: [] });
    expect(out[0]).toMatchObject({ dimension: 'independent_work' });
    expect(out[0].resolution).toContain('do not know which');
  });

  it('raises the learning value of that unknown for the next-test engine', () => {
    const mixed = [answer('m1', [sig('teamwork')]), answer('m2', [sig('teamwork', 'draws_away', 'weak')])];
    const index = scenarioSignalsByVariable(mixed);
    expect(index.get('teamwork').scenario_level).toBe('conflicting');
  });

  it('flags scenario answers that disagree with what real work showed, and defers to the work', () => {
    const out = scenarioContradictions({
      profile: {},
      responses: [answer('c1', [sig('teamwork', 'draws_away')]), answer('c2', [sig('teamwork', 'draws_away')])],
      dimensions: [{ dimension: 'teamwork', current_evidence_level: 'weak', direction: 'draws_toward' }],
    });
    expect(out[0].behaviour_leads).toBe(true);
    expect(out[0].resolution).toContain('carry more weight');
  });
});

describe('after the real experiment, behaviour carries the reading', () => {
  const afterExperiment = [{
    dimension: 'teamwork', dimension_label: 'Teamwork',
    current_evidence_level: 'moderate', direction: 'draws_toward',
    behavioral_evidence_count: 2, confidence: 55,
    behavioral_evidence: [{ text: 'Rated highly after a group strategy experiment.' }],
    self_reported_preference: 'You said you prefer working on your own.',
  }];

  it('outweighs both the onboarding self-report and the scenario answers', () => {
    const merged = mergeWithDimensions(afterExperiment, collaborative);
    expect(merged[0].level_source).toBe('behaviour');
    expect(merged[0].resolved_evidence_level).toBe('moderate');
    // The scenario reading is still recorded, just not in charge.
    expect(merged[0].scenario_evidence.scenario_level).toBe('stronger');
    expect(merged[0].scenario_note).toBeTruthy();
  });

  it('stops repeating a contradiction real work has settled', () => {
    expect(scenarioContradictions({ profile, responses: collaborative, dimensions: afterExperiment })).toEqual([]);
  });

  it('keeps the historical responses intact', () => {
    expect(scenarioEvidence(collaborative)[0].response_count).toBe(3);
    expect(collaborative.every(r => r.scoring_version === SCORING_VERSION)).toBe(true);
  });
});

describe('path effects are small, bounded, and never a verdict', () => {
  const path = { id: 'p1', path_name: 'Product Management' };

  it('updates a path that turns on the dimension, and reports thin real evidence', () => {
    const effect = scenarioPathEffect({
      path, variables: ['teamwork', 'ambiguity_tolerance'], responses: collaborative, dimensions: [],
    });
    expect(effect.contributions.map(c => c.dimension)).toEqual(['teamwork']);
    expect(effect.effect).toBeLessThanOrEqual(MAX_SCENARIO_PATH_EFFECT);
    expect(effect.effect).toBeGreaterThan(0);
    expect(effect.scenario_heavy).toBe(true);
    expect(effect.behavioural_note).toContain('remains limited');
    expect(effect.caveat).toContain('cannot rule this path in or out');
  });

  it('leaves an unrelated path untouched', () => {
    expect(scenarioPathEffect({
      path: { id: 'p2', path_name: 'Marine Biology' },
      variables: ['quantitative_work', 'research'],
      responses: collaborative,
      dimensions: [],
    })).toBeNull();
  });

  it('contributes nothing once behaviour has settled the dimension', () => {
    const effect = scenarioPathEffect({
      path, variables: ['teamwork'], responses: collaborative,
      dimensions: [{ dimension: 'teamwork', current_evidence_level: 'strong', direction: 'draws_toward' }],
    });
    expect(effect.contributions[0].overridden_by_behaviour).toBe(true);
    expect(effect.effect).toBe(0);
  });

  it('lets one signal inform several paths without a duplicate response', () => {
    const consulting = scenarioPathEffect({ path: { id: 'p3', path_name: 'Consulting' }, variables: ['teamwork'], responses: collaborative, dimensions: [] });
    const product = scenarioPathEffect({ path, variables: ['teamwork'], responses: collaborative, dimensions: [] });
    expect(consulting.contributions[0].dimension).toBe('teamwork');
    expect(product.contributions[0].dimension).toBe('teamwork');
    expect(collaborative).toHaveLength(3);
  });
});

describe('performance is never read as fit', () => {
  it('separates strong performance from low enjoyment', () => {
    const out = performanceVsFit({ performanceScore: 90, experiencedFit: 30 });
    expect(out.performance_label).toBe('Strong');
    expect(out.fit_label).toBe('Low');
    expect(out.interpretation).toContain('reported low enjoyment');
    expect(out.caution).toBe('High performance does not mean high career fit.');
  });

  it('separates developing performance from high enjoyment', () => {
    expect(performanceVsFit({ performanceScore: 40, experiencedFit: 80 }).interpretation)
      .toContain('enjoyed this work even though');
  });
});

describe('the graph and the analytics', () => {
  it('adds scenario decisions as their own nodes on the spine', () => {
    const graph = buildRecordGraph({
      user: { full_name: 'Test student' },
      paths: [{ id: 'p1', path_name: 'Product Management' }],
      experiments: [{ id: 'e1', title: 'Group strategy sprint', path_name: 'Product Management' }],
      scenarioResponses: [answer('r1', [sig('teamwork')], { experiment_id: 'e1' })],
    });
    expect(graph.stats().byType.scenario_decision).toBe(1);
    expect(graph.edgesFrom('experiment:e1').some(e => e.type === 'answered_during')).toBe(true);
  });

  it('suppresses aggregate scenario analytics below the student threshold', () => {
    const out = scenarioAnalytics({ responses: collaborative.map(r => ({ ...r, created_by_id: 'u1' })), dimensionEvidence: [] });
    expect(out.suppressed).toBe(true);
  });

  it('reports counts and disagreement without claiming validity', () => {
    const responses = ['u1', 'u2', 'u3', 'u4', 'u5'].flatMap(u => [
      { ...answer(`${u}a`, [sig('teamwork')]), created_by_id: u },
      { ...answer(`${u}b`, [sig('teamwork')]), created_by_id: u },
    ]);
    const out = scenarioAnalytics({
      responses,
      dimensionEvidence: [{ created_by_id: 'u1', dimension: 'teamwork', current_evidence_level: 'strong', direction: 'draws_away' }],
    });
    expect(out.suppressed).toBe(false);
    expect(out.students).toBe(5);
    expect(out.self_consistency_rate).toBe(100);
    expect(out.scenario_vs_behaviour_disagreed).toBe(1);
    expect(out.scenario_vs_behaviour_untested).toBe(4);
    expect(out.note).toContain('No predictive validity is claimed');
  });
});

describe('the reconciliation rule itself', () => {
  it('caps scenario evidence at moderate and never lets it reach strong', () => {
    expect(resolveLevel({ behaviouralLevel: 'unknown', scenarioLevel: 'stronger' }).level).toBe('moderate');
  });
});