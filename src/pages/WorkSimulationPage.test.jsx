// @vitest-environment jsdom
/**
 * The work simulation, driven the way a student drives it.
 *
 * Four things are asserted here because all four are invisible in a diff and
 * expensive to get wrong in production:
 *
 * - every step hands over to the next one, and the run row carries what that
 *   step produced;
 * - the two experience samples fire at their seams and nowhere else, which is
 *   the difference between a reading and an interruption;
 * - a skip is stored as a skip rather than as a missing value;
 * - closing the page part way through leaves a row that says which step, keeps
 *   the samples already given, and creates no Experiments row.
 *
 * The last one is the reason this file renders the real page instead of testing
 * the module underneath it. Abandonment lives in a React cleanup, so it is only
 * true if the component wires it up.
 *
 * The fifth thing, added when the review was wired up, is what a student is
 * looking at while the one model call runs. Same reason: the deadline and the
 * way out of the wait are both React state, so they are only true if this
 * component does them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';
import { SIM_PRE_FIELDS } from '@/lib/experiment-measurement';
import { REVIEW_WAIT_MS } from '@/lib/work-sim';

const { me, runList, runCreate, runUpdate, measFilter, measList, measCreate, measUpdate,
  expCreate, proofCreate, signalCreate, track, invoke } = vi.hoisted(() => ({
  me: vi.fn(),
  runList: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  measFilter: vi.fn(),
  measList: vi.fn(),
  measCreate: vi.fn(),
  measUpdate: vi.fn(),
  expCreate: vi.fn(),
  proofCreate: vi.fn(),
  signalCreate: vi.fn(),
  track: vi.fn(),
  invoke: vi.fn(),
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

vi.mock('@/lib/ai-failures', () => ({ reportAiFailure: vi.fn().mockResolvedValue(null) }));

// The cycle and path links are resolved through the SDK and are not what any of
// these tests are about.
vi.mock('@/lib/career-cycle', () => ({
  cycleLinks: vi.fn().mockResolvedValue({ user_id: 'user_1' }),
}));

vi.mock('@/lib/pilot-metrics', () => ({
  trackPilotEvent: track,
  PILOT_EVENTS: [],
}));

const { default: WorkSimulationPage } = await import('@/pages/WorkSimulationPage');

const SAMPLE_QUESTION = 'Right now, this is...';
const WAITING = 'Your run is saved';
const MODEL_NOTES = "A reader's note, not a score";
const NOT_SCORED = 'Not scored';

/** What the one model call returns when it works. */
const REVIEW_ANSWER = {
  criteria: [
    { criterion: 'problem_not_feature', passed: true, detail: 'You named what is going wrong and who it lands on.' },
    { criterion: 'honest_reply', passed: false, detail: 'You told Mark it is not happening and gave him no date.' },
  ],
};

/** The most recent payload written to the run row. */
const lastUpdate = () => runUpdate.mock.calls[runUpdate.mock.calls.length - 1]?.[1];

/** Every run payload written so far, merged, which is the row as it now stands. */
const rowSoFar = () => runUpdate.mock.calls.reduce((acc, [, patch]) => ({ ...acc, ...patch }), {});

beforeEach(() => {
  vi.clearAllMocks();
  me.mockResolvedValue({ id: 'user_1' });
  runList.mockResolvedValue([]);
  runCreate.mockResolvedValue({ id: 'run_1', status: 'in_progress', current_step: 1, simulation_key: NORTHGATE_PM.key });
  runUpdate.mockResolvedValue({});
  measFilter.mockResolvedValue([]);
  measList.mockResolvedValue([]);
  measCreate.mockResolvedValue({ id: 'meas_1' });
  measUpdate.mockResolvedValue({});
  expCreate.mockResolvedValue({ id: 'exp_1' });
  proofCreate.mockResolvedValue({ id: 'proof_1' });
  signalCreate.mockResolvedValue({ id: 'sig_1' });
  // The model is stubbed everywhere in this file. Nothing here has ever made a
  // real call and nothing here should start.
  invoke.mockResolvedValue(REVIEW_ANSWER);
});

afterEach(cleanup);

function draw() {
  return render(<MemoryRouter><WorkSimulationPage /></MemoryRouter>);
}

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));

