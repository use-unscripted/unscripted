// @vitest-environment jsdom
/**
 * The campus event picker inside Mission Guide generation, rendered.
 *
 * Two things were wrong with this screen and neither is visible to a test that
 * only checks the settled state:
 *
 *   1. It read the calendar on its own window, 45 days and 20 events, which no
 *      other surface in the app uses. The dashboard and the campus page share a
 *      feed that is kept on the device, so a student who had already seen their
 *      own calendar opened this and watched it get read from scratch. The
 *      window it asks for is the assertion. A different one is a different
 *      cache key, which is the whole bug.
 *   2. It hid real events behind the ~22s ranking call while a full-width
 *      Generate button sat underneath giving no reason to wait. Events we
 *      already hold have to be on screen and pickable while the model thinks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { useCampusEvents, useCampusPicks } = vi.hoisted(() => ({
  useCampusEvents: vi.fn(),
  useCampusPicks: vi.fn(),
}));

vi.mock('@/components/campus/useCampusEvents', () => ({ default: useCampusEvents }));
vi.mock('@/components/campus/useCampusPicks', () => ({ default: useCampusPicks }));
vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { updateMe: vi.fn() },
    entities: { StudentProfile: { update: vi.fn() } },
  },
}));

import CampusEventPicker from './CampusEventPicker';

/** Far enough out that the countdown never depends on when the suite runs. */
function event(id, title) {
  const start = new Date();
  start.setDate(start.getDate() + 10);
  return {
    id,
    title,
    start: start.toISOString(),
    location: 'Dolan School of Business',
    url: 'https://events.fairfield.edu/event/1',
  };
}

const EVENTS = [
  event('1', 'Finance Society panel'),
  event('2', 'Alumni careers night'),
  event('3', 'Startup pitch showcase'),
];

const PROFILE = { id: 'p1', major: 'Finance' };

function feed(over = {}) {
  return {
    loading: false,
    refreshing: false,
    status: 'ok',
    college: 'Fairfield University',
    events: EVENTS,
    profile: PROFILE,
    pathName: 'Investment Banking',
    rankingReady: true,
    retry: vi.fn(),
    adopt: vi.fn(),
    ...over,
  };
}

function draw(props = {}) {
  return render(
    <CampusEventPicker pathName="Investment Banking" selected={null} onSelect={vi.fn()} {...props} />
  );
}

beforeEach(() => {
  useCampusEvents.mockReturnValue(feed());
  useCampusPicks.mockReturnValue({ loading: false, picks: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the calendar it reads', () => {
  it('asks for the same window the dashboard and campus page already store', () => {
    draw();
    // 45/20 here and 60/40 everywhere else is a second cache key, a second
    // network read, and the reason this modal used to start cold.
    expect(useCampusEvents).toHaveBeenCalledWith({ days: 60, limit: 40 });
  });

  it('ranks under the same key, so a ranking paid for once is reused', () => {
    draw();
    expect(useCampusPicks).toHaveBeenCalledWith(
      EVENTS,
      PROFILE,
      { pathName: 'Investment Banking', ready: true },
    );
  });

  it('falls back to the path the student is testing when the experiment has none', () => {
    draw({ pathName: '' });
    expect(useCampusPicks).toHaveBeenCalledWith(
      EVENTS,
      PROFILE,
      { pathName: 'Investment Banking', ready: true },
    );
  });
});

describe('while the ranking is still running', () => {
  beforeEach(() => {
    useCampusPicks.mockReturnValue({ loading: true, picks: [] });
  });

  it('shows real events instead of covering them with a wait panel', () => {
    draw();
    expect(screen.getByText('Finance Society panel')).toBeTruthy();
    expect(screen.getByText('Alumni careers night')).toBeTruthy();
  });

  it('lets a student pick one before the model has answered', () => {
    const onSelect = vi.fn();
    draw({ onSelect });
    fireEvent.click(screen.getByText('Finance Society panel'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('says how long it will be, and that these are already real', () => {
    draw();
    expect(screen.getByText(/twenty seconds/)).toBeTruthy();
  });

  it('keeps the way out in reach', () => {
    draw();
    expect(screen.getByText(/Skip and build the guide without an event/)).toBeTruthy();
  });

  it('tells the generator it is busy, so the button can say what it will do', () => {
    const onBusy = vi.fn();
    draw({ onBusy });
    expect(onBusy).toHaveBeenLastCalledWith(true);
  });
});

describe('once the ranking lands', () => {
  it('replaces the browse list with the picks and their reasons', () => {
    useCampusPicks.mockReturnValue({
      loading: false,
      picks: [{
        ...EVENTS[2],
        guidance: { fit_reason: 'The founders take questions afterwards.', what_to_do: [] },
      }],
    });
    draw();
    expect(screen.getByText('Startup pitch showcase')).toBeTruthy();
    expect(screen.getByText('The founders take questions afterwards.')).toBeTruthy();
    expect(screen.queryByText('Finance Society panel')).toBeNull();
  });

  it('stops reporting busy', () => {
    const onBusy = vi.fn();
    draw({ onBusy });
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it('shows the real events anyway when the model ranked none of them', () => {
    draw();
    expect(screen.getByText(/Nothing matched, but these are real/)).toBeTruthy();
    expect(screen.getByText('Finance Society panel')).toBeTruthy();
  });
});

describe('with no calendar yet', () => {
  it('only shows the skeleton while there is genuinely nothing to read', () => {
    useCampusEvents.mockReturnValue(feed({ loading: true, status: '', events: [], college: '' }));
    const { container } = draw();
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('reports busy so the button never claims to be ready', () => {
    useCampusEvents.mockReturnValue(feed({ loading: true, status: '', events: [], college: '' }));
    const onBusy = vi.fn();
    draw({ onBusy });
    expect(onBusy).toHaveBeenLastCalledWith(true);
  });

  it('still lands every empty state on something the student can do', () => {
    for (const [status, text] of [
      ['no_college', /Which school do you go to/],
      ['no_feed', /club portal/],
      ['feed_error', /didn.t answer/],
      ['no_matches', /Nothing on your campus calendar right now/],
    ]) {
      useCampusEvents.mockReturnValue(feed({ status, events: [] }));
      const { unmount } = draw();
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      unmount();
    }
  });
});
