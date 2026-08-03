import { describe, it, expect } from 'vitest';
import { activityFor } from '@/lib/weekly-activity';

// Week of Monday 27 July 2026. Sunday 2 August is its last day; Monday 3 August
// starts the next one. Monday 20 July starts the week before.
const PREV_WEEK = '2026-07-20';
const WEEK = '2026-07-27';
const NEXT_WEEK = '2026-08-03';
const EXP = 'exp-1';

// 22:00 Sunday 2 Aug in New York. Base44 hands this back without the Z, and a
// Z-less string is parsed by `new Date()` as LOCAL time — four hours late, which
// is enough to push Sunday evening into Monday.
const SUNDAY_NIGHT = '2026-08-03T02:00:00.000000';
// The real 2026-08-01 backfill: it bumped updated_date on all seven production
// missions within a second of each other, whatever week the work was done in.
const BACKFILL = '2026-08-01T04:23:19.626000';

const mission = (over = {}) => ({
  id: 'm1', title: 'Interview an analyst', experiment_id: EXP, status: 'completed',
  created_date: '2026-07-28T14:00:00.000000',
  updated_date: '2026-07-28T14:00:00.000000',
  completed_at: '2026-07-29T15:00:00.000000',
  ...over,
});

const labels = (data, week) => activityFor(data, EXP, week).map(i => i.label);

describe('activityFor — which week a completed mission belongs to', () => {
  // Defect 1. updated_date is bumped by ANY later edit, so it is not a record of
  // when anything was completed.
  it('does not let a later edit move a mission into the edit\'s week', () => {
    const m = mission({
      completed_at: '2026-07-29T15:00:00.000000',  // Wednesday, week of the 27th
      updated_date: '2026-08-12T18:00:00.000000',  // edited a fortnight later
    });
    expect(labels({ missions: [m] }, WEEK)).toEqual(['Interview an analyst']);
    expect(labels({ missions: [m] }, '2026-08-10')).toEqual([]);
  });

  it('survives the 2026-08-01 backfill that touched every mission at once', () => {
    const m = mission({
      created_date: '2026-07-22T14:00:00.000000',   // week of the 20th
      completed_at: '2026-07-22T15:00:00.000000',   // completed that same week
      updated_date: BACKFILL,                       // week of the 27th
    });
    expect(labels({ missions: [m] }, PREV_WEEK)).toEqual(['Interview an analyst']);
    expect(labels({ missions: [m] }, WEEK)).toEqual([]);
  });

  it('falls back to created_date, not updated_date, for a row with no completed_at', () => {
    const m = mission({
      completed_at: undefined,
      created_date: '2026-07-29T15:00:00.000000',   // week of the 27th
      updated_date: BACKFILL,                        // also week of the 27th…
    });
    expect(labels({ missions: [m] }, WEEK)).toEqual(['Interview an analyst']);

    // …and the same row when the bump lands in a different week entirely.
    const bumped = mission({
      completed_at: undefined,
      created_date: '2026-07-22T15:00:00.000000',   // week of the 20th
      updated_date: BACKFILL,                        // week of the 27th
    });
    expect(labels({ missions: [bumped] }, PREV_WEEK)).toEqual(['Interview an analyst']);
    expect(labels({ missions: [bumped] }, WEEK)).toEqual([]);
  });

  // Defect 2. A Z-less UTC string read as local time lands four hours late.
  it('files a Sunday-evening completion under the week that is ending', () => {
    const m = mission({
      completed_at: SUNDAY_NIGHT,
      updated_date: SUNDAY_NIGHT,
      created_date: SUNDAY_NIGHT,
    });
    expect(labels({ missions: [m] }, WEEK)).toEqual(['Interview an analyst']);
    expect(labels({ missions: [m] }, NEXT_WEEK)).toEqual([]);
  });

  it('gets the same answer whether or not the timestamp carries its Z', () => {
    const naive = mission({ completed_at: SUNDAY_NIGHT, updated_date: SUNDAY_NIGHT, created_date: SUNDAY_NIGHT });
    const zulu = mission({ completed_at: '2026-08-03T02:00:00.000Z', updated_date: '2026-08-03T02:00:00.000Z', created_date: '2026-08-03T02:00:00.000Z' });
    expect(labels({ missions: [naive] }, WEEK)).toEqual(labels({ missions: [zulu] }, WEEK));
    expect(labels({ missions: [naive] }, NEXT_WEEK)).toEqual(labels({ missions: [zulu] }, NEXT_WEEK));
    expect(labels({ missions: [zulu] }, WEEK)).toEqual(['Interview an analyst']);
  });

  it('leaves a mission that is not completed out of the read-out', () => {
    expect(labels({ missions: [mission({ status: 'planned' })] }, WEEK)).toEqual([]);
  });

  it('leaves out a soft-deleted mission and one from another experiment', () => {
    const deleted = mission({ id: 'm2', title: 'Deleted', deletion_status: 'deleted' });
    const other = mission({ id: 'm3', title: 'Other experiment', experiment_id: 'exp-2' });
    expect(labels({ missions: [deleted, other] }, WEEK)).toEqual([]);
  });
});

describe('activityFor — proof and outreach', () => {
  it('files a Sunday-evening proof under the week that is ending', () => {
    const p = { id: 'p1', title: 'Call notes', experiment_id: EXP, created_date: SUNDAY_NIGHT };
    expect(labels({ proofs: [p] }, WEEK)).toEqual(['Call notes']);
    expect(labels({ proofs: [p] }, NEXT_WEEK)).toEqual([]);
  });

  it('reads a date-only completed_at as that calendar day', () => {
    // ProofOfWork.completed_at is written date-only by mission-completion.js.
    const p = { id: 'p1', title: 'Call notes', experiment_id: EXP, completed_at: '2026-08-02', created_date: BACKFILL };
    expect(labels({ proofs: [p] }, WEEK)).toEqual(['Call notes']);
    expect(labels({ proofs: [p] }, NEXT_WEEK)).toEqual([]);
  });

  it('files a Sunday-evening contact under the week that is ending', () => {
    const c = { id: 'c1', name: 'Ada', company: 'Acme', experiment_id: EXP, last_contacted_date: SUNDAY_NIGHT };
    expect(labels({ outreach: [c] }, WEEK)).toEqual(['Ada — Acme']);
    expect(labels({ outreach: [c] }, NEXT_WEEK)).toEqual([]);
  });

  it('names a contact with no company by name alone', () => {
    const c = { id: 'c1', name: 'Ada', experiment_id: EXP, date_contacted: '2026-07-29T15:00:00.000000' };
    expect(labels({ outreach: [c] }, WEEK)).toEqual(['Ada']);
  });
});

describe('activityFor — nothing to show', () => {
  it('returns nothing without an experiment or a week', () => {
    expect(activityFor({ missions: [mission()] }, '', WEEK)).toEqual([]);
    expect(activityFor({ missions: [mission()] }, EXP, '')).toEqual([]);
  });

  it('drops an item with no label rather than rendering a blank row', () => {
    expect(activityFor({ missions: [mission({ title: '' })] }, EXP, WEEK)).toEqual([]);
  });
});
