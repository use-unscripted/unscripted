// @vitest-environment jsdom
/**
 * A guard on the length of the Career Experiment pre check-in.
 *
 * This component renders every PRE_FIELDS entry and requires every one of them
 * before its button unlocks. That makes PRE_FIELDS a shared list with a cost
 * attached: a field appended to it for some other flow turns into another
 * mandatory question here, and nothing fails. That is exactly what happened when
 * the work simulation needed two predictions of its own and put them in
 * PRE_FIELDS.
 *
 * The seven below are the deliberate set: every expectation that has a matching
 * answer after the work, so the Conviction Lab can compare them. Adding an
 * eighth fails these. Adding one to SIM_PRE_FIELDS, which is what a new
 * simulation-only prediction should do, does not.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PreExperimentCheckIn from '@/components/measurement/PreExperimentCheckIn';
import { PRE_FIELDS, SIM_PRE_FIELDS, ALL_PRE_FIELDS } from '@/lib/experiment-measurement';

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: vi.fn().mockResolvedValue({ id: 'u1' }) },
    entities: {
      ExperimentMeasurement: {
        filter: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'm1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  },
}));

// Written out rather than imported, so the test still fails if someone edits the
// constant and the expectation together.
const EXPECTED_QUESTIONS = [
  'Expected enjoyment',
  'Expected difficulty',
  'Current interest in this career',
  'How strongly do you think this career fits you?',
  'Expected energy / excitement',
  'How frustrating do you expect this to be?',
  'Do you expect to want to do work like this again?',
];

const exp = { id: 'e1', title: 'Shadow a product manager' };

const renderCheckIn = () =>
  render(<PreExperimentCheckIn exp={exp} onClose={() => {}} onSaved={() => {}} />);

/**
 * One label per question on screen. Every ScaleInput puts the question text into
 * the accessible name of each of its ten buttons, so the "1" button of each row
 * is a reliable one-per-question handle.
 */
const renderedQuestions = () =>
  screen
    .getAllByRole('button', { name: /: 1 out of 10$/ })
    .map(b => b.getAttribute('aria-label').replace(/: 1 out of 10$/, ''));

afterEach(cleanup);

describe('the Career Experiment pre check-in', () => {
  it('asks exactly its seven expectation questions and nothing else', () => {
    renderCheckIn();
    expect(renderedQuestions()).toEqual(EXPECTED_QUESTIONS);
  });

  it('does not grow when a measurement field is added for another flow', () => {
    renderCheckIn();
    const asked = renderedQuestions();

    expect(asked).toHaveLength(7);

    // The work simulation's own predictions exist and are stored on the same
    // entity, but a student in this flow is never shown them.
    expect(SIM_PRE_FIELDS.map(f => f.key)).toEqual(
      expect.arrayContaining(['expected_performance', 'expected_want_more']),
    );
    expect(ALL_PRE_FIELDS.map(f => f.key)).toEqual(
      expect.arrayContaining(['expected_performance', 'expected_want_more']),
    );
    expect(PRE_FIELDS.map(f => f.key)).not.toContain('expected_performance');
    expect(PRE_FIELDS.map(f => f.key)).not.toContain('expected_want_more');

    expect(asked.join('|')).not.toMatch(/How well do you think you will do\?/);
    expect(asked.join('|')).not.toMatch(/want to do another one/);
  });

  it('unlocks the button on the last answer, not a later one', () => {
    renderCheckIn();
    const start = screen.getByRole('button', { name: 'Start the experiment' });
    expect(start.disabled).toBe(true);

    const questions = renderedQuestions();
    questions.forEach((label, i) => {
      fireEvent.click(screen.getByRole('button', { name: `${label}: 7 out of 10` }));
      // Still locked until the last one, unlocked the moment it lands.
      expect(start.disabled).toBe(i < questions.length - 1);
    });

    expect(start.disabled).toBe(false);
    // The hint retires once the form is answerable.
    expect(screen.queryByText(/Answer every rating to begin/)).toBeNull();
  });
});