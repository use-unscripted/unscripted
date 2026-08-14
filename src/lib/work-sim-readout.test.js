import { describe, it, expect } from 'vitest';
import {
  buildWorkSimReadout,
  copyStrings,
  findBannedLanguage,
  BANNED_TRAIT_WORDS,
  PREDICTION_GAP_THRESHOLD,
  FALSIFIER_LABEL,
  LIMITS_BLOCK,
} from './work-sim-readout';
import { runWorkSimChecks } from './work-sim-checks';
import { NORTHGATE_PM } from './work-sims/northgate-pm';

// ---------------------------------------------------------------------------
// Fixtures. One run that finished cleanly, and knobs for every branch.
// ---------------------------------------------------------------------------

const SPEC_V1 = [
  'The problem',
  'Duplicate jobs are landing on technician schedules. 11 tickets in 4 days.',
  '',
  'Who it is for',
  'Dispatchers at small home services companies.',
  '',
  'What we are doing',
  'Fixing the duplicate job bug in the sync job.',
  '',
  'What we are not doing',
  'Recurring jobs. Bulk reschedule. The export.',
  '',
  'How we will know it worked',
  'Duplicate rate back under 2.1 within a month.',
].join('\n');

const SPEC_V2 = [
  'The problem',
  'Duplicate jobs are landing on technician schedules. 11 tickets in 4 days.',
  '',
  'Who it is for',
  'Dispatchers at small home services companies.',
  '',
  'What we are doing',
  'Only the duplicate job bug. Priya re-estimated it at 5 points so it takes the sprint on its own.',
  '',
  'What we are not doing',
  'Recurring jobs, the error copy rewrite, and the Arizona date bug all wait.',
  '',
  'How we will know it worked',
  'Duplicate rate back under 2.1 within a month and Ridgeline stops reporting it.',
].join('\n');

const baseRun = (over = {}) => {
  const run = {
    simulation_key: NORTHGATE_PM.key,
    simulation_version: NORTHGATE_PM.version,
    status: 'completed',
    started_at: '2026-08-14T13:00:00.000Z',
    completed_at: '2026-08-14T13:29:00.000Z',
    problem_statement: 'Technicians drive to the same job twice.',
    selected_items: ['duplicate_jobs', 'save_error_copy', 'late_booking_date', 'job_export'],
    selected_items_final: ['duplicate_jobs', 'save_error_copy'],
    spec_v1: SPEC_V1,
    spec_v2: SPEC_V2,
    engineer_reply: 'Tell Mark it is not this sprint and I will call him myself.',
    sales_reply: 'Mark, recurring jobs is not happening this sprint and I am not going to give you a date I cannot keep.',
    experience_samples: [
      { at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' },
      { at_step: 4, score: 4, skipped: false, sampled_at: '2026-08-14T13:22:00.000Z' },
    ],
    ...over,
  };
  if (!('check_results' in over)) run.check_results = computedChecks(run);
  return run;
};

/** The three model-free checks, run for real rather than hand written. */
const computedChecks = (run) => runWorkSimChecks(run);

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
    detail: 'The reply says no clearly and then offers "sometime after this sprint", which is a date it cannot keep.',
    scored_by: 'model',
  },
];

const fullChecks = (run) => [...computedChecks(run), ...MODEL_ROWS];

const measurement = (over = {}) => ({
  expected_enjoyment: 7,
  expected_energy: 6,
  expected_performance: 8,
  expected_want_more: 9,
  actual_enjoyment: 6,
  actual_energy: 3,
  desire_to_repeat: 5,
  ...over,
});