/** The setup screen: three scale rows and one three way answer. */
async function answerPredictions() {
  SIM_PRE_FIELDS.forEach(f => {
    if (f.key === 'expected_want_more') click('Yes');
    else click(`${f.label}: 7 out of 10`);
  });
}

/** Through the setup screen and into step 1. */
async function begin() {
  draw();
  await screen.findByText(NORTHGATE_PM.title);
  await answerPredictions();
  click('Start');
  await screen.findByText(NORTHGATE_PM.steps[0].blurb);
}

/** Step 1 into step 2. */
async function throughReadIn() {
  click('I have read these');
  await screen.findByText(NORTHGATE_PM.steps[1].blurb);
}

/** Step 2: one item in, the rest cut, then submit. */
async function cutTheList({ keep = 'duplicate_jobs' } = {}) {
  fireEvent.change(screen.getByLabelText('In one line, what is the problem?'), {
    target: { value: 'Duplicate jobs are landing on technician schedules.' },
  });
  NORTHGATE_PM.backlog.items.forEach(item => {
    click(`${item.title}: ${item.id === keep ? 'In' : 'Cut'}`);
  });
  // Cutting a thing reveals the line you have to send the person who asked for
  // it, which is the half of this step that is not a prioritisation quiz.
  fireEvent.change(document.getElementById('cut-note-recurring_jobs'), {
    target: { value: 'Not this sprint. I will call Mark today with a real date.' },
  });
  click('That is my sprint');
}

describe('the work simulation, end to end', () => {
  it('walks every step and writes what each one produced', async () => {
    await begin();
    expect(runCreate).toHaveBeenCalledTimes(1);

    await throughReadIn();
    await cutTheList();

    // Seam one.
    await screen.findByText(SAMPLE_QUESTION);
    click('Enjoyed it');

    // Step 3, seeded with the five headings.
    const spec = await screen.findByRole('textbox');
    expect(spec.value).toContain('What we are not doing');
    fireEvent.change(spec, { target: { value: 'The problem\nDuplicates.\n\nWhat we are not doing\nRecurring jobs.' } });
    click('Send it to Priya');

    // Step 4, first half.
    await screen.findByText(NORTHGATE_PM.revision.message);
    click('Save the new version');

    // Seam two.
    await screen.findByText(SAMPLE_QUESTION);
    click('Neutral');

    // Step 4, second half.
    const answer = await screen.findByLabelText(NORTHGATE_PM.revision.question);
    fireEvent.change(answer, { target: { value: 'Tell him the date moved and I will call him myself.' } });
    click('Send it to Priya');

    // Step 5.
    const reply = await screen.findByLabelText(`To: ${NORTHGATE_PM.reply.to}`);
    fireEvent.change(reply, { target: { value: 'Mark, recurring jobs is not this sprint.' } });
    click('Send it');

    // The three after.
    await screen.findByText('Do you want to do another one?');
    click('How do you feel now?: 4 out of 10');
    click('Yes');
    click('Finish');

    // The wait for the two model-scored checks, then the read-out with them in.
    await screen.findByText(WAITING);
    await screen.findByText('Your read-out');
    await screen.findByText(MODEL_NOTES);

    const row = rowSoFar();
    expect(row.problem_statement).toContain('Duplicate jobs');
    expect(row.selected_items).toEqual(['duplicate_jobs']);
    expect(row.cut_notes).toEqual([
      { item_id: 'recurring_jobs', note: 'Not this sprint. I will call Mark today with a real date.' },
    ]);
    expect(row.spec_v1).toContain('Duplicates.');
    expect(row.spec_v2).toContain('Duplicates.');
    expect(row.engineer_reply).toContain('call him myself');
    expect(row.sales_reply).toContain('not this sprint');
    expect(row.status).toBe('completed');

    // The row was saved with the three computed checks and upgraded to five
    // afterwards. Both writes, in that order, are the ordering the plan asks
    // for, and they are pinned against the call log in work-sim.test.js.
    const checkWrites = runUpdate.mock.calls.map(([, p]) => p.check_results).filter(Boolean);
    expect(checkWrites.map(c => c.length)).toEqual([3, 5]);
    expect(checkWrites[0].every(c => c.scored_by === 'checks')).toBe(true);
    expect(checkWrites[1].filter(c => c.scored_by === 'model')).toHaveLength(2);
    expect(measUpdate).toHaveBeenCalledWith('meas_1', { system_evaluated_at: expect.any(String) });

    // One experiment, created at the end and only at the end.
    expect(expCreate).toHaveBeenCalledTimes(1);
    expect(expCreate.mock.calls[0][0].status).toBe('completed');
    expect(proofCreate).toHaveBeenCalledTimes(1);
  });

  it('samples at the two seams and at no other step', async () => {
    await begin();

    // Not after the read-in.
    click('I have read these');
    await screen.findByText(NORTHGATE_PM.steps[1].blurb);
    expect(screen.queryByText(SAMPLE_QUESTION)).toBeNull();

    // After cutting the list, yes.
    await cutTheList();
    await screen.findByText(SAMPLE_QUESTION);
    click('Enjoyed it');

    // Not after the spec.
    const spec = await screen.findByRole('textbox');
    fireEvent.change(spec, { target: { value: 'A spec.' } });
    click('Send it to Priya');
    await screen.findByText(NORTHGATE_PM.revision.message);
    expect(screen.queryByText(SAMPLE_QUESTION)).toBeNull();

    // After the rework, yes.
    click('Save the new version');
    await screen.findByText(SAMPLE_QUESTION);
    click('Neutral');

    // Not after the reply to Priya, and not after the reply to Mark.
    const answer = await screen.findByLabelText(NORTHGATE_PM.revision.question);
    fireEvent.change(answer, { target: { value: 'Tell him it slipped.' } });
    click('Send it to Priya');
    const reply = await screen.findByLabelText(`To: ${NORTHGATE_PM.reply.to}`);
    expect(screen.queryByText(SAMPLE_QUESTION)).toBeNull();

    fireEvent.change(reply, { target: { value: 'Not this sprint.' } });
    click('Send it');
    await screen.findByText('Do you want to do another one?');
    expect(screen.queryByText(SAMPLE_QUESTION)).toBeNull();

    const samples = rowSoFar().experience_samples;
    expect(samples).toHaveLength(2);
    expect(samples.map(s => s.at_step)).toEqual([2, 4]);
    expect(samples.map(s => s.score)).toEqual([8, 5]);
  });

  it('records a skip as a skip rather than as a missing reading', async () => {
    await begin();
    await throughReadIn();
    await cutTheList();

    await screen.findByText(SAMPLE_QUESTION);
    click('Skip this');

    await waitFor(() => expect(lastUpdate().experience_samples).toBeTruthy());
    const [first] = lastUpdate().experience_samples;
    expect(first.at_step).toBe(2);
    expect(first.skipped).toBe(true);
    expect(first.score).toBeUndefined();
    expect(first.sampled_at).toBeTruthy();

    // And the step it belongs to still moved on.
    await screen.findByText(NORTHGATE_PM.steps[2].blurb);
  });
});

