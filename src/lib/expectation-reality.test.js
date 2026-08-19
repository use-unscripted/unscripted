/**
 * The comparison layer. Two properties matter most: a missing pre half never
 * becomes an invented baseline, and nothing here concludes anything about fit —
 * the "what changed" lines describe the student's own two answers and stop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  comparison, whatChanged, behavioralSnapshot, dimensionContributions, hasPost,
} from '@/lib/expectation-reality';
import {
  POST_FIELDS, PRE_TEXT_FIELDS, POST_TEXT_FIELDS,
  computeDeltas, savePreMeasurement, savePostMeasurement,
  loadDraft, saveDraft, clearDraft,
} from '@/lib/experiment-measurement';

const { me, filter, create, update } = vi.hoisted(() => ({
  me: vi.fn(), filter: vi.fn(), create: vi.fn(), update: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({
  base44: { auth: { me }, entities: { ExperimentMeasurement: { filter, create, update } } },
}));

const exp = { id: 'e1', title: 'Investment memo', uncertainty_label: 'Analytical depth' };

const FULL = {
  experiment_id: 'e1',
  expected_enjoyment: 8, actual_enjoyment: 5,
  expected_difficulty: 7, actual_difficulty: 6,
  expected_energy: 6, actual_energy: 4,
  pre_career_interest: 8, post_career_interest: 6,
  pre_career_fit_confidence: 7, post_career_fit_confidence: 5,
  expected_frustration: 4, frustration_level: 6,
  expected_repeat: 7, desire_to_repeat: 3,
  self_rated_performance: 7,
  pre_completed_at: '2026-08-01T00:00:00.000Z',
  post_completed_at: '2026-08-02T00:00:00.000Z',
};

// A historical experiment: measured at the end only, no baseline at all.
const LEGACY = {
  experiment_id: 'old',
  actual_enjoyment: 6, actual_difficulty: 5, desire_to_repeat: 7,
  post_completed_at: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  me.mockResolvedValue({ id: 'u1' });
  filter.mockResolvedValue([]);
  create.mockImplementation(async (p) => ({ id: 'm1', ...p }));
  update.mockResolvedValue({});
});

describe('comparison', () => {
  it('pairs every expectation with its outcome', () => {
    const c = comparison(FULL);
    expect(c.hasBaseline).toBe(true);
    expect(c.hasOutcome).toBe(true);
    expect(c.rows.map(r => [r.key, r.expected, r.actual, r.delta])).toEqual([
      ['enjoyment', 8, 5, -3],
      ['difficulty', 7, 6, -1],
      ['energy', 6, 4, -2],
      ['frustration', 4, 6, 2],
      ['repeat', 7, 3, -4],
      ['interest', 8, 6, -2],
      ['confidence', 7, 5, -2],
    ]);
    expect(c.rows.every(r => r.state === 'compared')).toBe(true);
  });

  it('keeps interest labelled before and after rather than expected and actual', () => {
    const interest = comparison(FULL).rows.find(r => r.key === 'interest');
    expect([interest.preLabel, interest.postLabel]).toEqual(['Before', 'After']);
  });

  it('renders a historical row as outcome only, with no invented baseline', () => {
    const c = comparison(LEGACY);
    expect(c.hasBaseline).toBe(false);
    expect(c.hasOutcome).toBe(true);
    c.rows.forEach(r => {
      expect(r.state).toBe('outcome_only');
      expect(r.expected).toBeNull();
      expect(r.delta).toBeNull();
    });
  });

  it('reports nothing at all for a row nobody answered on either side', () => {
    expect(comparison({ post_completed_at: 'x', actual_enjoyment: 5 }).rows.map(r => r.key)).toEqual(['enjoyment']);
  });

  it('survives an empty or missing row', () => {
    [null, undefined, {}].forEach(m => {
      const c = comparison(m);
      expect(c.rows).toEqual([]);
      expect(c.hasOutcome).toBe(false);
    });
    expect(hasPost(null)).toBe(false);
  });

  it('separates the outcome-only ratings from the compared ones', () => {
    expect(comparison(FULL).outcomes.map(r => r.key)).toEqual(['performance']);
  });
});

describe('whatChanged', () => {
  it('names the movement without claiming a cause', () => {
    const lines = whatChanged(FULL).join(' ');
    expect(lines).toContain('your interest in this path decreased after completing this work, despite expecting to enjoy it');
    expect(lines).toContain('enjoyed the work less than you expected');
    expect(lines).not.toMatch(/because|caused|proves|means you/i);
  });

  it('refuses to read difficulty as a poor fit', () => {
    const lines = whatChanged({ ...FULL, expected_difficulty: 4, actual_difficulty: 8 }).join(' ');
    expect(lines).toContain('harder than you expected');
    expect(lines).toContain('Difficulty on its own says nothing about whether this path fits you');
  });

  it('frames a confidence drop as one experiment, not a verdict', () => {
    expect(whatChanged(FULL).join(' ')).toContain('That is one experiment, not a conclusion');
  });

  it('says so plainly when nothing moved', () => {
    const flat = {
      post_completed_at: 'x',
      expected_enjoyment: 6, actual_enjoyment: 6,
      pre_career_interest: 5, post_career_interest: 5,
    };
    expect(whatChanged(flat)).toEqual(['Your answers after the work matched what you expected before it.']);
  });

  it('fabricates nothing when the post half was never collected', () => {
    expect(whatChanged({ expected_enjoyment: 8, pre_completed_at: 'x' })).toEqual([]);
  });

  it('says nothing about pairs a historical row cannot support', () => {
    expect(whatChanged(LEGACY)).toEqual(['Your answers after the work matched what you expected before it.']);
  });
});

describe('behavioralSnapshot', () => {
  const guide = {
    steps: [{}, {}, {}, {}],
    completed_steps: [1, 2, 3],
    progress_started_at: '2026-08-02T10:00:00.000Z',
    progress_completed_at: '2026-08-02T11:30:00.000Z',
  };

  it('counts what happened without interpreting it', () => {
    const b = behavioralSnapshot({
      exp,
      guide,
      proof: [{ experiment_id: 'e1' }, { experiment_id: 'e1' }, { experiment_id: 'other' }],
      contacts: [{ experiment_id: 'e1', response_status: 'completed' }],
      measurement: { desire_to_repeat: 3 },
    });
    expect(b).toEqual({
      missions_completed: 3,
      missions_total: 4,
      missions_skipped: 1,
      minutes_spent: 90,
      optional_work_completed: true,
      professional_conversation_completed: true,
      evidence_submitted: 2,
      desire_to_repeat: 3,
    });
  });

  it('reports null rather than zero for anything it does not have', () => {
    const b = behavioralSnapshot({ exp });
    expect(b.missions_completed).toBeNull();
    expect(b.minutes_spent).toBeNull();
    expect(b.professional_conversation_completed).toBeNull();
    expect(b.desire_to_repeat).toBeNull();
    expect(b.evidence_submitted).toBe(0);
  });

  it('does not call an unanswered outreach attempt a conversation', () => {
    const b = behavioralSnapshot({ exp, contacts: [{ experiment_id: 'e1', response_status: 'sent' }] });
    expect(b.professional_conversation_completed).toBe(false);
  });
});

describe('dimensionContributions', () => {
  it('offers work-preference evidence in hedged language and never eliminates', () => {
    const c = dimensionContributions(FULL, exp);
    expect(c.eliminates).toBe(false);
    expect(c.preferences.join(' ')).toMatch(/Evidence suggests/);
    expect(c.preferences.join(' ')).not.toMatch(/not a fit|rule out|wrong career/i);
  });

  it('lowers confidence only as a hint, based on one experiment', () => {
    const c = dimensionContributions({ ...FULL, career_confidence_delta: -2 }, exp);
    expect(c.confidence_hint).toMatch(/one experiment/);
  });

  it('leaves the confidence hint out when nothing moved', () => {
    expect(dimensionContributions({ ...FULL, career_confidence_delta: 0 }, exp).confidence_hint).toBeNull();
  });

  it('keeps a contradiction as an open unknown instead of a conclusion', () => {
    const c = dimensionContributions({ ...FULL, actual_enjoyment: 9, desire_to_repeat: 2 }, exp);
    expect(c.still_unknown.join(' ')).toMatch(/Worth one more test/);
  });

  it('contributes nothing at all without a post half', () => {
    expect(dimensionContributions({ expected_enjoyment: 5 }, exp)).toEqual({
      preferences: [], confidence_hint: null, still_unknown: [], eliminates: false,
    });
  });
});

describe('the written answers and the interest delta', () => {
  it('asks interest after the work as its own post rating', () => {
    expect(POST_FIELDS.map(f => f.key)).toContain('post_career_interest');
  });

  it('computes the interest delta alongside the others', () => {
    expect(computeDeltas(FULL, FULL).career_interest_delta).toBe(-2);
    expect(computeDeltas({}, FULL).career_interest_delta).toBeUndefined();
  });

  it('stores the three pre questions when answered and omits them when blank', async () => {
    await savePreMeasurement(exp, {
      expected_enjoyment: 8,
      biggest_expected_positive: ' Building the model ',
      biggest_concern: '',
      expectation_prediction: 'Whether I like detail work',
    });
    const payload = create.mock.calls[0][0];
    expect(payload.biggest_expected_positive).toBe('Building the model');
    expect(payload.expectation_prediction).toBe('Whether I like detail work');
    expect('biggest_concern' in payload).toBe(false);
    expect(PRE_TEXT_FIELDS.map(f => f.key)).toEqual([
      'biggest_expected_positive', 'biggest_concern', 'expectation_prediction',
    ]);
  });

  it('stores the four post questions and the behavioural counts beside the ratings', async () => {
    await savePostMeasurement(exp, { id: 'm1', expected_enjoyment: 8 }, {
      actual_enjoyment: 5,
      biggest_positive: 'The comparison table',
      biggest_negative: 'The reading',
      surprise_reflection: 'How long it took',
      assumption_that_changed: 'I thought I would enjoy the detail',
      behavioral_snapshot: { missions_completed: 3 },
    });
    expect(update).toHaveBeenCalledWith('m1', expect.objectContaining({
      biggest_positive: 'The comparison table',
      biggest_negative: 'The reading',
      assumption_that_changed: 'I thought I would enjoy the detail',
      behavioral_snapshot: { missions_completed: 3 },
      enjoyment_expectation_delta: -3,
    }));
    expect(POST_TEXT_FIELDS.map(f => f.key)).toEqual([
      'biggest_positive', 'biggest_negative', 'surprise_reflection', 'assumption_that_changed',
    ]);
  });
});

describe('drafts, so leaving and coming back keeps the answers', () => {
  it('round-trips answers per experiment and phase', () => {
    saveDraft('pre', 'e1', { expected_enjoyment: 7, biggest_concern: 'Boredom' });
    expect(loadDraft('pre', 'e1')).toEqual({ expected_enjoyment: 7, biggest_concern: 'Boredom' });
    // A different phase and a different experiment are separate drafts.
    expect(loadDraft('post', 'e1')).toEqual({});
    expect(loadDraft('pre', 'e2')).toEqual({});
  });

  it('clears once the row is written', () => {
    saveDraft('post', 'e1', { actual_enjoyment: 5 });
    clearDraft('post', 'e1');
    expect(loadDraft('post', 'e1')).toEqual({});
  });

  it('returns an empty draft rather than throwing on corrupt storage', () => {
    localStorage.setItem('unscripted_measure_draft_pre_e1', '{not json');
    expect(loadDraft('pre', 'e1')).toEqual({});
  });
});