const rowById = (readout, id) => readout.blocks.predictions.rows.find(r => r.id === id);
const allText = (readout) => copyStrings(readout).join(' \n ');
const everyString = (node, out = []) => {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(n => everyString(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach(v => everyString(v, out));
  return out;
};

// ---------------------------------------------------------------------------

describe('the shape the UI is given', () => {
  it('always returns the four blocks in the same places', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    expect(Object.keys(r.blocks)).toEqual(['predictions', 'checks', 'comparison', 'limits']);
    expect(r.blocks.predictions.id).toBe('A');
    expect(r.blocks.checks.id).toBe('B');
    expect(r.blocks.comparison.id).toBe('C');
    expect(r.blocks.limits.id).toBe('D');
    expect(r.version).toBe(1);
    expect(r.simulation.key).toBe('northgate_pm_triage_v1');
  });

  it('always returns four prediction rows in the same order, however empty the data is', () => {
    const ids = ['enjoyment', 'energy', 'performance', 'want_more'];
    expect(buildWorkSimReadout(baseRun(), measurement()).blocks.predictions.rows.map(r => r.id)).toEqual(ids);
    expect(buildWorkSimReadout({}, {}).blocks.predictions.rows.map(r => r.id)).toEqual(ids);
    expect(buildWorkSimReadout(null, null).blocks.predictions.rows.map(r => r.id)).toEqual(ids);
  });

  it('publishes the threshold it used, so the UI never has to guess at it', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    expect(PREDICTION_GAP_THRESHOLD).toBe(2);
    expect(r.blocks.predictions.threshold).toBe(PREDICTION_GAP_THRESHOLD);
  });

  it('gives every prediction row a falsifier and the label that goes above it', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    expect(r.falsifier_label).toBe(FALSIFIER_LABEL);
    r.blocks.predictions.rows.forEach(row => {
      expect(row.falsifier).toBeTruthy();
      expect(row.falsifier.length).toBeGreaterThan(20);
    });
  });

  it('does not throw on a row that is missing everything', () => {
    expect(() => buildWorkSimReadout(undefined, undefined)).not.toThrow();
  });
});

describe('rule 2, a gap under the threshold is no gap', () => {
  it('reports a gap over the threshold, with both numbers in the copy', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    const energy = rowById(r, 'energy');
    expect(energy.status).toBe('gap');
    expect(energy.predicted).toBe(6);
    expect(energy.actual).toBe(3);
    expect(energy.gap).toBe(-3);
    expect(energy.gap_size).toBe(3);
    expect(energy.clears_threshold).toBe(true);
    expect(energy.lines.join(' ')).toContain('You predicted 6.');
    expect(energy.lines.join(' ')).toContain('You finished at 3.');
    expect(energy.lines.join(' ')).toContain('3 points lower than you expected');
  });

  it('treats a gap of exactly the threshold as a gap', () => {
    const r = buildWorkSimReadout(baseRun(), measurement({ expected_energy: 5, actual_energy: 3 }));
    const energy = rowById(r, 'energy');
    expect(energy.gap_size).toBe(2);
    expect(energy.clears_threshold).toBe(true);
    expect(energy.status).toBe('gap');
    expect(energy.lines.join(' ')).not.toContain('called this one');
  });

  it('takes the "you called this one" branch just under the threshold, and still prints both numbers', () => {
    const r = buildWorkSimReadout(baseRun(), measurement({ expected_energy: 5, actual_energy: 3.5 }));
    const energy = rowById(r, 'energy');
    expect(energy.gap_size).toBe(1.5);
    expect(energy.clears_threshold).toBe(false);
    expect(energy.status).toBe('no_gap');
    expect(energy.lines).toContain('You called this one.');
    expect(energy.lines).toContain('You predicted 5.');
    expect(energy.lines).toContain('You finished at 3.5.');
  });

  it('calls a perfect prediction no gap rather than silence', () => {
    const r = buildWorkSimReadout(baseRun(), measurement({ expected_energy: 4, actual_energy: 4 }));
    const energy = rowById(r, 'energy');
    expect(energy.gap).toBe(0);
    expect(energy.status).toBe('no_gap');
    expect(energy.lines).toContain('You called this one.');
  });

  it('prints both numbers on every row that claims a gap', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    r.blocks.predictions.rows
      .filter(row => row.status === 'gap' || row.status === 'no_gap')
      .forEach(row => {
        const hasNumbers = row.predicted !== null && (row.actual !== null || !!row.actual_text);
        expect(hasNumbers).toBe(true);
      });
  });
});

