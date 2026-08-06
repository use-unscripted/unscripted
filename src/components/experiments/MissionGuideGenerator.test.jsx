// @vitest-environment jsdom
/**
 * The one thing this screen got wrong before a student ever pressed anything.
 *
 * The campus picker sits above a full-width primary button. While the picker
 * was reading a calendar and ranking it, that button read "Generate Mission
 * Guide" in exactly the same words it uses when everything is ready. A student
 * looking at a loading panel had nothing telling them that waiting bought them
 * anything, and every reason to press straight through it.
 *
 * The fix is not a disabled button. An event is an enhancement and generating
 * without one is a legitimate thing to want. What the button has to do is say
 * what it will actually do if pressed now.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const { pickerProps } = vi.hoisted(() => ({ pickerProps: { current: null } }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: vi.fn().mockResolvedValue({ id: 'u1' }) },
    entities: {
      StudentProfile: {
        filter: vi.fn().mockResolvedValue([{ id: 'p1', college: 'Fairfield University' }]),
      },
    },
    integrations: { Core: { InvokeLLM: vi.fn() } },
  },
}));

// Stubbed so the button's own logic is what is under test, and so the test can
// drive the busy signal directly rather than through a real model call.
vi.mock('./CampusEventPicker', () => ({
  default: ({ onBusy }) => {
    pickerProps.current = { onBusy };
    return <div data-testid="picker" />;
  },
}));

import MissionGuideGenerator from './MissionGuideGenerator';

const EXPERIMENT = {
  id: 'e1',
  title: 'Shadow a portfolio manager',
  path_name: 'Investment Banking',
};

function draw() {
  return render(
    <MissionGuideGenerator
      experiment={EXPERIMENT}
      existingGuides={[]}
      onGenerated={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

afterEach(() => {
  cleanup();
  pickerProps.current = null;
});

describe('the generate button while the calendar is still loading', () => {
  it('says it will generate without an event, rather than claiming to be ready', () => {
    draw();
    // The picker starts busy, so this is the state a student actually opens the
    // modal into. Nothing has to happen first.
    expect(screen.getByRole('button', { name: /Generate without an event/ })).toBeTruthy();
  });

  it('says what waiting buys, in one line under the buttons', () => {
    draw();
    expect(screen.getByText(/campus calendar is still loading/)).toBeTruthy();
  });

  it('never blocks: the button is pressable the whole time', () => {
    draw();
    expect(screen.getByRole('button', { name: /Generate without an event/ }).disabled).toBe(false);
  });

  it('goes back to the ordinary label once there is nothing left to arrive', async () => {
    draw();
    pickerProps.current.onBusy(false);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Mission Guide/ })).toBeTruthy();
    });
    expect(screen.queryByText(/campus calendar is still loading/)).toBeNull();
  });
});
