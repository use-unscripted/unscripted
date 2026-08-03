import { describe, it, expect } from 'vitest';
import { filterEvidence, DEFAULT_FILTERS } from '@/lib/evidence-library';

// The From/To controls are <input type="date">, so the student is naming their
// own local calendar days. `item.date` is an entity timestamp, which Base44
// returns as UTC with no `Z` on it.
const item = (date) => ({
  id: 'e1', title: 'Call notes', date, type: 'other', pathName: '', cycleId: '',
  experimentId: '', experimentTitle: '', missionId: '', missionTitle: '',
  skills: [], visibility: 'private', resumeStatus: 'not_reviewed',
});

const ids = (items, over) => filterEvidence(items, { ...DEFAULT_FILTERS, ...over }).map(i => i.id);

describe('filterEvidence: date range', () => {
  it('keeps work logged in the evening of the last day in the range', () => {
    // 21:00 Friday 31 July in New York = 2026-08-01T01:00:00Z.
    const evening = item('2026-08-01T01:00:00.000000');
    expect(ids([evening], { to: '2026-07-31' })).toEqual(['e1']);
    expect(ids([evening], { from: '2026-07-31', to: '2026-07-31' })).toEqual(['e1']);
  });

  it('keeps work logged in the small hours of the first day in the range', () => {
    // 00:30 Wednesday 29 July in New York = 2026-07-29T04:30:00Z.
    const earlyHours = item('2026-07-29T04:30:00.000000');
    expect(ids([earlyHours], { from: '2026-07-29' })).toEqual(['e1']);
  });

  it('still excludes what falls outside the range', () => {
    const before = item('2026-07-30T16:00:00.000000');
    const after = item('2026-08-02T16:00:00.000000');
    expect(ids([before], { from: '2026-07-31' })).toEqual([]);
    expect(ids([after], { to: '2026-08-01' })).toEqual([]);
  });

  it('reads a date-only completed_at as that calendar day', () => {
    const dateOnly = item('2026-07-31');
    expect(ids([dateOnly], { from: '2026-07-31', to: '2026-07-31' })).toEqual(['e1']);
    expect(ids([dateOnly], { from: '2026-08-01' })).toEqual([]);
  });

  it('drops an item with no date once a range is set, and keeps it otherwise', () => {
    const undated = item(undefined);
    expect(ids([undated], {})).toEqual(['e1']);
    expect(ids([undated], { from: '2026-07-01' })).toEqual([]);
  });
});
