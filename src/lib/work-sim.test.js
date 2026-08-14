/**
 * The order of the last two writes at the end of a run.
 *
 * Everything in this file exists for one sentence in the plan: the student's
 * work is durable before any model call is made. That is invisible in a diff,
 * it is the kind of thing a later refactor quietly inverts by moving one line,
 * and inverting it means a timeout or a closed tab costs somebody thirty
 * minutes of writing. So the ordering is pinned here against the call log
 * rather than described in a comment.
 *
 * The rest is what happens when the model does not answer: three checks kept,
 * nothing invented, `system_evaluated_at` absent so a backfill knows there is
 * work left, and no second call bought on a reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';

/**
 * Every call that writes or asks, in the order it happened. The whole point of
 * this file is an assertion about two indexes in here.
 */
const calls = [];
const log = (name, impl) => vi.fn((...args) => {
  calls.push({ name, args });
  return impl?.(...args);
});

const { me, runList, runCreate, runUpdate, measFilter, measList, measCreate, measUpdate,
  expCreate, proofCreate, signalCreate, invoke } = vi.hoisted(() => ({
  me: vi.fn(), runList: vi.fn(), runCreate: vi.fn(), runUpdate: vi.fn(),
  measFilter: vi.fn(), measList: vi.fn(), measCreate: vi.fn(), measUpdate: vi.fn(),
  expCreate: vi.fn(), proofCreate: vi.fn(), signalCreate: vi.fn(), invoke: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me },
    entities: {
      WorkSimulationRun: { list: runList, create: runCreate, update: runUpdate },
      ExperimentMeasurement: { filter: measFilter, list: measList, create: measCreate, update: measUpdate },
      Experiments: { create: expCreate },
      ProofOfWork: { create: proofCreate },
      BehavioralSignal: { create: signalCreate },
    },
    integrations: { Core: { InvokeLLM: invoke } },
  },
}));

vi.mock('@/lib/career-cycle', () => ({ cycleLinks: vi.fn().mockResolvedValue({ user_id: 'user_1' }) }));
vi.mock('@/lib/pilot-metrics', () => ({ trackPilotEvent: vi.fn(), PILOT_EVENTS: [] }));
vi.mock('@/lib/ai-failures', () => ({ reportAiFailure: vi.fn().mockResolvedValue(null) }));

const { completeRun, reviewCompletedRun, saveStep, recordSample, abandonRun, REVIEW_WAIT_MS } =
  await import('@/lib/work-sim');

/** A run with enough in it that all five criteria have something to judge. */
const savedRun = (overrides = {}) => ({
  id: 'run_1',
  status: 'in_progress',
  current_step: 5,
  simulation_key: NORTHGATE_PM.key,
  simulation_version: NORTHGATE_PM.version,
  problem_statement: 'Duplicate jobs land on technician schedules and dispatchers clean them up by hand.',
  selected_items: ['duplicate_jobs', 'save_error_copy', 'bulk_reschedule'],
  selected_items_final: ['duplicate_jobs'],
  spec_v1: 'The problem\nDuplicates.\n\nWhat we are not doing\nRecurring jobs.',
  spec_v2: 'The problem\nDuplicate jobs reach technicians twice.\n\nWhat we are not doing\nRecurring jobs, and the date bug.',
  engineer_reply: 'Tell Mark the date moved and I will call him myself.',
  sales_reply: 'Recurring jobs is not in this sprint and I will not give you a date I cannot keep.',
  step_seconds: [{ step: 1, seconds: 90 }],
  ...overrides,
});

const goodAnswer = {
  criteria: [
    { criterion: 'problem_not_feature', passed: true, detail: 'You named what is going wrong and who it lands on.' },
    { criterion: 'honest_reply', passed: false, detail: 'You told Mark it is not happening and gave him no date.' },
  ],
};

/** The payloads written to the run row, in order. */
const runPatches = () => runUpdate.mock.calls.map(([, patch]) => patch);

