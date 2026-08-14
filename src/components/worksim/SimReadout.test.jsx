// @vitest-environment jsdom
/**
 * The read-out screen, checked against the promises the plan makes about it.
 *
 * The module underneath is already tested on the data it produces, so nothing
 * here re-tests arithmetic. What is tested is the half a diff cannot show: that
 * the four blocks all reach the page in order, that the two ways this screen can
 * be short of data (no model review, no reference spec) draw as something
 * deliberate instead of vanishing, and that no score, percentage or verdict got
 * added back in the markup after the module went to the trouble of banning it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SimReadout from './SimReadout';
import { runWorkSimChecks } from '@/lib/work-sim-checks';
import { REACTION_SCALE } from '@/lib/work-sim-readout';
import { REACTIONS } from '@/lib/career-moment';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';

afterEach(cleanup);

const SPEC_V1 = [
  'The problem',
  'Duplicate jobs are landing on technician schedules. 11 tickets in 4 days.',
  '',
  'What we are not doing',
  'Recurring jobs. Bulk reschedule.',
].join('\n');

const SPEC_V2 = [
  'The problem',
  'Duplicate jobs are landing on technician schedules. 11 tickets in 4 days.',
  '',
  'What we are not doing',
  'Recurring jobs, the error copy rewrite, and the Arizona date bug all wait.',
].join('\n');

const baseRun = (over = {}) => {
  const run = {
    simulation_key: NORTHGATE_PM.key,
    simulation_version: NORTHGATE_PM.version,
    status: 'completed',
    started_at: '2026-08-14T13:00:00.000Z',
    completed_at: '2026-08-14T13:29:00.000Z',
    problem_statement: 'Technicians drive to the same job twice.',
    selected_items: ['duplicate_jobs', 'save_error_copy'],
    selected_items_final: ['duplicate_jobs'],
    spec_v1: SPEC_V1,
    spec_v2: SPEC_V2,
    engineer_reply: 'Tell Mark it is not this sprint and I will call him myself.',
    sales_reply: 'Mark, recurring jobs is not happening this sprint.',
    experience_samples: [
      { at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' },
      { at_step: 4, score: 4, skipped: false, sampled_at: '2026-08-14T13:22:00.000Z' },
    ],
    ...over,
  };
  if (!('check_results' in over)) run.check_results = runWorkSimChecks(run);
  return run;
};

/** The two the model scores, added on top of the three that need no model. */
const MODEL_ROWS = [
  {
    criterion: 'problem_not_feature',
    passed: true,
    detail: 'The opening line names duplicate records on schedules, not a feature to build.',
    scored_by: 'model',
  },
  {
    criterion: 'honest_reply',
    passed: false,
    detail: 'The reply says no clearly and then offers a date it cannot keep.',
    scored_by: 'model',
  },
];

const measurement = (over = {}) => ({
  expected_enjoyment: 7,
  expected_energy: 6,
  expected_performance: 8,
  expected_want_more: 9,
  actual_energy: 3,
  desire_to_repeat: 5,
  ...over,
});

const draw = (run, m, props = {}) =>
  render(
    <MemoryRouter>
      <SimReadout run={run} measurement={m} {...props} />
    </MemoryRouter>,
  );

const pageText = () => document.body.textContent || '';

// ---------------------------------------------------------------------------

