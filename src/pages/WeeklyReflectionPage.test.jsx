// @vitest-environment jsdom
/**
 * The library-PC case, asserted on the page a student actually uses.
 *
 * The weekly reflection draft used to sit under one fixed key. Signing in on a
 * machine someone else had used offered you their unsaved reflection: "You
 * started a reflection for the week of ... and didn't save it. Pick it up",
 * with their answers behind the button. The first test here is that bug, from
 * the outside. The second is the positive control, because a page that never
 * offers a draft to anyone would pass the first one for the wrong reason.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { writeReflectionDraft, readReflectionDraft } from '@/lib/student-drafts';

const { me, listWeekly, createWeekly, listExperiments } = vi.hoisted(() => ({
  me: vi.fn(),
  listWeekly: vi.fn(),
  createWeekly: vi.fn(),
  listExperiments: vi.fn(),
}));

const empty = () => ({ list: vi.fn().mockResolvedValue([]), filter: vi.fn().mockResolvedValue([]) });

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me },
    entities: {
      WeeklyReflections: { list: listWeekly, create: createWeekly, update: vi.fn() },
      Experiments: { list: listExperiments },
      Missions: empty(),
      PathRecommendations: empty(),
      ProofOfWork: empty(),
      OutreachContacts: empty(),
    },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

// The save resolves cycle and path links through the SDK. None of that is what
// these tests are about.
vi.mock('@/lib/career-cycle', () => ({
  linksForExperiment: vi.fn().mockResolvedValue({}),
}));

const { default: WeeklyReflectionPage } = await import('@/pages/WeeklyReflectionPage');

const ALICE = { id: 'user_alice' };
const BOB = { id: 'user_bob' };
const EXPERIMENT = { id: 'exp_1', title: 'Shadow a product manager', path_name: 'Product', status: 'in_progress' };

/** Monday of the current week, which is the only week the page offers a draft for. */
function thisMonday() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRIVATE_DRAFT = {
  week_start: thisMonday(),
  experiment_id: EXPERIMENT.id,
  weekChoice: 'stuck',
  picks: [],
  otherOpen: false,
  freeText: '',
  avoidedProse: '',
  energySources: '',
  energyDrains: '',
  pathFit: '',
  pathFitProse: '',
  lessons: 'I am starting to think I picked this path to impress my parents.',
  nextChanges: '',
  summary: '',
  adjustments: [],
};

const renderPage = () => render(<MemoryRouter><WeeklyReflectionPage /></MemoryRouter>);

// The page header fades in on scroll, and jsdom has neither of the browser APIs
// that drives. Nothing here is about the animation.
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

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  window.scrollTo = () => {};
  listWeekly.mockResolvedValue([]);
  listExperiments.mockResolvedValue([EXPERIMENT]);
  createWeekly.mockResolvedValue({ id: 'refl_1', week_start: PRIVATE_DRAFT.week_start, experiment_id: EXPERIMENT.id });
});

afterEach(cleanup);

describe('one student cannot be shown another students draft', () => {
  it('offers nothing to the next person who signs in on the same machine', async () => {
    writeReflectionDraft(ALICE.id, PRIVATE_DRAFT);
    me.mockResolvedValue(BOB);

    renderPage();

    await screen.findByRole('heading', { name: /how did this week actually go/i });
    expect(screen.queryByRole('button', { name: /pick it up/i })).toBeNull();
    expect(document.body.textContent).not.toContain('impress my parents');
  });

  it('still offers a student their own unsaved draft', async () => {
    writeReflectionDraft(ALICE.id, PRIVATE_DRAFT);
    me.mockResolvedValue(ALICE);

    renderPage();

    expect(await screen.findByRole('button', { name: /pick it up/i })).toBeTruthy();
  });
});

describe('a submitted reflection leaves no copy on the device', () => {
  it('clears the draft once the save succeeds', async () => {
    writeReflectionDraft(ALICE.id, PRIVATE_DRAFT);
    me.mockResolvedValue(ALICE);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /pick it up/i }));
    fireEvent.click(await screen.findByRole('button', { name: /done for now/i }));

    await waitFor(() => expect(createWeekly).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readReflectionDraft(ALICE.id)).toBeNull());
  });
});