/** Where in the call log a thing happened, by name and by a test on its args. */
const indexOf = (name, match = () => true) => calls.findIndex(c => c.name === name && match(c.args));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  me.mockImplementation(log('auth.me', async () => ({ id: 'user_1' })));
  runList.mockImplementation(log('run.list', async () => []));
  runCreate.mockImplementation(log('run.create', async () => ({ id: 'run_1' })));
  runUpdate.mockImplementation(log('run.update', async () => ({})));
  measFilter.mockImplementation(log('meas.filter', async () => [{ id: 'meas_1', expected_performance: 8 }]));
  measList.mockImplementation(log('meas.list', async () => []));
  measCreate.mockImplementation(log('meas.create', async () => ({ id: 'meas_1' })));
  measUpdate.mockImplementation(log('meas.update', async () => ({})));
  expCreate.mockImplementation(log('exp.create', async () => ({ id: 'exp_1' })));
  proofCreate.mockImplementation(log('proof.create', async () => ({ id: 'proof_1' })));
  signalCreate.mockImplementation(log('signal.create', async () => ({ id: 'sig_1' })));
  invoke.mockImplementation(log('InvokeLLM', async () => goodAnswer));
});

afterEach(() => { vi.clearAllMocks(); });

describe('the run is saved before the model is asked', () => {
  it('writes the row with its three computed checks before InvokeLLM is issued', async () => {
    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    await result.review;

    const savedAt = indexOf('run.update', ([, patch]) => patch.status === 'completed');
    const askedAt = indexOf('InvokeLLM');

    expect(savedAt).toBeGreaterThanOrEqual(0);
    expect(askedAt).toBeGreaterThanOrEqual(0);
    expect(savedAt).toBeLessThan(askedAt);

    // And the same for everything else that holds the student's work.
    expect(indexOf('exp.create')).toBeLessThan(askedAt);
    expect(indexOf('proof.create')).toBeLessThan(askedAt);
    expect(indexOf('meas.update')).toBeLessThan(askedAt);

    // What that first write held: three rows, all counted, none from a model.
    const first = runPatches().find(p => p.status === 'completed');
    expect(first.check_results).toHaveLength(3);
    expect(first.check_results.every(c => c.scored_by === 'checks')).toBe(true);
  });

  it('hands back the saved run without waiting for the model', async () => {
    // A call that never answers. `completeRun` still resolves, which is the
    // difference between a read-out and a spinner.
    invoke.mockImplementation(log('InvokeLLM', () => new Promise(() => {})));

    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });

    expect(result.run.status).toBe('completed');
    expect(result.run.check_results).toHaveLength(3);
    expect(result.review).toBeInstanceOf(Promise);

    // Nothing beyond the three checks was written, and nothing was stamped.
    await Promise.resolve();
    expect(runPatches().some(p => p.check_results?.length === 5)).toBe(false);
    expect(measUpdate.mock.calls.some(([, p]) => p.system_evaluated_at)).toBe(false);
  });

  it('has a wait that ends', () => {
    expect(Number.isFinite(REVIEW_WAIT_MS)).toBe(true);
    expect(REVIEW_WAIT_MS).toBeGreaterThan(0);
  });
});

describe('the review lands', () => {
  it('adds the two model rows and stamps system_evaluated_at', async () => {
    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    const upgraded = await result.review;

    expect(upgraded.run.check_results).toHaveLength(5);
    expect(upgraded.run.check_results.filter(c => c.scored_by === 'model')).toHaveLength(2);
    expect(upgraded.measurement.system_evaluated_at).toBeTruthy();

    const written = runPatches().filter(p => p.check_results).pop();
    expect(written.check_results).toHaveLength(5);
    expect(measUpdate).toHaveBeenCalledWith('meas_1', { system_evaluated_at: expect.any(String) });

    // The three computed rows are the ones already saved, not re-judged.
    expect(written.check_results.slice(0, 3).every(c => c.scored_by === 'checks')).toBe(true);
  });
});

