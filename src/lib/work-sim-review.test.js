import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The point of this file is the dead model. The simulation itself makes no
 * calls, so start to finish already works with the integration limit in force;
 * the only thing that can go missing is this review, and what has to be proved
 * is that going missing costs two criteria and nothing else. No lost run, no
 * invented pass, no three checks printed as five.
 */

vi.mock('@/api/base44Client', () => ({
  base44: { integrations: { Core: { InvokeLLM: vi.fn() } } },
}));

const logged = [];
vi.mock('@/lib/ai-failures', () => ({
  reportAiFailure: (feature, props) => { logged.push({ feature, ...props }); return Promise.resolve(null); },
}));

const { base44 } = await import('@/api/base44Client');
const { reviewSimulationWork, scoreSimulationRun, validateReview, MODEL_SCORED_CRITERIA, REVIEW_FEATURE } =
  await import('./work-sim-review');
const { buildWorkSimReadout } = await import('./work-sim-readout');
const { NORTHGATE_PM } = await import('./work-sims/northgate-pm');

const InvokeLLM = base44.integrations.Core.InvokeLLM;

/** A finished run, near enough to what the page writes. */
function completedRun(overrides = {}) {
  return {
    id: 'run_1',
    experiment_id: 'exp_1',
    simulation_key: NORTHGATE_PM.key,
    simulation_version: NORTHGATE_PM.version,
    status: 'completed',
    problem_statement: 'Duplicate jobs are landing on technician schedules and dispatchers are fixing them by hand.',
    selected_items: ['duplicate_jobs', 'save_error_copy', 'bulk_reschedule'],
    selected_items_final: ['duplicate_jobs', 'save_error_copy'],
    spec_v1: 'The problem\nDuplicates.\nWhat we are not doing\nRecurring jobs.',
    spec_v2: 'The problem\nDuplicate jobs reach technicians twice.\nWhat we are not doing\nRecurring jobs, and the Arizona date bug.',
    sales_reply: 'Recurring jobs is not in this sprint and I am not going to give you a date I cannot keep. Happy to join the Calder call and say that myself.',
    ...overrides,
  };
}

const goodResponse = {
  criteria: [
    {
      criterion: 'problem_not_feature',
      passed: true,
      detail: 'You wrote that duplicates land on technician schedules, which is something going wrong for a named group of people.',
    },
    {
      criterion: 'honest_reply',
      passed: true,
      detail: 'You told Mark it is not in the sprint and gave him no date, and you offered to say it on the call yourself.',
    },
  ],
};

beforeEach(() => {
  logged.length = 0;
  InvokeLLM.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the model answers', () => {
  it('returns the two rows in the shape check_results holds', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    const rows = await reviewSimulationWork(completedRun());

    expect(InvokeLLM).toHaveBeenCalledTimes(1);
    expect(rows.map(r => r.criterion)).toEqual(MODEL_SCORED_CRITERIA);
    expect(rows.every(r => r.scored_by === 'model')).toBe(true);
    expect(rows.every(r => typeof r.passed === 'boolean' && r.detail.length > 0)).toBe(true);
    expect(logged).toEqual([]);
  });

  it('pins the model as a literal and asks for the two criteria and nothing else', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    await reviewSimulationWork(completedRun());

    const args = InvokeLLM.mock.calls[0][0];
    expect(args.model).toBe('gemini_3_1_pro');
    expect(Object.keys(args.response_json_schema.properties)).toEqual(['criteria']);
    expect(Object.keys(args.response_json_schema.properties.criteria.items.properties))
      .toEqual(['criterion', 'passed', 'detail']);
    // Our own instructions only. The house style rules appended after them talk
    // about summaries in the course of banning them.
    const ours = args.prompt.split('## How to write')[0];
    expect(ours).not.toMatch(/summary|strengths|improvement area|out of ten/i);
  });

  it('appends the house style rules and tells the model to stay off the career', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    await reviewSimulationWork(completedRun());

    const { prompt } = InvokeLLM.mock.calls[0][0];
    expect(prompt).toMatch(/## How to write/);
    expect(prompt).toMatch(/Never use an em dash/);
    expect(prompt).toMatch(/Do not mention the career/);
    expect(prompt).toMatch(/never the person/);
  });

  it('puts the two pieces of writing being judged in the prompt, and no other student text', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    const run = completedRun();
    await reviewSimulationWork(run);

    const { prompt } = InvokeLLM.mock.calls[0][0];
    expect(prompt).toContain(run.problem_statement);
    expect(prompt).toContain(run.sales_reply);
    expect(prompt).not.toContain(run.spec_v2);
  });

  it('reads a wrapped reply, because the unwrap is applied to an awaited value', async () => {
    InvokeLLM.mockResolvedValue({ response: goodResponse });
    const rows = await reviewSimulationWork(completedRun());
    expect(rows.map(r => r.criterion)).toEqual(MODEL_SCORED_CRITERIA);
  });

  it('takes long dashes out of a sentence a student is about to read', async () => {
    InvokeLLM.mockResolvedValue({
      criteria: [
        { criterion: 'problem_not_feature', passed: true, detail: 'You named the duplicate rate — which is the problem.' },
        { criterion: 'honest_reply', passed: false, detail: 'You gave Mark a quarter – Q3 – that the sprint cannot support.' },
      ],
    });
    const rows = await reviewSimulationWork(completedRun());
    expect(rows.some(r => /[—–]/.test(r.detail))).toBe(false);
    expect(rows[1].detail).toContain('Q3');
  });

  it('accepts the criterion sentence in place of the id, since it is still an answer', async () => {
    const sentenceFor = (id) => NORTHGATE_PM.rubric.find(r => r.id === id).criterion;
    InvokeLLM.mockResolvedValue({
      criteria: [
        { criterion: sentenceFor('problem_not_feature'), passed: false, detail: 'You named a thing to build.' },
        { criterion: sentenceFor('honest_reply'), passed: true, detail: 'You said no and gave no date.' },
      ],
    });
    const rows = await reviewSimulationWork(completedRun());
    expect(rows.map(r => r.criterion)).toEqual(MODEL_SCORED_CRITERIA);
    expect(rows[0].passed).toBe(false);
  });
});

