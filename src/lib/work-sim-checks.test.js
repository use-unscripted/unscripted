import { describe, it, expect } from 'vitest';
import {
  checkRevisedCapacity,
  checkNonGoals,
  checkRevisionChanged,
  runWorkSimChecks,
  pointsFor,
  REVISION_CHANGE_THRESHOLD,
} from './work-sim-checks';
import { NORTHGATE_PM } from './work-sims/northgate-pm';

const spec = ({ notDoing = 'Recurring jobs. Bulk reschedule. The export.', doing = 'Fixing the duplicate job bug in the sync job.', success = 'Duplicate rate back under 2.1% within a month.' } = {}) => [
  'The problem',
  'Duplicate jobs are landing on technician schedules. 11 tickets in 4 days.',
  '',
  'Who it is for',
  'Dispatchers at small home services companies.',
  '',
  'What we are doing',
  doing,
  '',
  'What we are not doing',
  notDoing,
  '',
  'How we will know it worked',
  success,
].join('\n');

describe('the simulation content the checks depend on', () => {
  it('has seven items worth 19 points against a capacity of 6', () => {
    const items = NORTHGATE_PM.backlog.items;
    expect(items).toHaveLength(7);
    expect(items.reduce((n, i) => n + i.points, 0)).toBe(19);
    expect(NORTHGATE_PM.backlog.capacity).toBe(6);
  });

  it('re-estimates the duplicate fix from 2 points to 5 in the revision', () => {
    expect(NORTHGATE_PM.backlog.items.find(i => i.id === 'duplicate_jobs').points).toBe(2);
    expect(pointsFor('duplicate_jobs')).toBe(5);
    expect(pointsFor('bulk_reschedule')).toBe(3);
  });

  it('carries five criteria, three of which are scored without a model', () => {
    expect(NORTHGATE_PM.rubric).toHaveLength(5);
    expect(NORTHGATE_PM.rubric.filter(r => r.scored_by === 'checks').map(r => r.id)).toEqual([
      'plan_fits_capacity',
      'non_goals_present',
      'revision_changed_plan',
    ]);
  });

  it('interpolates nothing and calls nothing', () => {
    const json = JSON.stringify(NORTHGATE_PM);
    expect(json).not.toMatch(/\$\{/);
    expect(json).not.toMatch(/InvokeLLM/);
  });
});

describe('whether the final plan fits the revised capacity', () => {
  it('passes a sprint that lands exactly on capacity, and prints both numbers', () => {
    const r = checkRevisedCapacity({ selected_items_final: ['duplicate_jobs', 'late_booking_date'] });
    expect(r.passed).toBe(true);
    expect(r.criterion).toBe('plan_fits_capacity');
    expect(r.scored_by).toBe('checks');
    expect(r.detail).toContain('6 points against a capacity of 6');
    expect(r.detail).toContain('It fits.');
  });

  it('counts the revised 5 point estimate, not the 2 points from standup', () => {
    const r = checkRevisedCapacity({ selected_items_final: ['duplicate_jobs'] });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('5 points against a capacity of 6');
  });

  it('fails a sprint that is over, and says by how much', () => {
    const r = checkRevisedCapacity({ selected_items_final: ['duplicate_jobs', 'bulk_reschedule'] });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('8 points against a capacity of 6');
    expect(r.detail).toContain('2 over');
  });

  it('uses the singular when the sprint is one point', () => {
    const r = checkRevisedCapacity({ selected_items_final: ['late_booking_date'] });
    expect(r.detail).toContain('1 point against a capacity of 6');
  });

  it('fails an empty final selection rather than passing zero against six', () => {
    const r = checkRevisedCapacity({ selected_items: ['duplicate_jobs'], selected_items_final: [] });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('Nothing was selected');
  });

  it('fails when nothing was ever selected', () => {
    expect(checkRevisedCapacity({}).passed).toBe(false);
  });

  it('falls back to the pre-revision selection only when there is no final one', () => {
    const r = checkRevisedCapacity({ selected_items: ['save_error_copy'] });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('Rewrite the error people see when a job will not save (1)');
  });

  it('ignores ids that are not on the backlog and names them', () => {
    const r = checkRevisedCapacity({ selected_items_final: ['save_error_copy', 'made_up_thing'] });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('1 point against a capacity of 6');
    expect(r.detail).toContain('made_up_thing');
  });
});

describe('whether the spec says what is not being done', () => {
  it('passes when the heading has something under it, and quotes it back', () => {
    const r = checkNonGoals({ spec_v2: spec() });
    expect(r.passed).toBe(true);
    expect(r.criterion).toBe('non_goals_present');
    expect(r.detail).toContain('Recurring jobs. Bulk reschedule. The export.');
  });

  it('fails when the heading is there with nothing under it', () => {
    const r = checkNonGoals({ spec_v2: spec({ notDoing: '' }) });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('nothing written under it');
  });

  it('fails when the heading is there and the line under it is only whitespace', () => {
    const r = checkNonGoals({ spec_v2: spec({ notDoing: '   \n  ' }) });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('nothing written under it');
  });

  it('fails when a bullet marker is all that was left under the heading', () => {
    const r = checkNonGoals({ spec_v2: spec({ notDoing: '-' }) });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('nothing written under it');
  });

  it('fails when the heading was deleted altogether', () => {
    const text = spec().replace('What we are not doing\nRecurring jobs. Bulk reschedule. The export.\n\n', '');
    const r = checkNonGoals({ spec_v2: text });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('no "What we are not doing" section');
  });

  it('reads the heading through markdown marks and a trailing colon', () => {
    const text = spec().replace('What we are not doing', '## **What we are not doing:**');
    expect(checkNonGoals({ spec_v2: text }).passed).toBe(true);
  });

  it('joins content that runs over several lines and stops at the next heading', () => {
    const text = spec({ notDoing: 'Recurring jobs.\nBulk reschedule.' });
    const r = checkNonGoals({ spec_v2: text });
    expect(r.detail).toContain('Recurring jobs. Bulk reschedule.');
    expect(r.detail).not.toContain('Duplicate rate back under');
  });

  it('reads the second version in preference to the first', () => {
    const r = checkNonGoals({
      spec_v1: spec({ notDoing: 'the first answer' }),
      spec_v2: spec({ notDoing: 'the second answer' }),
    });
    expect(r.detail).toContain('the second answer');
    expect(r.detail).not.toContain('the first answer');
  });

  it('falls back to the first version when the run never reached the revision', () => {
    const r = checkNonGoals({ spec_v1: spec({ notDoing: 'the first answer' }) });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('the first answer');
  });

  it('fails on an empty spec', () => {
    expect(checkNonGoals({}).passed).toBe(false);
  });
});

describe('whether the revision changed the plan or only restated it', () => {
  const v1 = spec();

  it('fails when there is no second version', () => {
    const r = checkRevisionChanged({ spec_v1: v1 });
    expect(r.passed).toBe(false);
    expect(r.criterion).toBe('revision_changed_plan');
    expect(r.detail).toContain('no second version');
  });

  it('fails when the second version is word for word the first', () => {
    const r = checkRevisionChanged({ spec_v1: v1, spec_v2: v1 });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('word for word');
  });

  it('fails when the second version is the same plan in different words', () => {
    const reworded = v1
      .replace('Duplicate jobs are landing', 'Duplicate jobs keep landing')
      .replace('Fixing the duplicate job bug', 'We are going to fix the duplicate job bug');
    const r = checkRevisionChanged({ spec_v1: v1, spec_v2: reworded });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('wording moved more than the plan did');
  });

  it('passes when the spec was genuinely reworked, with the same items in the sprint', () => {
    const reworked = spec({
      doing: 'The sync job rewrite came in at 5 points and the sprint holds 6, so the duplicate fix is the whole sprint and the error message copy comes back out.',
      notDoing: 'Recurring jobs, and no date goes to Calder. Bulk reschedule. The export. The photo upload.',
      success: 'Duplicate rate back under 2.1% within a month, read off the weekly ops report, plus the reopened ticket count.',
    });
    const r = checkRevisionChanged({ spec_v1: v1, spec_v2: reworked });
    expect(r.passed).toBe(true);
    expect(r.detail).toMatch(/\d+ words of the spec changed/);
  });

  // The read-out bans percentages, and a check detail is the one place copy we
  // wrote reaches a student without going through that guard, because the same
  // string may be quoting the student's own spec back at them.
  it('puts no percentage in front of a student, on any branch', () => {
    const cases = [
      checkRevisionChanged({ spec_v1: v1, spec_v2: '' }),
      checkRevisionChanged({ spec_v1: v1, spec_v2: v1 }),
      checkRevisionChanged({ spec_v1: v1, spec_v2: spec({ doing: 'Only the duplicate job bug, nothing else at all this sprint.' }) }),
      checkRevisionChanged({
        spec_v1: v1,
        spec_v2: spec({ doing: 'Fixing the duplicate job bug in the sync job, and nothing else.' }),
        selected_items: ['duplicate_jobs', 'bulk_reschedule'],
        selected_items_final: ['duplicate_jobs'],
      }),
    ];
    cases.forEach(r => expect(r.detail).not.toContain('%'));
  });

  it('passes on a changed sprint and names what came out of it', () => {
    const r = checkRevisionChanged({
      spec_v1: v1,
      spec_v2: spec({ doing: 'Fixing the duplicate job bug in the sync job, and nothing else.' }),
      selected_items: ['duplicate_jobs', 'bulk_reschedule', 'save_error_copy'],
      selected_items_final: ['duplicate_jobs', 'save_error_copy'],
    });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('took out Move a whole day of jobs at once');
  });

  it('passes on a changed sprint even when the spec text never moved', () => {
    const r = checkRevisionChanged({
      spec_v1: v1,
      spec_v2: v1,
      selected_items: ['duplicate_jobs', 'bulk_reschedule'],
      selected_items_final: ['duplicate_jobs'],
    });
    expect(r.passed).toBe(true);
    expect(r.detail).toContain('took out');
  });

  it('does not read an unchanged sprint as a change', () => {
    const r = checkRevisionChanged({
      spec_v1: v1,
      spec_v2: v1,
      selected_items: ['duplicate_jobs', 'save_error_copy'],
      selected_items_final: ['save_error_copy', 'duplicate_jobs'],
    });
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('word for word');
  });

  it('holds the threshold it says it holds', () => {
    expect(REVISION_CHANGE_THRESHOLD).toBe(0.15);
  });
});

describe('the three checks together', () => {
  it('returns one row per criterion, all of them scored without a model', () => {
    const rows = runWorkSimChecks({
      spec_v1: spec(),
      spec_v2: spec({ notDoing: 'Recurring jobs, and no date for Calder. Bulk reschedule. The export.' }),
      selected_items: ['duplicate_jobs', 'bulk_reschedule'],
      selected_items_final: ['duplicate_jobs', 'save_error_copy'],
    });
    expect(rows.map(r => r.criterion)).toEqual([
      'plan_fits_capacity',
      'non_goals_present',
      'revision_changed_plan',
    ]);
    expect(rows.every(r => r.scored_by === 'checks')).toBe(true);
    expect(rows.every(r => typeof r.passed === 'boolean' && r.detail.length > 0)).toBe(true);
  });

  it('still returns three rows for a run that was abandoned with nothing written', () => {
    const rows = runWorkSimChecks({});
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.passed === false)).toBe(true);
  });

  // The two dashes below are the only ones in this file and they are inside the
  // assertion that bans them, the same exception llm.js already holds. Nothing
  // in a test file reaches the bundle, so the project's count of 2 is unaffected.
  it('puts no dash of either kind in anything a student reads', () => {
    const rows = runWorkSimChecks({
      spec_v1: spec(),
      spec_v2: spec({ notDoing: 'Recurring jobs.' }),
      selected_items_final: ['duplicate_jobs', 'late_booking_date'],
    });
    rows.forEach(r => expect(r.detail).not.toMatch(/[—–]/));
    expect(JSON.stringify(NORTHGATE_PM)).not.toMatch(/[—–]/);
  });
});
