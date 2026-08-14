/**
 * The rules that stop a student's unsaved reflection outliving them on a shared
 * machine.
 *
 * The bug these were written against: the weekly reflection draft sat under one
 * fixed key, `unscripted_reflection_draft_v1`, with no owner and no expiry. On a
 * library PC the next person to sign in was offered "You started a reflection
 * and didn't save it. Pick it up", loaded with the previous student's answers
 * about what they avoided, what they got wrong and whether their path was
 * working. Every test below is one of the four things that had to be true for
 * that to stop being possible.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DRAFT_MAX_AGE_MS,
  readReflectionDraft,
  writeReflectionDraft,
  clearReflectionDraft,
  readConclusionDraft,
  writeConclusionDraft,
  clearConclusionDraft,
  clearStudentDrafts,
  reflectionDraftKey,
} from './student-drafts';

/** The smallest thing that behaves like localStorage, enumeration included. */
function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    key: i => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    get size() { return map.size; },
  };
}

const NOW = new Date(2026, 7, 14, 12, 0, 0).getTime();
const ALICE = 'user_alice';
const BOB = 'user_bob';

const REFLECTION = {
  week_start: '2026-08-10',
  lessons: 'I hate cold outreach and I have been avoiding it all week.',
};

beforeEach(() => {
  globalThis.localStorage = fakeStorage();
});

describe('per-user scoping', () => {
  it('gives a student back their own draft', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    expect(readReflectionDraft(ALICE, { now: NOW })).toEqual(REFLECTION);
  });

  it('never shows one student the draft another left on the machine', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    expect(readReflectionDraft(BOB, { now: NOW })).toBeNull();
  });

  it('keeps both students drafts apart rather than overwriting one with the other', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    writeReflectionDraft(BOB, { week_start: '2026-08-10', lessons: 'Mine.' }, { now: NOW });

    expect(readReflectionDraft(ALICE, { now: NOW }).lessons).toBe(REFLECTION.lessons);
    expect(readReflectionDraft(BOB, { now: NOW }).lessons).toBe('Mine.');
  });

  it('refuses a draft whose stored owner is someone else, even under the right key', () => {
    // What a missed clear, a hand-edited key or a future key collision looks
    // like. The owner recorded inside the draft is the check that still holds.
    localStorage.setItem(reflectionDraftKey(BOB), JSON.stringify({
      v: 2, owner: ALICE, at: NOW, data: REFLECTION,
    }));
    expect(readReflectionDraft(BOB, { now: NOW })).toBeNull();
    // And it is deleted rather than left to be tried again.
    expect(localStorage.getItem(reflectionDraftKey(BOB))).toBeNull();
  });

  it('stores nothing at all when there is no signed-in student', () => {
    expect(writeReflectionDraft('', REFLECTION, { now: NOW })).toBe(false);
    expect(localStorage.size).toBe(0);
    expect(readReflectionDraft('', { now: NOW })).toBeNull();
  });

  it('will not let an id smuggle a separator into another students key', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    expect(readReflectionDraft('user/alice', { now: NOW })).toBeNull();
  });
});

describe('clear on submit', () => {
  it('leaves nothing behind once the reflection has been saved', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    clearReflectionDraft(ALICE);

    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
    expect(localStorage.size).toBe(0);
  });

  it('clears the conclusion draft for the experiment that was just concluded', () => {
    writeConclusionDraft(ALICE, 'exp_1', { lessons: 'a' }, { now: NOW });
    writeConclusionDraft(ALICE, 'exp_2', { lessons: 'b' }, { now: NOW });

    clearConclusionDraft(ALICE, 'exp_1');

    expect(readConclusionDraft(ALICE, 'exp_1', { now: NOW })).toBeNull();
    expect(readConclusionDraft(ALICE, 'exp_2', { now: NOW })).toEqual({ lessons: 'b' });
  });
});

