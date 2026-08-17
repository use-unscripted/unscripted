// @vitest-environment jsdom
/**
 * The landing's before-and-after matrix, pinned to the screen it copies.
 *
 * That block's entire defence is "these are the real strings". Nothing else
 * enforces it: the stage words are exported constants in one module and
 * hardcoded text in another, and the trend wording is not a constant anywhere.
 * Rename either and the landing starts lying silently, which is how it came to
 * print "Not enough history yet" for a badge that says "Not enough history".
 *
 * So this file asserts the equality rather than the rendering. It does not
 * re-test the matrix, and it does not render the landing section, which would
 * drag in the path explorer and a router for no gain.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { STAGE_UNTESTED, STAGE_TESTED, TREND_NONE } from './LandingSections';
import TrendBadge from '@/components/matrix/TrendBadge';
import { MATURITY, THRESHOLDS } from '@/lib/decision-matrix';

afterEach(cleanup);

describe('the landing copies the Decision Matrix, it does not paraphrase it', () => {
  it('uses the matrix’s own maturity labels for both stages', () => {
    expect(STAGE_UNTESTED).toBe(MATURITY.not_tested.label);
    expect(STAGE_TESTED).toBe(MATURITY.early_signal.label);
  });

  it('uses the wording the trend badge actually renders with no direction', () => {
    render(<TrendBadge trend={{ dir: null }} />);
    expect(screen.getByText(TREND_NONE)).toBeTruthy();
  });

  /* The claim the card makes is that one finished simulation leaves a path at
     "Early signal" and not past it. That holds only while a single evidence
     item is short of the developing threshold: the simulation writes one
     measured experiment and one proof row, and a second item would take the
     row to "Developing evidence" and put a percentage in reach. Raise the
     threshold to 1 and the after card is wrong. */
  it('is only true while one evidence item is short of developing evidence', () => {
    expect(THRESHOLDS.developing_evidence_items).toBeGreaterThan(1);
  });
});