describe('the model is unavailable', () => {
  it('resolves to null rather than throwing, so a saved run cannot be lost', async () => {
    InvokeLLM.mockRejectedValue(new Error('integration limit reached'));
    await expect(reviewSimulationWork(completedRun())).resolves.toBeNull();
  });

  it('records the failure against a feature the log will actually accept', async () => {
    InvokeLLM.mockRejectedValue(new Error('integration limit reached'));
    await reviewSimulationWork(completedRun());

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      feature: REVIEW_FEATURE,
      stage: 'invoke_llm',
      model: 'gemini_3_1_pro',
      experiment_id: 'exp_1',
    });
  });

  it('does not retry a transport failure', async () => {
    InvokeLLM.mockRejectedValue(new Error('integration limit reached'));
    await reviewSimulationWork(completedRun());
    expect(InvokeLLM).toHaveBeenCalledTimes(1);
  });

  it('writes three checks, all stamped as counted, and never five', async () => {
    InvokeLLM.mockRejectedValue(new Error('integration limit reached'));
    const { check_results, model_scored } = await scoreSimulationRun(completedRun());

    expect(model_scored).toBe(false);
    expect(check_results).toHaveLength(3);
    expect(check_results.every(r => r.scored_by === 'checks')).toBe(true);
    expect(check_results.map(r => r.criterion)).toEqual([
      'plan_fits_capacity', 'non_goals_present', 'revision_changed_plan',
    ]);
  });

  it('leaves the read-out honest about the two it could not score', async () => {
    InvokeLLM.mockRejectedValue(new Error('integration limit reached'));
    const run = completedRun();
    const { check_results } = await scoreSimulationRun(run);

    const readout = buildWorkSimReadout({ ...run, check_results }, { expected_enjoyment: 7 });
    const checks = readout.blocks.checks;

    expect(checks.degraded).toBe(true);
    expect(checks.scored_count).toBe(3);
    expect(checks.total_count).toBe(5);
    expect(checks.model_notes).toEqual([]);
    expect(checks.not_scored.map(c => c.id)).toEqual(MODEL_SCORED_CRITERIA);
    expect(readout.blocks.predictions.rows.find(r => r.id === 'performance').actual).toBeNull();
  });

  it('writes all five when the model did answer', async () => {
    InvokeLLM.mockResolvedValue(goodResponse);
    const run = completedRun();
    const { check_results, model_scored } = await scoreSimulationRun(run);

    expect(model_scored).toBe(true);
    expect(check_results).toHaveLength(5);

    const readout = buildWorkSimReadout({ ...run, check_results }, {});
    expect(readout.blocks.checks.degraded).toBe(false);
    expect(readout.blocks.checks.model_notes.map(c => c.id)).toEqual(MODEL_SCORED_CRITERIA);
  });
});

