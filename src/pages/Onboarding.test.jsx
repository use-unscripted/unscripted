// @vitest-environment jsdom
/**
 * The early read, driven the way a student reaches it.
 *
 * The derivation is tested on its own in src/lib/onboarding-early-read.test.js.
 * What is only true if this page wires it up correctly, and what is asserted
 * here, is that the screen is an interstitial rather than a seventeenth
 * question:
 *
 * - the counter does not jump and the total does not grow;
 * - Back returns to the question behind it, not past it;
 * - it appears once, so a student who goes back and forward is not shown it
 *   again;
 * - the guest draft still round-trips, and the screen adds nothing to it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { STEPS } from '@/lib/onboarding-steps';
import Onboarding from './Onboarding';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/api/base44Client', () => ({
  base44: { analytics: { track } },
}));

const DRAFT_KEY = 'unscripted_guest_onboarding_v1';

/** A draft as the intake itself would have left it, parked on question 5. */
function seedDraft(fields) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    draft_version: 1,
    guest_session_id: 'test_session',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed: false,
    intake_version: 4,
    current_step: 4,
    available_hours_per_week: 8,
    baseline_career_clarity: 3,
    ...fields,
  }));
}

const draft = () => JSON.parse(localStorage.getItem(DRAFT_KEY));

/** Drops the student straight onto question 5, the one the early read follows. */
function openAtLastQuestionOfSectionOne() {
  return render(
    <MemoryRouter initialEntries={['/onboarding?step=4']}>
      <Onboarding />
    </MemoryRouter>
  );
}