describe('the enjoyment row, which is sampled during rather than recalled after', () => {
  it('names both readings and the moment each one landed', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    const e = rowById(r, 'enjoyment');
    expect(e.lines).toContain('You predicted 7.');
    expect(e.lines).toContain('After you cut the list you said 8.');
    expect(e.lines).toContain('After Priya changed the estimate you said 4.');
    expect(e.actual).toBe(6);
    expect(e.facts.drop_between_samples).toBe(4);
    expect(e.lines.join(' ')).toContain('The reading fell 4 between the two check-ins');
  });

  it('works out how far into the run each reading was taken', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    expect(rowById(r, 'enjoyment').facts.samples.map(s => s.minutes_in)).toEqual([11, 22]);
  });

  it('says it is one reading and not an average when one sample was skipped', () => {
    const run = baseRun({
      experience_samples: [
        { at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' },
        { at_step: 4, skipped: true, sampled_at: '2026-08-14T13:22:00.000Z' },
      ],
    });
    const e = rowById(buildWorkSimReadout(run, measurement({ actual_enjoyment: 8 })), 'enjoyment');
    expect(e.actual).toBe(8);
    expect(e.facts.samples_taken).toBe(1);
    expect(e.facts.samples_skipped).toBe(1);
    expect(e.lines).toContain('You skipped one of the two check-ins, so this is one reading and not an average.');
    expect(e.facts.drop_between_samples).toBeNull();
  });

  it('says we do not know when both samples were skipped, and invents no number', () => {
    const run = baseRun({
      experience_samples: [
        { at_step: 2, skipped: true, sampled_at: '2026-08-14T13:11:00.000Z' },
        { at_step: 4, skipped: true, sampled_at: '2026-08-14T13:22:00.000Z' },
      ],
    });
    const e = rowById(buildWorkSimReadout(run, measurement({ actual_enjoyment: undefined })), 'enjoyment');
    expect(e.status).toBe('no_outcome');
    expect(e.actual).toBeNull();
    expect(e.gap).toBeNull();
    expect(e.lines.join(' ')).toContain('You skipped both check-ins');
    expect(e.lines.join(' ')).toContain('We are not going to guess at one.');
    expect(e.lines).toContain('You predicted 7.');
  });

  it('reads the samples in step order even when they are stored the other way round', () => {
    const run = baseRun({
      experience_samples: [
        { at_step: 4, score: 4, skipped: false, sampled_at: '2026-08-14T13:22:00.000Z' },
        { at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' },
      ],
    });
    const e = rowById(buildWorkSimReadout(run, measurement()), 'enjoyment');
    expect(e.facts.samples.map(s => s.score)).toEqual([8, 4]);
    expect(e.facts.drop_between_samples).toBe(4);
  });
});

describe('a run with no pre measurement at all', () => {
  const noPre = () => buildWorkSimReadout(baseRun({ check_results: fullChecks(baseRun({ check_results: [] })) }), {
    actual_energy: 3,
    desire_to_repeat: 5,
  });

  it('says the four questions were never answered rather than inventing a baseline', () => {
    const r = noPre();
    ['enjoyment', 'energy', 'performance', 'want_more'].forEach(id => {
      const row = rowById(r, id);
      expect(row.predicted).toBeNull();
      expect(row.gap).toBeNull();
      expect(row.status).toBe('no_prediction');
      expect(row.lines.join(' ')).toContain('You started without answering the four questions');
    });
  });

  it('still reports what did happen', () => {
    const r = noPre();
    expect(rowById(r, 'enjoyment').actual).toBe(6);
    expect(rowById(r, 'energy').lines).toContain('You finished at 3.');
    expect(rowById(r, 'performance').lines.join(' ')).toMatch(/of the five checks passed/);
  });

  it('handles a measurement row that does not exist at all', () => {
    const r = buildWorkSimReadout(baseRun(), null);
    expect(rowById(r, 'energy').status).toBe('no_outcome');
    expect(rowById(r, 'energy').lines.join(' ')).toContain('did not answer the question about energy');
  });
});