describe('the complete case, with all five checks in', () => {
  const run = () => {
    const r = baseRun();
    return baseRun({ check_results: [...runWorkSimChecks(r), ...MODEL_ROWS] });
  };

  it('draws the four blocks in the order the plan sets', () => {
    draw(run(), measurement());
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(headings).toEqual([
      'What you expected, and what happened',
      'What we counted, without judging you',
      'Your spec, next to one somebody else wrote',
      'What this does not tell you',
    ]);
  });

  it('draws all four prediction rows, in order, with their copy under them', () => {
    draw(run(), measurement());
    const ids = ['enjoyment', 'energy', 'performance', 'want_more'];
    ids.forEach(id => {
      expect(screen.getByTestId(`prediction-${id}`)).toBeTruthy();
    });
    expect(screen.getByTestId('prediction-enjoyment').textContent).toContain('You predicted 7.');
    expect(screen.getByTestId('prediction-energy').textContent).toContain('You finished at 3.');
  });

  it('shows the two model criteria as a reader\'s note rather than a score', () => {
    draw(run(), measurement());
    expect(screen.getByText("A reader's note, not a score")).toBeTruthy();
    expect(screen.getByTestId('check-problem_not_feature').textContent).toContain('Passed');
    expect(screen.getByTestId('check-honest_reply').textContent).toContain('Did not pass');
  });

  it('puts the fact under every check it draws', () => {
    draw(run(), measurement());
    const capacity = screen.getByTestId('check-plan_fits_capacity');
    expect(capacity.textContent).toContain('points against a capacity of 6');
    expect(capacity.textContent).toContain('What would change this');
  });

  it('says nothing is missing and lists nothing as not scored', () => {
    draw(run(), measurement());
    expect(pageText()).toContain('These are counted from what you wrote. A model did not score them.');
    expect(screen.queryByText('Not scored')).toBeNull();
  });

  it('carries no verdict, no trait noun and no long dash anywhere on the screen', () => {
    draw(run(), measurement());
    const t = pageText();
    expect(t).not.toMatch(/\bverdict\b/i);
    expect(t).not.toMatch(/\bfit\b/i);
    expect(t).not.toMatch(/\byou are\b/i);
    expect(t).not.toMatch(/[—–]/);
  });

  it('puts no score and no percentage in a heading or a label', () => {
    draw(run(), measurement());
    // The page can hold a percentage, but only inside a check's own evidence,
    // where it is a word-diff measurement of the student's two spec versions.
    // Nothing this screen writes is allowed to carry one, because a percentage
    // in a heading is how a read-out turns into a score.
    const written = [
      ...screen.getAllByRole('heading').map(h => h.textContent),
      ...Array.from(document.querySelectorAll('.tp-eyebrow, .tp-label, .tp-meta')).map(e => e.textContent),
    ].join(' ');
    expect(written).not.toMatch(/%/);
    expect(written).not.toMatch(/\bout of\b/i);
    expect(written).not.toMatch(/\b\d+\s*\/\s*\d+\b/);
  });

  it('always draws Block D word for word, whatever else is on the screen', () => {
    draw(run(), measurement());
    expect(pageText()).toContain('It does not tell you whether you would be good at the job');
    expect(pageText()).toContain('do another one that is nothing like it');
  });
});

// ---------------------------------------------------------------------------

