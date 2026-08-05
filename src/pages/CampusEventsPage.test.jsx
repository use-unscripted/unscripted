// @vitest-environment jsdom
/**
 * The side panel while the ranking is still being worked out.
 *
 * This state shipped as two shimmering blocks filled with #F7F9FB on a white
 * card, which is a blank box for as long as the model takes. Nothing said a
 * recommendation was on its way, so the only thing on the page worth waiting
 * for looked like a part of the page that had failed to load.
 *
 * The wait is a model call, so it cannot be shortened. What it can do is say
 * what it is doing, and that is what these assert: words on screen while the
 * ranking is owed, and the events themselves once it lands.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { useCampusEvents, useCampusPicks } = vi.hoisted(() => ({
  useCampusEvents: vi.fn(),
  useCampusPicks: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({ base44: { entities: {}, integrations: { Core: {} } } }));
vi.mock('@/components/campus/useCampusEvents', () => ({ default: useCampusEvents }));
vi.mock('@/components/campus/useCampusPicks', () => ({ default: useCampusPicks }));

const { default: CampusEventsPage } = await import('@/pages/CampusEventsPage');

/** Far enough out that it is upcoming whenever this suite is run. */
function soon(daysAhead) {
  const at = new Date();
  at.setDate(at.getDate() + daysAhead);
  at.setHours(17, 0, 0, 0);
  return at.toISOString();
}

const EVENTS = [
  { id: 'e1', title: 'Finance Career Night', start: soon(3), location: 'Dolan School' },
  { id: 'e2', title: 'Resume Lab', start: soon(6), location: 'Career Center' },
];

// Sections fade in on scroll, which jsdom has no observer for. Nothing here is
// about the animation, so it reports one intersection and stops.
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// The page picks grid or list off the viewport width, and jsdom has no
// matchMedia at all. Answering false is the phone default, which renders the
// same panel.
window.matchMedia = window.matchMedia || (query => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
}));

function setup({ picks, ranking }) {
  useCampusEvents.mockReturnValue({
    loading: false,
    refreshing: false,
    cachedAt: null,
    status: 'ok',
    college: 'Fairfield University',
    events: EVENTS,
    profile: { id: 'p1' },
    profileReady: true,
    retry: vi.fn(),
    adopt: vi.fn(),
  });
  useCampusPicks.mockReturnValue({ picks, loading: ranking });
  render(<CampusEventsPage />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the Coming up panel while the ranking runs', () => {
  it('says a recommendation is being worked out, and which calendar it is reading', () => {
    setup({ picks: [], ranking: true });

    const panel = screen.getByRole('status');
    expect(panel.textContent).toMatch(/picking the ones worth going to/i);
    expect(panel.textContent).toMatch(/Fairfield University/);
  });

  it('leaves nothing that reads as a finished, empty panel', () => {
    setup({ picks: [], ranking: true });

    // The wait must never borrow the copy for a day that has nothing on it.
    expect(screen.queryByText(/nothing on this day/i)).toBeNull();
  });

  it('hands the panel over to the events once the ranking lands', () => {
    setup({ picks: [{ ...EVENTS[0], why: 'Two finance firms your major recruits from.' }], ranking: false });

    expect(screen.queryByText(/picking the ones worth going to/i)).toBeNull();
    expect(screen.getAllByText(/Finance Career Night/).length).toBeGreaterThan(0);
  });
});
