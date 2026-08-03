/**
 * The stored calendar, which is the only thing standing between a returning
 * student and a blank screen for the length of a feed read.
 *
 * Two rules carry the feature and both are tested here: what comes back out is
 * re-dated to now, so a stored file can never show yesterday's event as if it
 * were still on; and a browser with no usable localStorage degrades to no head
 * start rather than to an error.
 *
 * TZ is pinned to America/New_York by vitest.config.js. That matters: a
 * date-only value like "2026-08-04" is local midnight here and UTC midnight
 * anywhere that gets it wrong, which is a whole day of difference on the one
 * date a student did not choose themselves.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Day placement imports the shared date parser out of campus-events.js, which
// pulls the Base44 client in behind it, and that client reads `window` at
// import time. Same shape as calendar-grid.test.js next door.
vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: { invoke: vi.fn() },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

import {
  stillUpcoming,
  pruneStaleEvents,
  readCampusFeed,
  writeCampusFeed,
  readCampusRanking,
  writeCampusRanking,
  clearCampusStore,
  describeAge,
} from './campus-store';

/** The smallest thing that behaves like localStorage. */
function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    get size() { return map.size; },
  };
}

const NOON = new Date(2026, 7, 4, 12, 0, 0).getTime(); // 2026-08-04, midday

function event(overrides = {}) {
  return { id: 'e1', title: 'Career fair', start: '2026-08-06T17:00:00', end: '', all_day: false, ...overrides };
}

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe('stillUpcoming', () => {
  it('keeps an event later today', () => {
    expect(stillUpcoming(event({ start: '2026-08-04T19:00:00' }), NOON)).toBe(true);
  });

  it('keeps an event that started within the last hour', () => {
    expect(stillUpcoming(event({ start: '2026-08-04T11:30:00' }), NOON)).toBe(true);
  });

  it('drops one that started this morning', () => {
    expect(stillUpcoming(event({ start: '2026-08-04T08:00:00' }), NOON)).toBe(false);
  });

  it('keeps an all-day event for the whole of its own day', () => {
    expect(stillUpcoming(event({ start: '2026-08-04', all_day: true }), NOON)).toBe(true);
  });

  it('keeps a multi-day event that has started but not ended', () => {
    expect(stillUpcoming(event({ start: '2026-08-01', end: '2026-08-07' }), NOON)).toBe(true);
  });

  it('drops an event that ended yesterday', () => {
    expect(stillUpcoming(event({ start: '2026-08-01', end: '2026-08-02' }), NOON)).toBe(false);
  });

  it('drops anything with no usable date', () => {
    expect(stillUpcoming(event({ start: '' }), NOON)).toBe(false);
    expect(stillUpcoming(event({ start: 'sometime next week' }), NOON)).toBe(false);
  });
});

describe('reading a stored feed', () => {
  it('gives back what was written', () => {
    writeCampusFeed('feed:60:40', { college: 'Fairfield University', events: [event()] }, { userId: 'u1', now: NOON });

    const stored = readCampusFeed('feed:60:40', { now: NOON });
    expect(stored.data.college).toBe('Fairfield University');
    expect(stored.data.events).toHaveLength(1);
    expect(stored.userId).toBe('u1');
  });

  it('re-dates to now, dropping what has already happened', () => {
    writeCampusFeed('feed:60:40', {
      college: 'Fairfield University',
      events: [event({ id: 'past', start: '2026-08-02T17:00:00' }), event({ id: 'soon' })],
    }, { now: NOON });

    // Read three days later: the 6th is now behind us too.
    const later = new Date(2026, 7, 7, 12, 0, 0).getTime();
    expect(readCampusFeed('feed:60:40', { now: NOON }).data.events.map(e => e.id)).toEqual(['soon']);
    expect(readCampusFeed('feed:60:40', { now: later })).toBeNull();
  });

  it('returns nothing at all for a key that was never written', () => {
    expect(readCampusFeed('feed:60:40', { now: NOON })).toBeNull();
  });

  it('forgets a feed older than a fortnight even if its events are still ahead', () => {
    writeCampusFeed('feed:60:40', {
      college: 'Fairfield University',
      events: [event({ start: '2026-09-30T17:00:00' })],
    }, { now: NOON });

    const wayLater = NOON + 20 * 24 * 60 * 60 * 1000;
    expect(readCampusFeed('feed:60:40', { now: wayLater })).toBeNull();
  });

  it('never stores an empty feed, so a bad read cannot become the head start', () => {
    writeCampusFeed('feed:60:40', { college: 'Fairfield University', events: [] }, { now: NOON });
    expect(readCampusFeed('feed:60:40', { now: NOON })).toBeNull();
  });

  it('keeps windows apart, so the dashboard and the calendar never swap answers', () => {
    writeCampusFeed('feed:60:40', { college: 'A', events: [event({ id: 'a' })] }, { now: NOON });
    writeCampusFeed('feed:45:20', { college: 'A', events: [event({ id: 'b' })] }, { now: NOON });

    expect(readCampusFeed('feed:60:40', { now: NOON }).data.events[0].id).toBe('a');
    expect(readCampusFeed('feed:45:20', { now: NOON }).data.events[0].id).toBe('b');
  });

  it('drops the oldest windows rather than growing without limit', () => {
    for (let i = 0; i < 8; i++) {
      writeCampusFeed(`feed:${i}`, { college: 'A', events: [event()] }, { now: NOON + i });
    }
    expect(readCampusFeed('feed:0', { now: NOON + 8 })).toBeNull();
    expect(readCampusFeed('feed:7', { now: NOON + 8 })).not.toBeNull();
  });
});