describe('the degraded path, when the two model criteria are missing', () => {
  const degraded = () => buildWorkSimReadout(baseRun(), measurement());

  it('counts three of five and never passes three off as five', () => {
    const b = degraded().blocks.checks;
    expect(b.degraded).toBe(true);
    expect(b.scored_count).toBe(3);
    expect(b.total_count).toBe(5);
    expect(b.rows).toHaveLength(3);
    expect(b.model_notes).toHaveLength(0);
  });

  it('names the two it could not score instead of dropping them', () => {
    const b = degraded().blocks.checks;
    expect(b.not_scored.map(x => x.id)).toEqual(['problem_not_feature', 'honest_reply']);
    b.not_scored.forEach(x => expect(x.criterion.length).toBeGreaterThan(20));
  });

  it('changes the Block B note and says the three below are unaffected', () => {
    expect(degraded().blocks.checks.note).toBe(
      'Two of the five checks need a review we could not run just now. The ones below are counted from what you wrote and are not affected by it.'
    );
  });

  it('keeps the performance row, carries no number, and fabricates nothing', () => {
    const p = rowById(degraded(), 'performance');
    expect(p.status).toBe('not_comparable');
    expect(p.actual).toBeNull();
    expect(p.gap).toBeNull();
    expect(p.clears_threshold).toBeNull();
    expect(p.predicted).toBe(8);
    expect(p.lines).toContain('You predicted 8 out of 10.');
    expect(p.lines.join(' ')).toContain('The other two need a review we could not run just now');
    expect(p.facts.not_scored).toBe(2);
  });

  it('scores the performance row on the same 10 point scale once all five are in', () => {
    const run = baseRun();
    const full = buildWorkSimReadout(baseRun({ check_results: fullChecks(run) }), measurement());
    const p = rowById(full, 'performance');
    expect(full.blocks.checks.degraded).toBe(false);
    expect(full.blocks.checks.scored_count).toBe(5);
    expect(full.blocks.checks.model_notes).toHaveLength(2);
    expect(p.facts.passed).toBe(4);
    expect(p.actual).toBe(8);
    expect(p.facts.actual_is_derived).toBe(true);
    expect(p.status).toBe('no_gap');
    expect(p.lines.join(' ')).toContain('Four of the five checks passed, which is 8 on the same scale.');
  });

  it('prefers a stored performance score over one worked out from the checks', () => {
    const run = baseRun();
    const r = buildWorkSimReadout(
      baseRun({ check_results: fullChecks(run) }),
      measurement({ system_performance_score: 5 })
    );
    const p = rowById(r, 'performance');
    expect(p.actual).toBe(5);
    expect(p.facts.actual_is_derived).toBe(false);
    expect(p.gap).toBe(-3);
    expect(p.status).toBe('gap');
  });

  it('labels the model rows as a reader\'s note rather than a score', () => {
    const run = baseRun();
    const b = buildWorkSimReadout(baseRun({ check_results: fullChecks(run) }), measurement()).blocks.checks;
    expect(b.model_notes_label).toBe("A reader's note, not a score");
    expect(b.model_notes.map(x => x.scored_by)).toEqual(['model', 'model']);
    expect(b.rows.every(x => x.scored_by === 'checks')).toBe(true);
  });
});

describe('Block B, the three we counted', () => {
  it('puts the fact under every check it reports', () => {
    const b = buildWorkSimReadout(baseRun(), measurement()).blocks.checks;
    expect(b.rows.map(x => x.id)).toEqual(['plan_fits_capacity', 'non_goals_present', 'revision_changed_plan']);
    b.rows.forEach(x => {
      expect(x.evidence.source).toBe('checks');
      expect(x.evidence.text.length).toBeGreaterThan(10);
      expect(x.falsifier).toBeTruthy();
    });
  });

  it('prints the sprint arithmetic with the real point totals', () => {
    const b = buildWorkSimReadout(baseRun(), measurement()).blocks.checks;
    const capacity = b.rows.find(x => x.id === 'plan_fits_capacity');
    expect(capacity.evidence.text).toContain('6 points against a capacity of 6');
    expect(capacity.passed).toBe(true);
  });

  it('quotes the student back on the non-goals check', () => {
    const b = buildWorkSimReadout(baseRun(), measurement()).blocks.checks;
    const nonGoals = b.rows.find(x => x.id === 'non_goals_present');
    expect(nonGoals.evidence.text).toContain('Recurring jobs, the error copy rewrite');
  });

  it('reports nothing at all rather than an empty check when the run has no results', () => {
    const b = buildWorkSimReadout(baseRun({ check_results: [] }), measurement()).blocks.checks;
    expect(b.rows).toHaveLength(0);
    expect(b.not_scored).toHaveLength(5);
    expect(b.scored_count).toBe(0);
    expect(b.total_count).toBe(5);
  });
});