describe('the model answers badly', () => {
  it('retries a malformed reply once with the reasons appended, then gives up', async () => {
    InvokeLLM.mockResolvedValue({ verdict: 'looks good to me' });
    const rows = await reviewSimulationWork(completedRun());

    expect(rows).toBeNull();
    expect(InvokeLLM).toHaveBeenCalledTimes(2);
    expect(InvokeLLM.mock.calls[0][0].prompt).not.toMatch(/previous attempt was rejected/);
    expect(InvokeLLM.mock.calls[1][0].prompt).toMatch(/previous attempt was rejected/);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ feature: REVIEW_FEATURE, stage: 'validate', attempts: 2, recovered: false });
    expect(logged[0].codes).toContain('review_criteria_not_a_list');
  });

  it('rejects a reply carrying the wrong number of criteria', async () => {
    InvokeLLM.mockResolvedValue({
      criteria: [
        ...goodResponse.criteria,
        { criterion: 'plan_fits_capacity', passed: true, detail: 'The sprint fits.' },
      ],
    });
    const rows = await reviewSimulationWork(completedRun());

    expect(rows).toBeNull();
    expect(logged[0].codes).toContain('review_wrong_criteria_count');
  });

  it('rejects a reply that scores one criterion and not the other', async () => {
    InvokeLLM.mockResolvedValue({ criteria: [goodResponse.criteria[0]] });
    expect(await reviewSimulationWork(completedRun())).toBeNull();
    expect(logged[0].codes).toContain('review_missing_criterion');
  });

  it('rejects a pass with nothing written under it', async () => {
    InvokeLLM.mockResolvedValue({
      criteria: [
        { criterion: 'problem_not_feature', passed: true, detail: '' },
        goodResponse.criteria[1],
      ],
    });
    expect(await reviewSimulationWork(completedRun())).toBeNull();
    expect(logged[0].codes).toContain('review_detail_missing');
  });

  it('rejects an essay where one or two sentences were asked for', async () => {
    InvokeLLM.mockResolvedValue({
      criteria: [
        { criterion: 'problem_not_feature', passed: true, detail: 'A word. '.repeat(80) },
        goodResponse.criteria[1],
      ],
    });
    expect(await reviewSimulationWork(completedRun())).toBeNull();
    expect(logged[0].codes).toContain('review_detail_too_long');
  });

  it('keeps the answer when the retry fixes it, and still records the first attempt', async () => {
    InvokeLLM
      .mockResolvedValueOnce({ criteria: [] })
      .mockResolvedValueOnce(goodResponse);

    const rows = await reviewSimulationWork(completedRun());

    expect(rows).toHaveLength(2);
    expect(InvokeLLM).toHaveBeenCalledTimes(2);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ feature: REVIEW_FEATURE, stage: 'validate', recovered: true });
  });
});

/**
 * The two `detail` sentences are the only student-facing strings in the slice
 * that nobody on this team wrote. The read-out enforces rule 4 on its own copy
 * and quotes student writing verbatim, so without this these sentences were the
 * one way "this shows real strategic instinct" reached a student's screen, with
 * only the prompt standing in the way.
 */