/** Every step, quickly, and then the finish button. */
async function toTheEnd() {
  await begin();
  await throughReadIn();
  await cutTheList();

  await screen.findByText(SAMPLE_QUESTION);
  click('Enjoyed it');

  const spec = await screen.findByRole('textbox');
  fireEvent.change(spec, { target: { value: 'The problem\nDuplicates.\n\nWhat we are not doing\nRecurring jobs.' } });
  click('Send it to Priya');

  await screen.findByText(NORTHGATE_PM.revision.message);
  click('Save the new version');

  await screen.findByText(SAMPLE_QUESTION);
  click('Neutral');

  const answer = await screen.findByLabelText(NORTHGATE_PM.revision.question);
  fireEvent.change(answer, { target: { value: 'Tell him the date moved and I will call him myself.' } });
  click('Send it to Priya');

  const reply = await screen.findByLabelText(`To: ${NORTHGATE_PM.reply.to}`);
  fireEvent.change(reply, { target: { value: 'Mark, recurring jobs is not this sprint and I will not give you a date.' } });
  click('Send it');

  await screen.findByText('Do you want to do another one?');
  click('How do you feel now?: 4 out of 10');
  click('Yes');
  click('Finish');
}

/**
 * The wait for the two model-scored checks.
 *
 * The rule this enforces is that a slow model can cost two criteria and can
 * never cost a student their read-out. Three ways out are covered: the answer,
 * the deadline, and the button. A model that hangs forever is the default case
 * in two of these, because it is the one that turns into a spinner nobody can
 * escape if anything here is wrong.
 */