describe('Block C, the practitioner comparison nobody has written yet', () => {
  it('degrades visibly rather than disappearing', () => {
    const c = buildWorkSimReadout(baseRun(), measurement()).blocks.comparison;
    expect(c.available).toBe(false);
    expect(c.reference).toBeNull();
    expect(c.intro).toBeNull();
    expect(c.missing.reason).toBe('not_written');
    expect(c.missing.body).toContain('nobody has written it');
    expect(c.missing.body).toContain('empty rather than filled in with ours');
  });

  it('still shows the student their own spec while the other half is missing', () => {
    const c = buildWorkSimReadout(baseRun(), measurement()).blocks.comparison;
    expect(c.student_spec.source).toBe('student');
    expect(c.student_spec.text).toBe(SPEC_V2);
  });

  it('falls back to version one when the run never reached the revision', () => {
    const c = buildWorkSimReadout(baseRun({ spec_v2: '' }), measurement()).blocks.comparison;
    expect(c.student_spec.text).toBe(SPEC_V1);
  });

  it('carries no student spec when nothing was written', () => {
    const c = buildWorkSimReadout(baseRun({ spec_v1: '', spec_v2: '' }), measurement()).blocks.comparison;
    expect(c.student_spec).toBeNull();
  });

  it('takes a reference spec the day somebody writes one, with no code change', () => {
    const reference = {
      author: 'A named product manager',
      role: 'Product manager, scheduling software',
      text: 'The problem\nTechnicians drive to jobs twice.\n\nWhat we are not doing\nRecurring jobs.',
    };
    const c = buildWorkSimReadout(baseRun(), measurement(), { reference }).blocks.comparison;
    expect(c.available).toBe(true);
    expect(c.missing).toBeNull();
    expect(c.reference.text).toBe(reference.text);
    expect(c.reference.author).toBe('A named product manager');
    expect(c.intro).toContain('This is not a right answer.');
    expect(c.intro).toContain('seven items');
    expect(c.intro).toContain('six points');
  });

  it('reads a reference spec off the simulation content when it lives there', () => {
    const sim = { ...NORTHGATE_PM, reference_spec: { author: 'Somebody', role: 'PM', text: 'A spec.' } };
    const c = buildWorkSimReadout(baseRun(), measurement(), { sim }).blocks.comparison;
    expect(c.available).toBe(true);
    expect(c.reference.text).toBe('A spec.');
  });

  it('treats an empty reference as no reference rather than a blank panel', () => {
    const c = buildWorkSimReadout(baseRun(), measurement(), { reference: { text: '   ' } }).blocks.comparison;
    expect(c.available).toBe(false);
    expect(c.missing.reason).toBe('not_written');
  });
});

describe('Block D, which is never conditional', () => {
  const cases = [
    ['a clean run', baseRun(), measurement()],
    ['an abandoned run', baseRun({ status: 'abandoned', abandoned_at_step: 3, check_results: [] }), {}],
    ['nothing at all', null, null],
  ];

  cases.forEach(([name, run, m]) => {
    it(`is present and word for word the same on ${name}`, () => {
      const d = buildWorkSimReadout(run, m).blocks.limits;
      expect(d.heading).toBe(LIMITS_BLOCK.heading);
      expect(d.body).toBe(LIMITS_BLOCK.body);
      expect(d.body).toContain('It does not tell you whether you would be good at the job');
      expect(d.body).toContain('do another one that is nothing like it');
    });
  });
});