describe('the degraded case, when the two model criteria never came back', () => {
  it('says three of five in words and never draws a count with a tick beside it', () => {
    draw(baseRun(), measurement());
    expect(pageText()).toContain(
      'Two of the five checks need a review we could not run just now. The ones below are counted from what you wrote and are not affected by it.',
    );
    expect(screen.queryByText("A reader's note, not a score")).toBeNull();
    expect(pageText()).not.toMatch(/\b3 of 5\b|\bthree of five checks passed\b/i);
  });

  it('names the two it could not score instead of dropping them', () => {
    draw(baseRun(), measurement());
    expect(screen.getByText('Not scored')).toBeTruthy();
    expect(screen.getByTestId('not-scored-problem_not_feature').textContent)
      .toContain('The problem statement names a problem');
    expect(screen.getByTestId('not-scored-honest_reply').textContent)
      .toContain('The reply to sales is honest');
  });

  it('keeps the performance row, says why there is no number, and invents none', () => {
    draw(baseRun(), measurement());
    const perf = screen.getByTestId('prediction-performance');
    expect(perf.getAttribute('data-status')).toBe('not_comparable');
    expect(perf.textContent).toContain('You predicted 8 out of 10.');
    expect(perf.textContent).toContain('The other two need a review we could not run just now');
    expect(within(perf).getByText('No number to compare')).toBeTruthy();
    expect(perf.textContent).not.toContain('on the same scale');
  });

  it('still draws all four blocks and all four rows', () => {
    draw(baseRun(), measurement());
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
    ['enjoyment', 'energy', 'performance', 'want_more'].forEach(id => {
      expect(screen.getByTestId(`prediction-${id}`)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------

describe('Block C, which has no reference spec written yet', () => {
  it('stays on the screen and says plainly why the other half is empty', () => {
    draw(baseRun(), measurement());
    const missing = screen.getByTestId('comparison-missing');
    expect(missing.textContent).toContain('nobody has written it');
    expect(missing.textContent).toContain('empty rather than filled in with ours');
  });

  it('shows the student their own spec while the other half is missing', () => {
    draw(baseRun(), measurement());
    expect(screen.getByText('What you wrote')).toBeTruthy();
    expect(pageText()).toContain('the error copy rewrite');
  });

  it('draws no invitation to compare when there is nothing to compare against', () => {
    draw(baseRun(), measurement());
    expect(pageText()).not.toContain('This is not a right answer.');
  });

  it('draws the reference and its author the day somebody writes one', () => {
    const reference = {
      author: 'A named product manager',
      role: 'Product manager, scheduling software',
      text: 'The problem\nTechnicians drive to jobs twice.',
    };
    draw(baseRun(), measurement(), { reference });
    expect(screen.queryByTestId('comparison-missing')).toBeNull();
    expect(screen.getByText('What they wrote')).toBeTruthy();
    expect(pageText()).toContain('A named product manager · Product manager, scheduling software');
    expect(pageText()).toContain('This is not a right answer.');
  });
});

// ---------------------------------------------------------------------------

describe('an abandoned run', () => {
  const run = baseRun({
    status: 'abandoned',
    abandoned_at_step: 4,
    spec_v2: '',
    engineer_reply: '',
    sales_reply: '',
    check_results: [],
    experience_samples: [{ at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' }],
  });

  it('says where it stopped rather than pretending it finished', () => {
    draw(run, measurement({ actual_energy: undefined, desire_to_repeat: undefined }));
    expect(pageText()).toContain('You stopped at step 4 of five');
  });

  it('marks the rows it has no answer for as empty instead of filling them', () => {
    draw(run, measurement({ actual_energy: undefined }));
    const energy = screen.getByTestId('prediction-energy');
    expect(energy.getAttribute('data-status')).toBe('no_outcome');
    expect(within(energy).getByText('Nothing recorded')).toBeTruthy();
    expect(energy.textContent).toContain('You predicted 6.');
  });

  it('lists all five criteria as not scored and draws no check rows', () => {
    draw(run, measurement());
    expect(screen.getByText('Not scored')).toBeTruthy();
    expect(screen.getAllByTestId(/^not-scored-/)).toHaveLength(5);
    expect(screen.queryByTestId('check-plan_fits_capacity')).toBeNull();
  });

  it('still draws Block C and Block D', () => {
    draw(run, measurement());
    expect(screen.getByTestId('comparison-missing')).toBeTruthy();
    expect(pageText()).toContain('It does not tell you whether you would be good at the job');
  });
});

// ---------------------------------------------------------------------------

/**
 * The read-out compares enjoyment on the four answers the check-in offered
 * rather than in points, so it holds its own copy of that row: it is a pure
 * module and career-moment.js drags in the SDK. This is the only place both
 * can be imported cheaply, so this is where the copy is held to the original.
 */
describe('the four answers the read-out reasons about', () => {
  it('is the same row the sampling screen draws', () => {
    expect(REACTION_SCALE).toEqual(REACTIONS.map(r => ({ score: r.score, label: r.label })));
  });
});

describe('a gap under the threshold, which is a result and not a null state', () => {
  it('prints both numbers and then says they called it', () => {
    draw(baseRun(), measurement({ expected_energy: 4 }));
    const energy = screen.getByTestId('prediction-energy');
    expect(energy.textContent).toContain('You predicted 4.');
    expect(energy.textContent).toContain('You finished at 3.');
    expect(energy.textContent).toContain('You called this one.');
  });

  it('draws it at the same weight as a gap row and gives it no absence label', () => {
    // The two enjoyment readings sit on "Enjoyed it" and "Neutral", which
    // average out between 5 and 7.75, against a prediction of 10: 2.25 points
    // outside, so it is a gap. Energy is 3 against 4, so it is not. Both are
    // claims and both should draw the same.
    draw(baseRun(), measurement({ expected_energy: 4, expected_enjoyment: 10 }));
    const energy = screen.getByTestId('prediction-energy');
    const gapRow = screen.getByTestId('prediction-enjoyment');
    expect(energy.getAttribute('data-status')).toBe('no_gap');
    expect(gapRow.getAttribute('data-status')).toBe('gap');

    expect(within(energy).queryByText('No prediction')).toBeNull();
    expect(within(energy).queryByText('Nothing recorded')).toBeNull();
    expect(within(energy).queryByText('No number to compare')).toBeNull();

    const colourOf = (el) => el.querySelector('p.tp-body').getAttribute('style');
    expect(colourOf(energy)).toContain('--text-primary');
    expect(colourOf(energy)).toBe(colourOf(gapRow));

    // And a row with nothing in it does not, which is what makes the quiet
    // treatment read as a choice rather than as this row failing to load.
    cleanup();
    draw(baseRun(), measurement({ actual_energy: undefined }));
    const empty = screen.getByTestId('prediction-energy');
    expect(empty.getAttribute('data-status')).toBe('no_outcome');
    expect(colourOf(empty)).toContain('--text-secondary');
  });

  it('keeps what would overturn it under the row', () => {
    draw(baseRun(), measurement({ expected_energy: 4 }));
    expect(screen.getByTestId('prediction-energy').textContent).toContain('What would change this');
  });
});

// ---------------------------------------------------------------------------

describe('when the read-out cannot be built at all', () => {
  it('says so and offers a way out instead of drawing a blank screen', () => {
    // A rubric with a criterion the run answered with no detail under it is the
    // one thing the module refuses to ship, so it throws and the screen falls
    // back rather than rendering nothing.
    const sim = {
      ...NORTHGATE_PM,
      rubric: [{ id: 'plan_fits_capacity', criterion: 'A check with no fact.', scored_by: 'checks' }],
    };
    draw(
      baseRun({ check_results: [{ criterion: 'plan_fits_capacity', passed: true, detail: '', scored_by: 'checks' }] }),
      measurement(),
      { sim },
    );
    expect(pageText()).toContain('The read-out did not build');
    expect(screen.getByText('Back to My Journey')).toBeTruthy();
  });
});