describe('waiting for the two model-scored checks', () => {
  /** Catches the page's own deadline so it can be fired without a real wait. */
  function captureDeadline() {
    const real = globalThis.setTimeout;
    const held = {};
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...rest) => {
      if (ms === REVIEW_WAIT_MS) { held.fire = fn; return -1; }
      return real(fn, ms, ...rest);
    });
    return held;
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('says the run is saved rather than showing a read-out it does not have yet', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));
    await toTheEnd();

    await screen.findByText(WAITING);
    // Nothing about the checks is on screen yet, in either direction.
    expect(screen.queryByText('Your read-out')).toBeNull();
    expect(screen.queryByText(MODEL_NOTES)).toBeNull();
    expect(screen.queryByText(NOT_SCORED)).toBeNull();
  });

  it('opens the read-out without the two checks when the wait runs out', async () => {
    const deadline = captureDeadline();
    invoke.mockImplementation(() => new Promise(() => {}));

    await toTheEnd();
    await screen.findByText(WAITING);

    expect(typeof deadline.fire).toBe('function');
    act(() => deadline.fire());

    await screen.findByText('Your read-out');
    await screen.findByText(NOT_SCORED);
    expect(screen.getByTestId('not-scored-problem_not_feature')).toBeTruthy();
    expect(screen.getByTestId('not-scored-honest_reply')).toBeTruthy();
    expect(screen.queryByText(MODEL_NOTES)).toBeNull();

    // Three checks on the row, and no stamp, so a backfill knows there is work.
    const written = runUpdate.mock.calls.map(([, p]) => p.check_results).filter(Boolean).pop();
    expect(written).toHaveLength(3);
    expect(measUpdate.mock.calls.some(([, p]) => p.system_evaluated_at)).toBe(false);
  });

  it('lets the student out of the wait on their own', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));

    await toTheEnd();
    await screen.findByText(WAITING);
    click('Show my read-out now');

    await screen.findByText('Your read-out');
    await screen.findByText(NOT_SCORED);
  });

  it('draws the read-out with three checks when the model call fails', async () => {
    invoke.mockRejectedValue(new Error('monthly integration limit'));

    await toTheEnd();
    await screen.findByText('Your read-out');
    await screen.findByText(NOT_SCORED);
    expect(screen.queryByText(MODEL_NOTES)).toBeNull();

    const written = runUpdate.mock.calls.map(([, p]) => p.check_results).filter(Boolean).pop();
    expect(written).toHaveLength(3);
    expect(measUpdate.mock.calls.some(([, p]) => p.system_evaluated_at)).toBe(false);
  });

  it('asks the model once, not once per screen the read-out draws', async () => {
    await toTheEnd();
    await screen.findByText(MODEL_NOTES);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe('leaving part way through', () => {
  it('records the step, keeps the samples, and creates no experiment', async () => {
    await begin();
    await throughReadIn();
    await cutTheList();

    await screen.findByText(SAMPLE_QUESTION);
    click('Enjoyed it');
    await screen.findByText(NORTHGATE_PM.steps[2].blurb);

    // A student on step 3 closes the tab.
    cleanup();

    await waitFor(() => {
      const abandon = runUpdate.mock.calls.find(([, patch]) => patch.status === 'abandoned');
      expect(abandon).toBeTruthy();
      expect(abandon[1].abandoned_at_step).toBe(3);
    });

    expect(rowSoFar().experience_samples).toHaveLength(1);
    expect(expCreate).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('simulation_abandoned', expect.objectContaining({ value: 3 }));
  });

  it('closes out a run an earlier visit left open, with the step it stopped at', async () => {
    runList.mockResolvedValue([
      { id: 'run_old', status: 'in_progress', current_step: 4 },
      { id: 'run_older', status: 'completed', current_step: 5 },
    ]);

    draw();
    await screen.findByText(NORTHGATE_PM.title);

    await waitFor(() => {
      expect(runUpdate).toHaveBeenCalledWith('run_old', { status: 'abandoned', abandoned_at_step: 4 });
    });
    expect(runUpdate).not.toHaveBeenCalledWith('run_older', expect.anything());
    expect(expCreate).not.toHaveBeenCalled();
  });
});