describe('an abandoned run', () => {
  const run = baseRun({
    status: 'abandoned',
    abandoned_at_step: 4,
    spec_v2: '',
    engineer_reply: '',
    sales_reply: '',
    selected_items_final: undefined,
    check_results: [],
    experience_samples: [{ at_step: 2, score: 8, skipped: false, sampled_at: '2026-08-14T13:11:00.000Z' }],
  });

  it('says where it stopped instead of pretending it finished', () => {
    const r = buildWorkSimReadout(run, measurement({ actual_energy: undefined, desire_to_repeat: undefined }));
    expect(r.status).toBe('abandoned');
    expect(r.complete).toBe(false);
    expect(r.note).toBe('You stopped at step 4 of five, so most of this is empty. What you did answer is below.');
  });

  it('keeps the sample that was taken before the student left', () => {
    const e = rowById(buildWorkSimReadout(run, measurement()), 'enjoyment');
    expect(e.facts.samples_taken).toBe(1);
    expect(e.actual).toBe(8);
    expect(e.lines).toContain('After you cut the list you said 8.');
  });

  it('leaves the rows it has no answer for empty rather than filled in', () => {
    const r = buildWorkSimReadout(run, measurement({ actual_energy: undefined }));
    expect(rowById(r, 'energy').status).toBe('no_outcome');
    expect(rowById(r, 'energy').actual).toBeNull();
    expect(r.blocks.checks.not_scored).toHaveLength(5);
  });

  it('says so without a step number when the row never recorded one', () => {
    const r = buildWorkSimReadout({ status: 'abandoned' }, null);
    expect(r.note).toBe('You stopped before the end, so most of this is empty. What you did answer is below.');
  });

  it('marks a run still in progress as unfinished', () => {
    const r = buildWorkSimReadout({ status: 'in_progress', current_step: 2 }, null);
    expect(r.status).toBe('in_progress');
    expect(r.complete).toBe(false);
    expect(r.note).toContain('not finished');
  });
});

describe('wanting another one, where what you did outranks what you said', () => {
  it('reports predicted yes against never starting another, and does not scold', () => {
    const w = rowById(buildWorkSimReadout(baseRun(), measurement()), 'want_more');
    expect(w.predicted_text).toBe('yes');
    expect(w.facts.started_another).toBe(false);
    expect(w.status).toBe('gap');
    expect(w.threshold_applies).toBe(false);
    expect(w.clears_threshold).toBeNull();
    expect(w.lines).toContain('You predicted yes.');
    expect(w.lines).toContain('You have not started another one.');
    expect(w.lines).toContain('That is not a criticism. It is why this counts what you did rather than what you said.');
  });

  it('keeps the stated answer and the behaviour apart and never averages them', () => {
    const w = rowById(buildWorkSimReadout(baseRun(), measurement()), 'want_more');
    expect(w.facts.predicted).toBe(9);
    expect(w.facts.stated_afterwards).toBe(5);
    expect(w.facts.stated_afterwards_word).toBe('not sure');
    expect(w.lines).toContain('Afterwards you said not sure.');
    expect(w.actual).toBeNull();
  });

  it('reports predicted yes and started another as no gap, with the date', () => {
    const run = baseRun({ started_another_at: '2026-08-18T09:00:00.000Z' });
    const w = rowById(buildWorkSimReadout(run, measurement()), 'want_more');
    expect(w.status).toBe('no_gap');
    expect(w.facts.started_another).toBe(true);
    expect(w.lines).toContain('You started another one on August 18.');
    expect(w.lines).toContain('You called this one.');
  });

  it('reports predicted no and started another anyway', () => {
    const run = baseRun({ started_another_at: '2026-08-18T09:00:00.000Z' });
    const w = rowById(buildWorkSimReadout(run, measurement({ expected_want_more: 2 })), 'want_more');
    expect(w.predicted_text).toBe('no');
    expect(w.status).toBe('gap');
    expect(w.lines).toContain('You did it anyway. What you did is the half we count.');
  });

  it('reads not sure as its own answer, so a middling prediction is not a yes', () => {
    const w = rowById(buildWorkSimReadout(baseRun(), measurement({ expected_want_more: 5 })), 'want_more');
    expect(w.predicted_text).toBe('not sure');
    expect(w.status).toBe('no_gap');
    expect(w.lines).toContain('You have not started another one.');
  });
});

