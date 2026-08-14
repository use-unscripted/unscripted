// @vitest-environment jsdom
/**
 * A guard on the length of the Career Experiment pre check-in.
 *
 * This component renders every PRE_FIELDS entry and requires every one of them
 * before its button unlocks, and the hint under the button counts them out loud:
 * "Answer all five to begin." That makes PRE_FIELDS a shared list with a cost
 * attached. A field appended to it for some other flow turns into a sixth
 * mandatory question here, the hint starts contradicting the form, and nothing
 * fails. That is exactly what happened when the work simulation needed two
 * predictions of its own and put them in PRE_FIELDS.
 *
 * So the assertions below are deliberately about the count a student faces, read
 * off the rendered DOM rather than off the constant, and about the hint agreeing
 * with that count. Adding a field to PRE_FIELDS fails these. Adding one to
 * SIM_PRE_FIELDS, which is what a new prediction should do, does not.
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

// The five this flow has always asked, written out rather than imported, so the
// test still fails if someone edits the constant and the expectation together.
const ORIGINAL_QUESTIONS = [
  'Expected enjoyment',
  'Expected difficulty',
  'Current interest in this career',
  'How strongly do you think this career fits you?',
  'Expected energy / excitement',
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

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
  it('asks exactly its original five questions and nothing else', () => {
    renderCheckIn();
    expect(renderedQuestions()).toEqual(ORIGINAL_QUESTIONS);
  });

  it('does not grow when a measurement field is added for another flow', () => {
    renderCheckIn();
    const asked = renderedQuestions();

    expect(asked).toHaveLength(5);

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

  it('counts the questions correctly in its own instructions', () => {
    renderCheckIn();
    const count = renderedQuestions().length;
    const hint = screen.getByText(/Answer all .* to begin\./);
    expect(hint.textContent).toBe(`Answer all ${NUMBER_WORDS[count]} to begin.`);
  });

  it('unlocks the button on the fifth answer, not a later one', () => {
    renderCheckIn();
    const start = screen.getByRole('button', { name: 'Start the experiment' });
    expect(start.disabled).toBe(true);

    const questions = renderedQuestions();
    questions.forEach((label, i) => {
      fireEvent.click(screen.getByRole('button', { name: `${label}: 7 out of 10` }));
      // Still locked until the last one, unlocked the moment it lands.
      expect(start.disabled).toBe(i < questions.length - 1);
    });

    expect(questions).toHaveLength(5);
    expect(start.disabled).toBe(false);
    // The hint retires once the form is answerable, so it cannot be left
    // claiming a number while the button is live.
    expect(screen.queryByText(/Answer all .* to begin\./)).toBeNull();
  });
});
