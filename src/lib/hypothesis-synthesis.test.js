import { describe, it, expect } from 'vitest';
import { buildSynthesis, applyReview, confidenceLabel } from '@/lib/hypothesis-synthesis';
import { buildInitialSnapshot, buildUpdateRow, timelineFrom, decisionMeta, DECISIONS } from '@/lib/hypothesis-updates';

const change = {
  path: { id: 'p1', path_name: 'Boutique IB' },
  statusBefore: 'testing',
  statusAfter: 'strengthened',
  before: { career_fit_score: 60, fit_confidence_score: 30 },
  after: { career_fit_score: 66, fit_confidence_score: 70 },
  hypothesis: {
    supporting_evidence: [{ text: 'You produced 2 deliverables.', source: 'Proof of work' }],
    contradicting_evidence: [{ text: 'You reported low energy.', source: 'Post-experiment check-in' }],
    unresolved_questions: [{ question: 'Do you enjoy sustained modelling?' }],
  },
};
const dimensions = [
  { dimension: 'ambiguity_tolerance', dimension_label: 'Ambiguity tolerance', current_evidence_level: 'unknown' },
  { dimension: 'teamwork', dimension_label: 'Teamwork', current_evidence_level: 'conflicting' },
];

describe('confidenceLabel', () => {
  it('bands the score and never invents one', () => {
    expect(confidenceLabel(10)).toBe('Low');
    expect(confidenceLabel(50)).toBe('Moderate');
    expect(confidenceLabel(80)).toBe('High');
    expect(confidenceLabel(null)).toBe('Not yet rated');
  });
});

describe('buildSynthesis', () => {
  const s = buildSynthesis({ change, dimensions, nextBest: null });

  it('carries before and after separately', () => {
    expect(s.before.confidenceLabel).toBe('Low');
    expect(s.after.confidenceLabel).toBe('High');
    expect(s.before.statusLabel).toBe('Testing');
    expect(s.after.statusLabel).toBe('Strengthened');
  });

  it('only uses evidence that already exists', () => {
    expect(s.strengthened).toEqual([{ text: 'You produced 2 deliverables.', source: 'Proof of work' }]);
    expect(s.weakened[0].source).toBe('Post-experiment check-in');
  });

  it('lists remaining unknowns including untested and conflicting dimensions', () => {
    expect(s.unknowns).toContain('Do you enjoy sustained modelling?');
    expect(s.unknowns).toContain('Ambiguity tolerance has not been tested yet.');
    expect(s.unknowns).toContain('Teamwork still points both ways.');
  });

  it('returns null without a recalculation to read', () => {
    expect(buildSynthesis({ change: null })).toBeNull();
  });
});

describe('applyReview', () => {
  const s = buildSynthesis({ change, dimensions });

  it('drops the lines the student rejected', () => {
    const out = applyReview(s, { droppedStrengthened: [0], droppedUnknowns: [0] });
    expect(out.strengthened).toHaveLength(0);
    expect(out.unknowns).not.toContain('Do you enjoy sustained modelling?');
    expect(out.weakened).toHaveLength(1);
  });

  it('lets the student correct the confidence label and records that it was corrected', () => {
    const out = applyReview(s, { confidenceLabel: 'Moderate', note: 'I got lucky on the model.' });
    expect(out.after.confidenceLabel).toBe('Moderate');
    expect(out.confidence_label_source).toBe('student_corrected');
    expect(out.student_correction).toBe('I got lucky on the model.');
  });

  it('keeps the derived label when nothing is corrected', () => {
    expect(applyReview(s, {}).confidence_label_source).toBe('derived');
  });
});

describe('hypothesis update history', () => {
  it('maps each decision onto a cycle decision and a hypothesis status', () => {
    expect(DECISIONS).toHaveLength(3);
    expect(decisionMeta('continue_testing').hypothesis_status).toBe('testing');
    expect(decisionMeta('modify_hypothesis').cycle_decision).toBe('adjust');
    expect(decisionMeta('eliminate_hypothesis').hypothesis_status).toBe('eliminated');
  });

  it('snapshots the original hypothesis from the earliest recorded scores', () => {
    const snap = buildInitialSnapshot({
      path: { id: 'p1', path_name: 'Boutique IB', why_this_may_fit: 'Niche valuation work', fit_reason: 'Your stated goal', career_fit_score: 66, fit_confidence_score: 70, unresolved_questions: [{ question: 'Modelling?' }] },
      originalScores: { career_fit_score: 60, fit_confidence_score: 30 },
    });
    expect(snap.stage).toBe('initial');
    expect(snap.sequence).toBe(0);
    // The original, not the current, position.
    expect(snap.fit_after).toBe(60);
    expect(snap.confidence_after).toBe(30);
    expect(snap.hypothesis_statement).toBe('Niche valuation work');
  });

  it('appends updates without touching earlier ones', () => {
    const s = applyReview(buildSynthesis({ change, dimensions }), {});
    const first = buildUpdateRow({ synthesis: s, decision: 'continue_testing', reflection: { id: 'r1', clarity_score: 6 }, experiment: { id: 'e1', title: 'Experiment 1' }, sequence: 1 });
    const second = buildUpdateRow({ synthesis: s, decision: 'eliminate_hypothesis', reflection: { id: 'r2' }, experiment: { id: 'e2', title: 'Experiment 2' }, sequence: 2 });
    const t = timelineFrom([
      buildInitialSnapshot({ path: { id: 'p1', path_name: 'Boutique IB' } }),
      first,
      second,
    ]);
    expect(t.initial.stage).toBe('initial');
    expect(t.updates.map(u => u.experiment_title)).toEqual(['Experiment 1', 'Experiment 2']);
    // The earlier update keeps its own decision and its own before-state.
    expect(t.updates[0].decision).toBe('continue_testing');
    expect(t.updates[0].status_after).toBe('testing');
    expect(t.current.decision).toBe('eliminate_hypothesis');
    expect(t.current.status_after).toBe('eliminated');
    expect(t.updates[0].confidence_label_before).toBe('Low');
  });
});