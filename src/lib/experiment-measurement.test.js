/**
 * The pre half of the measurement row now has two shapes writing into it: the
 * Career Experiment check-in with its five questions, and the work simulation
 * with its four. They share one entity and one save function, so the tests here
 * are about the seam between them.
 *
 * Two properties matter. A caller only ever writes the fields it actually asked,
 * so an unasked field stays absent on the row instead of being stored as a zero
 * or a guess. And computeDeltas keeps leaving a delta out whenever its pre half
 * is missing, which is what stops a historical experiment getting an invented
 * baseline.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRE_FIELDS,
  SIM_PRE_FIELDS,
  ALL_PRE_FIELDS,
  computeDeltas,
  savePreMeasurement,
} from '@/lib/experiment-measurement';

const { me, filter, create, update } = vi.hoisted(() => ({
  me: vi.fn(),
  filter: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me },
    entities: { ExperimentMeasurement: { filter, create, update } },
  },
}));

const exp = { id: 'e1', title: 'Shadow a product manager' };

// What the two flows send. Neither one knows about the other's questions.
const CAREER_ANSWERS = {
  expected_enjoyment: 8,
  expected_difficulty: 4,
  pre_career_interest: 7,
  pre_career_fit_confidence: 6,
  expected_energy: 5,
};

const SIM_ANSWERS = {
  expected_enjoyment: 3,
  expected_energy: 4,
  expected_performance: 7,
  expected_want_more: 9,
};

beforeEach(() => {
  vi.clearAllMocks();
  me.mockResolvedValue({ id: 'u1' });
  filter.mockResolvedValue([]);
  create.mockImplementation(async (p) => ({ id: 'm1', ...p }));
  update.mockResolvedValue({});
});

describe('the pre field lists', () => {
  it('keeps the Career Experiment check-in at its original five', () => {
    expect(PRE_FIELDS.map(f => f.key)).toEqual([
      'expected_enjoyment',
      'expected_difficulty',
      'pre_career_interest',
      'pre_career_fit_confidence',
      'expected_energy',
    ]);
  });

  it('gives the simulation its four without touching the shared list', () => {
    expect(SIM_PRE_FIELDS.map(f => f.key)).toEqual([
      'expected_enjoyment',
      'expected_energy',
      'expected_performance',
      'expected_want_more',
    ]);
  });

  it('unions the two lists without repeating a key', () => {
    const keys = ALL_PRE_FIELDS.map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      'expected_enjoyment',
      'expected_difficulty',
      'pre_career_interest',
      'pre_career_fit_confidence',
      'expected_energy',
      'expected_performance',
      'expected_want_more',
    ]);
  });

  it('carries a label and both scale ends on every entry', () => {
    ALL_PRE_FIELDS.forEach(f => {
      expect(typeof f.label).toBe('string');
      expect(f.label.length).toBeGreaterThan(0);
      expect(typeof f.low).toBe('string');
      expect(typeof f.high).toBe('string');
    });
  });
});

describe('savePreMeasurement', () => {
  it('writes the Career Experiment five and leaves the simulation fields absent', async () => {
    await savePreMeasurement(exp, CAREER_ANSWERS);

    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject(CAREER_ANSWERS);
    expect('expected_performance' in payload).toBe(false);
    expect('expected_want_more' in payload).toBe(false);
    expect(payload.pre_completed_at).toEqual(expect.any(String));
  });

  it('writes the simulation four and leaves the unasked Career Experiment fields absent', async () => {
    await savePreMeasurement(exp, SIM_ANSWERS);

    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject(SIM_ANSWERS);
    expect('expected_difficulty' in payload).toBe(false);
    expect('pre_career_interest' in payload).toBe(false);
    expect('pre_career_fit_confidence' in payload).toBe(false);
  });

  it('stores a single answer and nothing around it, the way a Career Moment asks', async () => {
    await savePreMeasurement(exp, { expected_enjoyment: 6 });

    const payload = create.mock.calls[0][0];
    expect(payload.expected_enjoyment).toBe(6);
    ALL_PRE_FIELDS.filter(f => f.key !== 'expected_enjoyment').forEach(f => {
      expect(f.key in payload).toBe(false);
    });
  });

  it('ignores a value that is not a finite number rather than storing it', async () => {
    await savePreMeasurement(exp, {
      expected_enjoyment: 8,
      expected_performance: '7',
      expected_want_more: Number.NaN,
      expected_energy: null,
    });

    const payload = create.mock.calls[0][0];
    expect(payload.expected_enjoyment).toBe(8);
    expect('expected_performance' in payload).toBe(false);
    expect('expected_want_more' in payload).toBe(false);
    expect('expected_energy' in payload).toBe(false);
  });

  it('updates the row that already exists instead of adding a second one', async () => {
    filter.mockResolvedValue([{ id: 'existing', experiment_id: 'e1' }]);

    const row = await savePreMeasurement(exp, SIM_ANSWERS);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('existing', expect.objectContaining(SIM_ANSWERS));
    expect(row.id).toBe('existing');
  });
});

describe('computeDeltas', () => {
  const post = {
    actual_enjoyment: 6,
    actual_difficulty: 7,
    actual_energy: 2,
    post_career_fit_confidence: 4,
  };

  it('computes all four against a pre row holding the Career Experiment five', () => {
    expect(computeDeltas(CAREER_ANSWERS, post)).toEqual({
      enjoyment_expectation_delta: -2,
      difficulty_expectation_delta: 3,
      energy_expectation_delta: -3,
      career_confidence_delta: -2,
    });
  });

  it('computes only the pairs the simulation actually asked', () => {
    const d = computeDeltas(SIM_ANSWERS, post);

    expect(d.enjoyment_expectation_delta).toBe(3);
    expect(d.energy_expectation_delta).toBe(-2);
    // The simulation never asks expected difficulty or pre career fit, so those
    // two stay undefined and get stripped before the write.
    expect(d.difficulty_expectation_delta).toBeUndefined();
    expect(d.career_confidence_delta).toBeUndefined();
  });

  it('leaves every delta out when there is no pre half at all', () => {
    [undefined, null, {}].forEach(pre => {
      expect(computeDeltas(pre, post)).toEqual({
        enjoyment_expectation_delta: undefined,
        difficulty_expectation_delta: undefined,
        energy_expectation_delta: undefined,
        career_confidence_delta: undefined,
      });
    });
  });

  it('leaves a delta out when the post half is the missing one', () => {
    const d = computeDeltas(CAREER_ANSWERS, { actual_enjoyment: 6 });

    expect(d.enjoyment_expectation_delta).toBe(-2);
    expect(d.difficulty_expectation_delta).toBeUndefined();
    expect(d.energy_expectation_delta).toBeUndefined();
    expect(d.career_confidence_delta).toBeUndefined();
  });

  it('keeps a zero delta, which is a real answer and not a missing one', () => {
    const d = computeDeltas({ expected_enjoyment: 6 }, { actual_enjoyment: 6 });
    expect(d.enjoyment_expectation_delta).toBe(0);
  });
});