describe('the review does not land', () => {
  it('keeps three checks and leaves system_evaluated_at absent when the call throws', async () => {
    invoke.mockImplementation(log('InvokeLLM', async () => { throw new Error('integration limit'); }));

    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    expect(await result.review).toBeNull();

    const written = runPatches().filter(p => p.check_results).pop();
    expect(written.check_results).toHaveLength(3);
    expect(measUpdate.mock.calls.some(([, p]) => p.system_evaluated_at)).toBe(false);
  });

  it('keeps three checks when the answer is unusable twice over', async () => {
    invoke.mockImplementation(log('InvokeLLM', async () => ({ criteria: [{ criterion: 'made_up', passed: 'maybe' }] })));

    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    expect(await result.review).toBeNull();

    expect(runPatches().filter(p => p.check_results).pop().check_results).toHaveLength(3);
    expect(measUpdate.mock.calls.some(([, p]) => p.system_evaluated_at)).toBe(false);
  });

  it('writes nothing at all while a hanging call is still hanging', async () => {
    invoke.mockImplementation(log('InvokeLLM', () => new Promise(() => {})));

    const result = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    const settled = await Promise.race([result.review, Promise.resolve('still waiting')]);

    expect(settled).toBe('still waiting');
    expect(runPatches().filter(p => p.check_results).pop().check_results).toHaveLength(3);
  });
});

/**
 * `current_step` is what the sweep reads when a closed tab never got to say
 * anything, and a closed tab is the ordinary way a run ends. One definition,
 * written down at STEP_OF: the step whose screen the student was on.
 */
describe('the step a row says it is on', () => {
  it('records the screen the student is moving to, not the one just submitted', async () => {
    const after = await saveStep(savedRun({ current_step: 2 }), 2, { problem_statement: 'x' }, 30, 'step3');

    expect(runUpdate).toHaveBeenCalledWith('run_1', expect.objectContaining({ current_step: 3 }));
    expect(after.current_step).toBe(3);
    // Timing still belongs to the step that was just finished.
    expect(runUpdate.mock.calls[0][1].step_seconds).toContainEqual({ step: 2, seconds: 30 });
  });

  it('moves it on a sample tap too, because the screen after a sample is a step', async () => {
    await recordSample(savedRun({ current_step: 2 }), { at_step: 2, score: 8 }, 'step3');
    expect(runUpdate).toHaveBeenCalledWith('run_1', expect.objectContaining({ current_step: 3 }));
  });

  it('leaves the number alone when a sample is not moving the student on', async () => {
    await recordSample(savedRun({ current_step: 4 }), { at_step: 4, score: 5 });
    expect(runUpdate.mock.calls[0][1].current_step).toBeUndefined();
  });

  it('is what the sweep abandons on when the page never got to speak', async () => {
    const swept = await saveStep(savedRun({ current_step: 2, status: 'in_progress' }), 2, {}, 12, 'step3');
    runUpdate.mockClear();

    await abandonRun({ ...swept, status: 'in_progress' });
    expect(runUpdate).toHaveBeenCalledWith('run_1', { status: 'abandoned', abandoned_at_step: 3 });
  });
});

describe('asking twice', () => {
  it('does not call the model again once system_evaluated_at is stamped', async () => {
    const first = await completeRun({ run: savedRun(), sim: NORTHGATE_PM });
    const upgraded = await first.review;
    expect(invoke).toHaveBeenCalledTimes(1);

    // The read-out reopened: the same rows, straight off the server.
    const again = await reviewCompletedRun({
      run: upgraded.run,
      measurement: upgraded.measurement,
      sim: NORTHGATE_PM,
    });

    expect(again).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('does not call the model again when the run already carries model rows', async () => {
    // The measurement write failed, so there was nowhere to stamp. The rows on
    // check_results are the second guard and they have to hold on their own.
    const run = savedRun({
      status: 'completed',
      check_results: [
        { criterion: 'revised_capacity', passed: true, detail: 'Six points.', scored_by: 'checks' },
        { criterion: 'problem_not_feature', passed: true, detail: 'Named.', scored_by: 'model' },
      ],
    });

    expect(await reviewCompletedRun({ run, measurement: null, sim: NORTHGATE_PM })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(runUpdate).not.toHaveBeenCalled();
  });

  it('does not review a run that is not finished', async () => {
    expect(await reviewCompletedRun({ run: savedRun(), measurement: null, sim: NORTHGATE_PM })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