// ---------------------------------------------------------------------------
// The anti-horoscope rules, asserted directly.
// ---------------------------------------------------------------------------

const EVERY_CASE = () => {
  const clean = baseRun();
  return [
    ['finished, degraded checks', clean, measurement()],
    ['finished, all five scored', baseRun({ check_results: fullChecks(clean) }), measurement()],
    ['no pre measurement', clean, { actual_energy: 3 }],
    ['no measurement at all', clean, null],
    ['both samples skipped', baseRun({
      experience_samples: [
        { at_step: 2, skipped: true },
        { at_step: 4, skipped: true },
      ],
    }), measurement({ actual_enjoyment: undefined })],
    ['abandoned', baseRun({ status: 'abandoned', abandoned_at_step: 2, check_results: [] }), { expected_enjoyment: 7 }],
    ['started another', baseRun({ started_another_at: '2026-08-18T09:00:00.000Z' }), measurement()],
    ['under threshold everywhere', clean, measurement({ expected_energy: 3, actual_energy: 3, expected_enjoyment: 6 })],
    ['empty everything', {}, {}],
    ['nothing at all', null, null],
  ];
};

describe('rule 4, no trait adjective and no fit score anywhere in the copy', () => {
  EVERY_CASE().forEach(([name, run, m]) => {
    it(`writes no trait language on the ${name} read-out`, () => {
      const r = buildWorkSimReadout(run, m);
      expect(findBannedLanguage(r)).toEqual([]);
    });
  });

  it('fails when a trait adjective is planted in the copy', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    r.blocks.predictions.rows[0].lines.push('You are decisive under pressure.');
    const found = findBannedLanguage(r);
    expect(found.map(f => f.term)).toContain('decisive');
    expect(found.map(f => f.term)).toContain('you are');
  });

  it('fails when the word fit is planted in the copy', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    r.blocks.limits.body = 'This is a strong fit for you.';
    expect(findBannedLanguage(r).map(f => f.term)).toContain('the word fit');
  });

  it('checks every one of the banned words, not a sample of them', () => {
    BANNED_TRAIT_WORDS.forEach(word => {
      const r = buildWorkSimReadout(baseRun(), measurement());
      r.blocks.checks.note = `Something ${word} about this.`;
      expect(findBannedLanguage(r).map(f => f.term)).toContain(word);
    });
  });

  it('lets a sprint fit its capacity, because that is arithmetic and not a person', () => {
    expect(findBannedLanguage({ a: 'Your final sprint is 6 points against a capacity of 6. It fits.' })).toEqual([]);
  });

  it('exempts what the student wrote, because we quote it verbatim', () => {
    const run = baseRun({ spec_v2: `${SPEC_V2}\n\nI think this is a good fit for me and I am naturally decisive.` });
    const r = buildWorkSimReadout(run, measurement());
    expect(findBannedLanguage(r)).toEqual([]);
    expect(r.blocks.comparison.student_spec.text).toContain('good fit for me');
  });

  it('exempts a check detail, which quotes the student back at them', () => {
    const run = baseRun({
      check_results: [
        {
          criterion: 'non_goals_present',
          passed: true,
          detail: 'Under "What we are not doing" you wrote: "no recurring jobs, that is not a fit for this sprint"',
          scored_by: 'checks',
        },
      ],
    });
    expect(findBannedLanguage(buildWorkSimReadout(run, measurement()))).toEqual([]);
  });
});