describe('the stored ranking', () => {
  it('comes back for the same key', () => {
    writeCampusRanking('rank:abc', [{ id: 'e1', guidance: { fit_reason: 'It is your field.' } }], { now: NOON });
    expect(readCampusRanking('rank:abc', { now: NOON })[0].guidance.fit_reason).toBe('It is your field.');
  });

  it('does not answer for a different key, which is what a changed feed produces', () => {
    writeCampusRanking('rank:abc', [{ id: 'e1' }], { now: NOON });
    expect(readCampusRanking('rank:xyz', { now: NOON })).toBeNull();
  });

  it('expires with the same fortnight the feed does', () => {
    writeCampusRanking('rank:abc', [{ id: 'e1' }], { now: NOON });
    expect(readCampusRanking('rank:abc', { now: NOON + 20 * 24 * 60 * 60 * 1000 })).toBeNull();
  });
});

describe('clearing', () => {
  it('takes the feed and the ranking together', () => {
    writeCampusFeed('feed:60:40', { college: 'A', events: [event()] }, { now: NOON });
    writeCampusRanking('rank:abc', [{ id: 'e1' }], { now: NOON });

    clearCampusStore();

    expect(readCampusFeed('feed:60:40', { now: NOON })).toBeNull();
    expect(readCampusRanking('rank:abc', { now: NOON })).toBeNull();
  });
});

describe('a browser that will not store anything', () => {
  it('reads as no head start rather than throwing', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };

    expect(() => writeCampusFeed('feed:60:40', { college: 'A', events: [event()] }, { now: NOON })).not.toThrow();
    expect(readCampusFeed('feed:60:40', { now: NOON })).toBeNull();
    expect(() => clearCampusStore()).not.toThrow();
  });

  it('survives a stored value that is not JSON at all', () => {
    globalThis.localStorage.setItem('unscripted_campus_v1', 'not json');
    expect(readCampusFeed('feed:60:40', { now: NOON })).toBeNull();
  });
});

describe('describeAge', () => {
  it('says nothing without a timestamp', () => {
    expect(describeAge(0)).toBe('');
  });

  it('reads in the units a student thinks in', () => {
    expect(describeAge(NOON, { now: NOON + 30 * 1000 })).toBe('just now');
    expect(describeAge(NOON, { now: NOON + 25 * 60 * 1000 })).toBe('25 minutes ago');
    expect(describeAge(NOON, { now: NOON + 65 * 60 * 1000 })).toBe('an hour ago');
    expect(describeAge(NOON, { now: NOON + 5 * 60 * 60 * 1000 })).toBe('5 hours ago');
    expect(describeAge(NOON, { now: NOON + 26 * 60 * 60 * 1000 })).toBe('yesterday');
    expect(describeAge(NOON, { now: NOON + 3 * 24 * 60 * 60 * 1000 })).toBe('3 days ago');
  });
});

describe('pruneStaleEvents', () => {
  it('tolerates being handed nothing', () => {
    expect(pruneStaleEvents(null, NOON)).toEqual([]);
    expect(pruneStaleEvents(undefined, NOON)).toEqual([]);
  });
});
