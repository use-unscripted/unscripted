import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * This call site shipped without either house rule. It took whatever model the
 * Base44 editor happened to be set to, and it asked for a summary addressed to
 * the student with no style attached, so the one piece of writing here that a
 * student actually reads was the one piece with nothing governing how it reads.
 *
 * The wrapped-reply case is the other half of pinning: the moment a model is
 * named in the source, someone can change it later, and the shape check has to
 * already be there when they do.
 */

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      ProofOfWork: { filter: vi.fn() },
      ExperimentMeasurement: { update: vi.fn() },
    },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

const { base44 } = await import('@/api/base44Client');
const { evaluateExperimentWork } = await import('./experiment-evaluation');

const InvokeLLM = base44.integrations.Core.InvokeLLM;

const experiment = {
  id: 'exp_1',
  title: 'Rebuild the intake form for a local clinic',
  objective: 'Find out whether the detail work of front end build is energising or draining',
  deliverable: 'A working form that handles bad input',
  evaluation_criteria: ['The form rejects a malformed email address', 'The layout holds on a phone'],
};

const measurementRow = { id: 'meas_1' };

/** Enough substance to be reviewable: the description clears the 40 character bar. */
const proof = [{
  title: 'Clinic intake form',
  description: 'Built it over two evenings, validated the email and phone fields, and had a friend fill it in on an old Android to check the layout.',
}];

const goodResponse = {
  reasoning_quality: 7,
  execution_quality: 6.5,
  overall_score: 7,
  summary: 'You handled bad input instead of assuming clean data. The phone layout is described rather than shown, so that part rests on your word.',
  demonstrated_strengths: ['input validation'],
  improvement_areas: ['show the work rather than describing it'],
};

beforeEach(() => {
  InvokeLLM.mockReset();
  base44.entities.ProofOfWork.filter.mockReset().mockResolvedValue(proof);
  base44.entities.ExperimentMeasurement.update.mockReset().mockResolvedValue({});
});

describe('the review a student reads', () => {
  it('pins the model as a literal rather than riding the editor default', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    await evaluateExperimentWork(experiment, measurementRow);

    expect(InvokeLLM).toHaveBeenCalledTimes(1);
    expect(InvokeLLM.mock.calls[0][0].model).toBe('gemini_3_1_pro');
  });

  it('appends the house style rules, because the summary is printed to the student', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    await evaluateExperimentWork(experiment, measurementRow);

    const { prompt } = InvokeLLM.mock.calls[0][0];
    expect(prompt).toMatch(/## How to write/);
    expect(prompt).toMatch(/Never use an em dash/);
  });

  it('asks for exactly what it asked for before the style was attached', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    await evaluateExperimentWork(experiment, measurementRow);

    // Our own instructions only. The rules appended after them talk about lists
    // and sentence length in the course of ruling on them.
    const ours = InvokeLLM.mock.calls[0][0].prompt.split('## How to write')[0];
    expect(ours).toMatch(/Do not comment on whether the career suits them/);
    expect(ours).toMatch(/summary: two sentences/);
    expect(ours).toContain(experiment.evaluation_criteria[0]);
    expect(ours).toContain(proof[0].description);
  });

  it('reads a wrapped reply, because the unwrap is applied to an awaited value', async () => {
    InvokeLLM.mockResolvedValue({ response: goodResponse });
    const payload = await evaluateExperimentWork(experiment, measurementRow);

    // Without the unwrap every score reads as undefined, the function returns
    // null, and the student is told there was nothing to review.
    expect(payload?.system_performance_score).toBe(7);
    expect(payload.system_evaluation_summary).toBe(goodResponse.summary);
    expect(base44.entities.ExperimentMeasurement.update).toHaveBeenCalledTimes(1);
  });

  it('still writes nothing when the model answers with no scores at all', async () => {
    InvokeLLM.mockResolvedValue({ summary: 'Nice work.' });
    const payload = await evaluateExperimentWork(experiment, measurementRow);

    expect(payload).toBeNull();
    expect(base44.entities.ExperimentMeasurement.update).not.toHaveBeenCalled();
  });
});