describe('a flattering sentence about the student', () => {
  const flattery = (detail) => ({
    criteria: [
      { criterion: 'problem_not_feature', passed: true, detail },
      goodResponse.criteria[1],
    ],
  });

  [
    'This shows real strategic instinct.',
    'You are a natural at seeing what matters here.',
    'The problem statement is thoughtful and shows a methodical mindset.',
    'Your problem statement is about 80% of the way there.',
  ].forEach(detail => {
    it(`never reaches the student: ${detail}`, async () => {
      InvokeLLM.mockResolvedValue(flattery(detail));
      const rows = await reviewSimulationWork(completedRun());

      expect(rows).toBeNull();
      expect(InvokeLLM).toHaveBeenCalledTimes(2);
      expect(logged[0].codes).toContain('review_detail_banned_language');
    });
  });

  it('tells the retry which words to drop, and takes the rewrite', async () => {
    InvokeLLM
      .mockResolvedValueOnce(flattery('This shows real strategic instinct.'))
      .mockResolvedValueOnce(goodResponse);

    const rows = await reviewSimulationWork(completedRun());

    expect(rows).toHaveLength(2);
    expect(InvokeLLM.mock.calls[1][0].prompt).toMatch(/strategic/);
    expect(InvokeLLM.mock.calls[1][0].prompt).toMatch(/instinct/);
  });

  it('leaves the run with three counted checks rather than a repaired sentence', async () => {
    InvokeLLM.mockResolvedValue(flattery('This shows real strategic instinct.'));
    const scored = await scoreSimulationRun(completedRun());

    expect(scored.model_scored).toBe(false);
    expect(scored.check_results).toHaveLength(3);
    expect(scored.check_results.every(r => r.scored_by === 'checks')).toBe(true);

    const readout = buildWorkSimReadout(
      { ...completedRun(), check_results: scored.check_results }, {},
    );
    expect(readout.blocks.checks.not_scored.map(x => x.id)).toEqual(MODEL_SCORED_CRITERIA);
  });

  it('is dropped by the read-out as well, for a row written before this guard existed', () => {
    const readout = buildWorkSimReadout({
      ...completedRun(),
      check_results: [{
        criterion: 'problem_not_feature',
        passed: true,
        detail: 'This shows real strategic instinct.',
        scored_by: 'model',
      }],
    }, {});

    const everything = JSON.stringify(readout);
    expect(everything).not.toContain('strategic instinct');
    expect(readout.blocks.checks.model_notes).toEqual([]);
    expect(readout.blocks.checks.not_scored.map(x => x.id)).toContain('problem_not_feature');
  });

  it('still takes a sentence about the writing rather than the person', () => {
    const r = validateReview({
      criteria: [
        { criterion: 'problem_not_feature', passed: true, detail: 'You named duplicates on technician schedules, which is what is going wrong and who it lands on.' },
        { criterion: 'honest_reply', passed: false, detail: 'You told Mark it slips to Q3, which is a date this sprint cannot support.' },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe('nothing to judge', () => {
  it('spends no call when the student wrote neither piece', async () => {
    const rows = await reviewSimulationWork(completedRun({ problem_statement: '', sales_reply: '' }));
    expect(rows).toBeNull();
    expect(InvokeLLM).not.toHaveBeenCalled();
    expect(logged).toEqual([]);
  });

  it('spends no call when only one of the two exists, because both are needed', async () => {
    await reviewSimulationWork(completedRun({ sales_reply: '   ' }));
    expect(InvokeLLM).not.toHaveBeenCalled();
  });
});

describe('validateReview on its own', () => {
  it('hands back reasons a model can act on', () => {
    const r = validateReview({ criteria: [{ criterion: 'made_up', passed: 'maybe', detail: '' }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/problem_not_feature/);
    expect(r.codes).toContain('review_wrong_criteria_count');
  });

  it('reads true and false written as words', () => {
    const r = validateReview({
      criteria: [
        { criterion: 'problem_not_feature', passed: 'true', detail: 'You named the duplicates.' },
        { criterion: 'honest_reply', passed: 'false', detail: 'You promised Q3.' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.data.map(x => x.passed)).toEqual([true, false]);
  });
});

describe('what the real model actually returned', () => {
  /**
   * Copied verbatim from one live call on 2026-08-14, gemini_3_1_pro, through
   * `base44 exec`, on the run built above. It came back bare rather than
   * wrapped, with both ids spelled as asked and both details inside the length
   * ceiling. Kept as a fixture so a later edit to the validator has to stay
   * compatible with an answer we know the model gives.
   */
  const live = {
    criteria: [
      {
        criterion: 'problem_not_feature',
        passed: true,
        detail: 'The problem statement clearly describes what is going wrong and who is dealing with the impact. Saying that dispatchers are deleting them by hand accurately frames the problem without proposing a solution.',
      },
      {
        criterion: 'honest_reply',
        passed: true,
        detail: 'The message plainly states that recurring jobs missed the sprint and refuses to promise an arbitrary date. Offering to have a real answer and join the call with Calder takes direct ownership of the news.',
      },
    ],
  };

  it('passes the validator untouched', () => {
    const r = validateReview(live);
    expect(r.ok).toBe(true);
    expect(r.data.map(x => x.criterion)).toEqual(MODEL_SCORED_CRITERIA);
    expect(r.data.every(x => x.detail.length <= 400)).toBe(true);
    expect(r.data.some(x => /[—–]/.test(x.detail))).toBe(false);
  });
});

describe('the feature is registered in both places', () => {
  // The bug this guards against already exists elsewhere in production: two
  // call sites pass a feature slug that is not in AI_FEATURES, so every failure
  // at those two sites is dropped on the guard and nobody sees it.
  it('is in AI_FEATURES, so its failures are not silently discarded', async () => {
    const real = await vi.importActual('./ai-failures');
    expect(real.AI_FEATURES).toContain(REVIEW_FEATURE);
  });

  it('is in the AiFailure entity enum, so the row is accepted', () => {
    const file = path.resolve(import.meta.dirname, '../../base44/entities/AiFailure.jsonc');
    const raw = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    expect(JSON.parse(raw).properties.feature.enum).toContain('work_sim_review');
  });
});