describe('clear on sign-out', () => {
  it('wipes every draft on the machine, not only the one signing out', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    writeReflectionDraft(BOB, { week_start: '2026-08-10', lessons: 'Mine.' }, { now: NOW });
    writeConclusionDraft(ALICE, 'exp_1', { lessons: 'a' }, { now: NOW });

    expect(clearStudentDrafts()).toBe(3);

    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
    expect(readReflectionDraft(BOB, { now: NOW })).toBeNull();
    expect(readConclusionDraft(ALICE, 'exp_1', { now: NOW })).toBeNull();
  });

  it('takes the old unscoped keys with it', () => {
    // Written by the version of the app that had this bug. There is no way to
    // tell whose words these are, so they are deleted rather than migrated.
    localStorage.setItem('unscripted_reflection_draft_v1', JSON.stringify(REFLECTION));
    localStorage.setItem('unscripted_conclusion_draft_exp_1', JSON.stringify({ lessons: 'a' }));

    expect(clearStudentDrafts()).toBe(2);
    expect(localStorage.size).toBe(0);
  });

  it('leaves storage that is not a draft alone', () => {
    localStorage.setItem('unscripted_campus_v1', '{}');
    localStorage.setItem('unscripted_guest_onboarding_v1', '{}');
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });

    expect(clearStudentDrafts()).toBe(1);
    expect(localStorage.getItem('unscripted_campus_v1')).toBe('{}');
    expect(localStorage.getItem('unscripted_guest_onboarding_v1')).toBe('{}');
  });

  it('does not throw when there is no usable storage', () => {
    globalThis.localStorage = {
      get length() { throw new Error('blocked'); },
      key: () => null,
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(() => clearStudentDrafts()).not.toThrow();
    expect(() => clearReflectionDraft(ALICE)).not.toThrow();
    expect(writeReflectionDraft(ALICE, REFLECTION)).toBe(false);
    expect(readReflectionDraft(ALICE)).toBeNull();
  });
});

describe('expiry', () => {
  it('still returns a draft written six days ago', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    const sixDaysOn = NOW + 6 * 24 * 60 * 60 * 1000;
    expect(readReflectionDraft(ALICE, { now: sixDaysOn })).toEqual(REFLECTION);
  });

  it('drops one that has sat unsubmitted for longer than a week', () => {
    writeReflectionDraft(ALICE, REFLECTION, { now: NOW });
    const past = NOW + DRAFT_MAX_AGE_MS + 1;

    expect(readReflectionDraft(ALICE, { now: past })).toBeNull();
    // Expiry deletes. A draft that is too old to show is too old to keep.
    expect(localStorage.size).toBe(0);
  });

  it('expires a conclusion draft on the same clock', () => {
    writeConclusionDraft(ALICE, 'exp_1', { lessons: 'a' }, { now: NOW });
    expect(readConclusionDraft(ALICE, 'exp_1', { now: NOW + DRAFT_MAX_AGE_MS + 1 })).toBeNull();
  });

  it('throws away a record with no timestamp rather than keeping it forever', () => {
    localStorage.setItem(reflectionDraftKey(ALICE), JSON.stringify({
      v: 2, owner: ALICE, data: REFLECTION,
    }));
    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
    expect(localStorage.size).toBe(0);
  });
});

describe('bad records', () => {
  it('drops anything that is not readable JSON', () => {
    localStorage.setItem(reflectionDraftKey(ALICE), 'not json');
    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
    expect(localStorage.size).toBe(0);
  });

  it('drops a record with no draft inside it', () => {
    localStorage.setItem(reflectionDraftKey(ALICE), JSON.stringify({ v: 2, owner: ALICE, at: NOW }));
    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
  });

  it('reads a legacy unscoped draft as nothing rather than as anyones', () => {
    localStorage.setItem('unscripted_reflection_draft_v1', JSON.stringify(REFLECTION));
    expect(readReflectionDraft(ALICE, { now: NOW })).toBeNull();
    expect(readReflectionDraft(BOB, { now: NOW })).toBeNull();
  });
});
