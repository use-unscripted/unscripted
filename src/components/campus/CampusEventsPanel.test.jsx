// @vitest-environment jsdom
/**
 * What the dashboard is allowed to put in front of a student.
 *
 * Drew opened his own account while testing operations management and found a
 * staff vendor training and a children's storytime at the campus bookstore
 * sitting under "On your campus". Neither was a recommendation. They were the
 * next two things on Fairfield's calendar, printed because the section topped
 * its slots up from the front of the feed whenever the model returned nothing.
 *
 * These assert the rule that replaced it: an event reaches this section because
 * the model picked it, or it does not reach it at all. The titles below are the
 * real ones, so a regression fails with the actual event that caused this.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { useCampusEvents, useCampusPicks } = vi.hoisted(() => ({
  useCampusEvents: vi.fn(),
  useCampusPicks: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({ base44: { entities: {}, integrations: { Core: {} } } }));
vi.mock('@/components/campus/useCampusEvents', () => ({ default: useCampusEvents }));
vi.mock('@/components/campus/useCampusPicks', () => ({ default: useCampusPicks }));

const { default: CampusEventsPanel } = await import('@/components/campus/CampusEventsPanel');

/** Inside the 30-day window the lead is chosen from. */
function soon(daysAhead) {
  const at = new Date();
  at.setDate(at.getDate() + daysAhead);
  at.setHours(10, 0, 0, 0);
  return at.toISOString();
}

/** Exactly what Fairfield's calendar had on it the day this was reported. */
const FEED = [
  { id: 'e1', title: 'PaymentWorks New Vendor Invite Training', start: soon(1) },
  { id: 'e2', title: 'Children’s Storytime in the Fairfield Forest', start: soon(3) },
  { id: 'e3', title: 'MBA Virtual Information Session', start: soon(5) },
];

// The section fades in on scroll, and jsdom has neither of the two browser
// APIs that drives. Nothing here is about the animation.
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.matchMedia = window.matchMedia || (query => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
}));

function setup({ picks = [], ranking = false, pathName = 'Operations Manager at a high-growth startup' } = {}) {
  useCampusEvents.mockReturnValue({
    loading: false,
    refreshing: false,
    cachedAt: null,
    status: 'ok',
    college: 'Fairfield University',
    events: FEED,
    profile: { id: 'p1' },
    pathName,
    rankingReady: true,
    retry: vi.fn(),
    adopt: vi.fn(),
  });
  useCampusPicks.mockReturnValue({ picks, loading: ranking });
  render(<MemoryRouter><CampusEventsPanel /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the dashboard campus section when nothing on the calendar fits', () => {
  it('shows none of the events the model passed over', () => {
    setup({ picks: [] });

    expect(screen.queryByText(/PaymentWorks/i)).toBeNull();
    expect(screen.queryByText(/Storytime/i)).toBeNull();
    expect(screen.queryByText(/MBA Virtual Information Session/i)).toBeNull();
  });

  it('says so, and names the path it failed to match', () => {
    setup({ picks: [] });

    expect(screen.getByText(/Nothing here fits Operations Manager at a high-growth startup/i)).toBeTruthy();
  });

  it('still offers the calendar, so nothing is hidden', () => {
    setup({ picks: [] });

    expect(screen.getByText(/See what.s on anyway/i)).toBeTruthy();
  });

  it('names no path when the student has not chosen one', () => {
    setup({ picks: [], pathName: '' });

    expect(screen.getByText(/Nothing here matches your interests/i)).toBeTruthy();
  });
});

describe('the dashboard campus section when something does fit', () => {
  it('leads with the pick and its reason', () => {
    setup({
      picks: [{ ...FEED[2], guidance: { fit_reason: 'Two operations leads run the ops track.' } }],
    });

    expect(screen.getByText('MBA Virtual Information Session')).toBeTruthy();
    expect(screen.getByText(/Two operations leads run the ops track/)).toBeTruthy();
  });

  it('does not pad the rest of the section from the front of the feed', () => {
    setup({
      picks: [{ ...FEED[2], guidance: { fit_reason: 'Two operations leads run the ops track.' } }],
    });

    // Both of these are sooner than the pick, so a chronological tail would
    // have put them on screen underneath it. That is the bug.
    expect(screen.queryByText(/PaymentWorks/i)).toBeNull();
    expect(screen.queryByText(/Storytime/i)).toBeNull();
  });

  it('leads with one pick even when the model returned several', () => {
    setup({
      picks: [
        { ...FEED[2], guidance: { fit_reason: 'Two operations leads run the ops track.' } },
        { ...FEED[0], guidance: { fit_reason: 'The vendor system is the ops work itself.' } },
      ],
    });

    // The dashboard is a glance. A second pick renders as a bare title here,
    // because the reason sentence only exists on the recommendation card, and
    // titles with nothing said about them are the list this change removed.
    expect(screen.getByText('MBA Virtual Information Session')).toBeTruthy();
    expect(screen.queryByText(/PaymentWorks/i)).toBeNull();
  });
});

describe('the dashboard campus section while a re-rank is running', () => {
  /*
    The returning student, and the case the first version of this got wrong.

    Yesterday's ranking stays on screen while a new one is worked out. Once
    yesterday's event has happened there is no lead in it, and a section that
    reads that as "nothing fits you" states something it has not finished
    working out. The old behaviour here was a list, which was wrong without
    claiming anything. A false claim is the worse of the two.
  */
  it('waits instead of announcing that nothing fits', () => {
    const stale = { id: 'gone', title: 'Last Week’s Panel', start: '2020-01-01T15:00:00Z' };
    setup({ picks: [stale], ranking: true });

    expect(screen.queryByText(/Nothing here fits/i)).toBeNull();
    expect(screen.getByText(/Checking your campus calendar/i)).toBeTruthy();
  });
});