describe('rules 1 and 3, no claim without a number under it and something that would overturn it', () => {
  EVERY_CASE().forEach(([name, run, m]) => {
    it(`carries a falsifier and facts on every row of the ${name} read-out`, () => {
      const r = buildWorkSimReadout(run, m);
      r.blocks.predictions.rows.forEach(row => {
        expect(row.falsifier).toBeTruthy();
        expect(Object.keys(row.facts).length).toBeGreaterThan(0);
        if (row.status === 'gap' || row.status === 'no_gap') {
          expect(row.lines.length).toBeGreaterThan(0);
          expect(row.predicted !== null || row.predicted_text !== null).toBe(true);
        }
      });
    });
  });

  it('throws rather than shipping a check with nothing under it', () => {
    const run = baseRun({
      check_results: [{ criterion: 'plan_fits_capacity', passed: true, detail: '', scored_by: 'checks' }],
    });
    expect(() => buildWorkSimReadout(run, measurement())).toThrow(/no fact under it/);
  });

  it('throws rather than shipping copy that broke the rules', () => {
    const sim = {
      ...NORTHGATE_PM,
      rubric: NORTHGATE_PM.rubric.map(x =>
        x.id === 'plan_fits_capacity' ? { ...x, criterion: 'The student is a good fit for this work.' } : x
      ),
    };
    expect(() => buildWorkSimReadout(baseRun(), measurement(), { sim })).toThrow(/broke its own rules/);
  });
});

describe('rule 5, it can say we do not know', () => {
  it('never prints a performance number it did not have', () => {
    EVERY_CASE().forEach(([, run, m]) => {
      const p = rowById(buildWorkSimReadout(run, m), 'performance');
      if (p.actual === null) {
        expect(p.lines.join(' ')).not.toMatch(/on the same scale/);
        expect(p.gap).toBeNull();
      }
    });
  });

  it('keeps the performance row in place on every read-out, scored or not', () => {
    EVERY_CASE().forEach(([, run, m]) => {
      expect(rowById(buildWorkSimReadout(run, m), 'performance')).toBeTruthy();
    });
  });

  it('never claims five checks when three ran', () => {
    const r = buildWorkSimReadout(baseRun(), measurement());
    expect(r.blocks.checks.scored_count).toBe(3);
    expect(r.blocks.checks.total_count).toBe(5);
    expect(allText(r)).not.toMatch(/five of the five/i);
  });
});

describe('the house rules the whole repo runs on', () => {
  it('puts no long dash in any string it returns, quoted text included', () => {
    EVERY_CASE().forEach(([name, run, m]) => {
      everyString(buildWorkSimReadout(run, m)).forEach(s => {
        expect(s, `${name}: ${s}`).not.toMatch(new RegExp('[\\u2014\\u2013]'));
      });
    });
  });

  it('never says "you are" or "you\'re" about the student', () => {
    EVERY_CASE().forEach(([, run, m]) => {
      const t = allText(buildWorkSimReadout(run, m));
      expect(t).not.toMatch(/\byou are\b/i);
      expect(t).not.toMatch(/\byou're\b/i);
    });
  });

  it('puts no percentage in copy we wrote', () => {
    EVERY_CASE().forEach(([, run, m]) => {
      expect(allText(buildWorkSimReadout(run, m))).not.toContain('%');
    });
  });

  it('recommends no career and reaches no verdict', () => {
    EVERY_CASE().forEach(([, run, m]) => {
      const t = allText(buildWorkSimReadout(run, m)).toLowerCase();
      expect(t).not.toContain('you should become');
      expect(t).not.toContain('right career');
      expect(t).not.toContain('recommend');
    });
  });

  it('calls no model, reads no clock, and returns the same thing twice', () => {
    const a = JSON.stringify(buildWorkSimReadout(baseRun(), measurement()));
    const b = JSON.stringify(buildWorkSimReadout(baseRun(), measurement()));
    expect(a).toBe(b);
  });

  it('does not mutate the row or the measurement it was handed', () => {
    const run = baseRun();
    const m = measurement();
    const before = [JSON.stringify(run), JSON.stringify(m)];
    buildWorkSimReadout(run, m);
    expect([JSON.stringify(run), JSON.stringify(m)]).toEqual(before);
  });
});