const counter = () => screen.getByText(/^(\d+ OF \d+|REVIEW|EARLY READ)$/).textContent;
const clickText = (label) => fireEvent.click(screen.getByText(label));
// The primary action reads Skip on a question left empty and Continue otherwise.
const advance = () => fireEvent.click(screen.getByText(/^(Continue|Skip)$/));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('the early read, in the flow', () => {
  it('does not move the counter or grow the total', () => {
    seedDraft({ current_careers_considered: ['Investment banking'] });
    openAtLastQuestionOfSectionOne();

    expect(counter()).toBe(`5 OF ${STEPS.length}`);

    advance();
    expect(screen.getByText('Here is what we can see so far.')).toBeTruthy();
    expect(counter()).toBe('EARLY READ');

    clickText('Keep going');
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
    expect(screen.getByText(STEPS[5].question)).toBeTruthy();
  });

  it('shows the careers the student typed and nothing else', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], curious_path: 'Writing' });
    openAtLastQuestionOfSectionOne();
    advance();

    expect(screen.getByText('Writing')).toBeTruthy();
    expect(screen.getByText('Investment banking')).toBeTruthy();
  });

  it('goes back to the question behind it, not past it', () => {
    seedDraft({ current_careers_considered: ['Investment banking'] });
    openAtLastQuestionOfSectionOne();
    advance();
    clickText('Back');

    expect(screen.getByText(STEPS[4].question)).toBeTruthy();
    expect(counter()).toBe(`5 OF ${STEPS.length}`);
  });

  it('appears once, so going back and forward again does not repeat it', () => {
    seedDraft({ current_careers_considered: ['Investment banking'] });
    openAtLastQuestionOfSectionOne();
    advance();
    clickText('Back');
    advance();

    expect(screen.queryByText('Here is what we can see so far.')).toBeNull();
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  it('says there is not enough yet when everything optional was skipped', () => {
    seedDraft({});
    openAtLastQuestionOfSectionOne();
    advance();

    expect(screen.getByText('There is not much here yet.')).toBeTruthy();
    expect(screen.queryByText('Worth testing')).toBeNull();
    clickText('Keep going');
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  it('stays off the review screen, and off an edit made from it', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], name: 'Sam' });
    render(
      <MemoryRouter initialEntries={[`/onboarding?step=${STEPS.length}`]}>
        <Onboarding />
      </MemoryRouter>
    );
    expect(counter()).toBe('REVIEW');
    // Every row on the review is a question, and the early read is not one.
    expect(screen.queryByText('EARLY READ')).toBeNull();

    fireEvent.click(screen.getByText(STEPS[4].question));
    expect(counter()).toBe(`5 OF ${STEPS.length}`);
    advance();

    expect(screen.queryByText('Here is what we can see so far.')).toBeNull();
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  // The account wall's "Edit my path selection" sends a finished student to
  // /onboarding?step=0. That is a fresh mount, so nothing in the running page
  // knows they are finished: only the draft does.
  it('stays away from a student who finished the intake and came back through the edit link', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], name: 'Sam', current_step: STEPS.length });
    render(
      <MemoryRouter initialEntries={['/onboarding?step=0']}>
        <Onboarding />
      </MemoryRouter>
    );
    expect(counter()).toBe(`1 OF ${STEPS.length}`);

    for (let i = 0; i < 5; i += 1) advance();

    expect(screen.queryByText('Here is what we can see so far.')).toBeNull();
    expect(screen.queryByText('There is not much here yet.')).toBeNull();
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  // The answers come back out of the draft whatever version it was written
  // under, so how far the student got has to be read the same way. Otherwise a
  // finished student on an older draft walks to question 5 and is shown a read
  // "on partial answers" with all sixteen of them restored behind it.
  it('stays away from a finished student whose draft was written under an older intake', () => {
    seedDraft({
      current_careers_considered: ['Investment banking'],
      name: 'Sam',
      current_step: STEPS.length,
      intake_version: 3,
    });
    render(
      <MemoryRouter initialEntries={['/onboarding?step=0']}>
        <Onboarding />
      </MemoryRouter>
    );
    expect(counter()).toBe(`1 OF ${STEPS.length}`);

    for (let i = 0; i < 5; i += 1) advance();

    expect(screen.queryByText('Here is what we can see so far.')).toBeNull();
    expect(screen.queryByText('There is not much here yet.')).toBeNull();
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  it('does not come back after a reload past it followed by Back and Continue', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], current_step: 5 });
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>
    );
    expect(counter()).toBe(`6 OF ${STEPS.length}`);

    clickText('Back');
    expect(counter()).toBe(`5 OF ${STEPS.length}`);
    advance();

    expect(screen.queryByText('Here is what we can see so far.')).toBeNull();
    expect(counter()).toBe(`6 OF ${STEPS.length}`);
  });

  it('still shows for a draft parked on the question it follows', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], current_step: 4 });
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>
    );
    expect(counter()).toBe(`5 OF ${STEPS.length}`);
    advance();
    expect(screen.getByText('Here is what we can see so far.')).toBeTruthy();
  });

  it('says how many careers it is showing when it cannot show them all', () => {
    seedDraft({
      current_careers_considered: ['Investment banking', 'Consulting', 'Product design', 'Teaching', 'Nursing'],
    });
    openAtLastQuestionOfSectionOne();
    advance();

    expect(screen.getByText(/showing 3 of the 5 careers still on the table/i)).toBeTruthy();
    expect(screen.queryByText(/There is no order to them/)).toBeNull();
  });

  // The count is taken after the ruled-out ones come off, so calling it the
  // careers they named put two different numbers for the same thing on one
  // screen: five on the list line, four two lines under it.
  it('counts what is left rather than what they named once one is ruled out', () => {
    seedDraft({
      current_careers_considered: ['Investment banking', 'Consulting', 'Product design', 'Teaching', 'Nursing'],
      careers_ruled_out: ['Nursing'],
    });
    openAtLastQuestionOfSectionOne();
    advance();

    expect(screen.getByText(/5 careers on your list/)).toBeTruthy();
    expect(screen.getByText(/showing 3 of the 4 careers still on the table/i)).toBeTruthy();
    expect(screen.queryByText(/careers you named/i)).toBeNull();
  });

  // The rendered form of the worst case: a student names one school, rules out
  // a different one, and the screen empties itself and then explains the empty
  // screen with a sentence about their answers that is not true.
  it('does not empty the screen over a word two unrelated careers share', () => {
    seedDraft({
      current_careers_considered: ['Business school'],
      careers_ruled_out: ['Law school'],
    });
    openAtLastQuestionOfSectionOne();
    advance();

    expect(screen.getByText('Business school')).toBeTruthy();
    expect(screen.queryByText('Nothing to point at yet')).toBeNull();
    expect(screen.queryByText(/also on your ruled-out list/)).toBeNull();
  });

  it('leaves the guest draft round-tripping and adds nothing to it', () => {
    seedDraft({ current_careers_considered: ['Investment banking'] });
    const before = Object.keys(draft()).sort();
    openAtLastQuestionOfSectionOne();

    advance();
    // Parked on the question behind the screen, so a reload lands on an
    // answered question rather than skipping past a screen nobody finished.
    expect(draft().current_step).toBe(4);
    expect(draft().current_careers_considered).toEqual(['Investment banking']);

    clickText('Keep going');
    expect(draft().current_step).toBe(5);
    expect(Object.keys(draft()).sort()).toEqual(before);
  });

  it('reports counts to the funnel and no word the student typed', () => {
    seedDraft({ current_careers_considered: ['Investment banking'], pressured_path: 'my father the surgeon' });
    openAtLastQuestionOfSectionOne();
    advance();

    const sent = track.mock.calls.map(([c]) => c).filter(c => c.eventName === 'intake_early_read_shown');
    expect(sent).toHaveLength(1);
    expect(sent[0].properties).toMatchObject({ sparse: false, directions_count: 1 });
    expect(JSON.stringify(sent[0].properties)).not.toContain('surgeon');
    expect(JSON.stringify(sent[0].properties)).not.toContain('Investment banking');
  });
});
