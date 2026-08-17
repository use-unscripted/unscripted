import { describe, it, expect } from 'vitest';
import {
  earlyRead, directionsFrom, reflectionFrom, isRuledOut, earlyReadEventProps,
} from './onboarding-early-read';

/** A student who answered only the one required question and skipped the rest. */
const CLARITY_ONLY = { baseline_career_clarity: 4 };

const joined = (read) =>
  [...read.reflection, ...read.directions.map(d => `${d.name} ${d.label}`), read.directionsNote, read.unknown]
    .join(' ');

describe('earlyRead, everything skipped', () => {
  it('says there is not enough rather than filling the screen', () => {
    const read = earlyRead(CLARITY_ONLY);
    expect(read.sparse).toBe(true);
    expect(read.directions).toEqual([]);
    expect(read.directionsNote).toBe('');
    expect(read.unknown).toBe('');
  });

  it('still reflects the one answer it does have', () => {
    const read = earlyRead(CLARITY_ONLY);
    expect(read.reflection.length).toBe(1);
    expect(read.reflection[0]).toContain('4 out of 10');
  });

  it('survives an empty object, a null and every field left blank', () => {
    for (const data of [{}, null, undefined, { current_careers_considered: [], careers_ruled_out: [], pressured_path: '', curious_path: '', current_decision_pressure: [] }]) {
      const read = earlyRead(data ?? undefined);
      expect(read.sparse).toBe(true);
      expect(read.directions).toEqual([]);
    }
  });

  it('is not sparse once anything else is answered', () => {
    expect(earlyRead({ ...CLARITY_ONLY, curious_path: 'Writing' }).sparse).toBe(false);
    expect(earlyRead({ ...CLARITY_ONLY, careers_ruled_out: ['Law'] }).sparse).toBe(false);
    expect(earlyRead({ ...CLARITY_ONLY, pressured_path: 'Law school' }).sparse).toBe(false);
    expect(earlyRead({ ...CLARITY_ONLY, current_decision_pressure: ['Finding an internship'] }).sparse).toBe(false);
  });
});

describe('directionsFrom', () => {
  it('returns the student words, unchanged', () => {
    const read = directionsFrom({ current_careers_considered: ['Investment banking', 'UX research'] });
    expect(read.map(d => d.name)).toEqual(['Investment banking', 'UX research']);
  });

  it('invents nothing when nothing was typed', () => {
    expect(directionsFrom({})).toEqual([]);
    expect(directionsFrom(CLARITY_ONLY)).toEqual([]);
  });

  it('includes the quietly curious answer', () => {
    const read = directionsFrom({ curious_path: 'Writing', current_careers_considered: ['Consulting'] });
    expect(read.map(d => d.name)).toEqual(['Writing', 'Consulting']);
    expect(read[0].source).toBe('curious');
    expect(read[1].source).toBe('considered');
  });

  it('never shows back something the student ruled out', () => {
    const read = directionsFrom({
      current_careers_considered: ['Law school', 'Product management'],
      careers_ruled_out: ['law'],
    });
    expect(read.map(d => d.name)).toEqual(['Product management']);
  });

  it('drops a curious answer that was also ruled out', () => {
    const read = directionsFrom({ curious_path: 'Medicine', careers_ruled_out: ['Medicine'] });
    expect(read).toEqual([]);
  });

  it('does not rule out a word that only lands mid-word', () => {
    // "law" sits inside "flawless". Losing an unrelated answer to that would be
    // a wrong answer, not a rough one.
    const read = directionsFrom({ current_careers_considered: ['Flawless execution roles'], careers_ruled_out: ['Law'] });
    expect(read.map(d => d.name)).toEqual(['Flawless execution roles']);
  });

  it('never shows back a ruled-out career written in a non-latin script', () => {
    // Rendered, not theorised: "Already off the table: 医学" sat two lines above
    // "Worth testing: 医学" on the same screen.
    const read = directionsFrom({
      curious_path: '医学',
      current_careers_considered: ['Кино', 'Product management'],
      careers_ruled_out: ['医学', 'кино'],
    });
    expect(read.map(d => d.name)).toEqual(['Product management']);
  });

  it('shows at most three', () => {
    const read = directionsFrom({
      curious_path: 'Writing',
      current_careers_considered: ['A', 'Banking', 'Consulting', 'Design', 'Teaching'],
    });
    expect(read).toHaveLength(3);
    expect(read[0].name).toBe('Writing');
  });

  it('does not list the same answer twice', () => {
    const read = directionsFrom({ curious_path: 'writing', current_careers_considered: ['Writing'] });
    expect(read).toHaveLength(1);
  });

  it('ignores blanks, whitespace and a non-array', () => {
    const read = directionsFrom({
      curious_path: '   ',
      current_careers_considered: ['', '  ', 'Nursing'],
      careers_ruled_out: 'Law',
    });
    expect(read.map(d => d.name)).toEqual(['Nursing']);
  });

  it('survives regex characters in what a student typed', () => {
    expect(() => directionsFrom({ current_careers_considered: ['c++ (systems)'], careers_ruled_out: ['.*'] })).not.toThrow();
    expect(directionsFrom({ current_careers_considered: ['c++ (systems)'], careers_ruled_out: ['.*'] })).toHaveLength(1);
  });

  it('carries a label saying where each one came from', () => {
    const read = directionsFrom({ curious_path: 'Writing', current_careers_considered: ['Consulting'] });
    expect(read[0].label).toContain('curious');
    expect(read[1].label).toBe('On your list');
  });
});

describe('isRuledOut', () => {
  it('matches however it was capitalised, padded or punctuated', () => {
    expect(isRuledOut('Law', ['  law.  '])).toBe(true);
    expect(isRuledOut('law school', ['Law'])).toBe(true);
    expect(isRuledOut('Law', ['law school'])).toBe(true);
  });

  it('matches whichever way round the longer word sits', () => {
    // The question that collected this promises "we will not suggest it back to
    // you", so a student who ruled out Lawyer must not be handed Law school.
    expect(isRuledOut('Law school', ['Lawyer'])).toBe(true);
    expect(isRuledOut('Lawyer', ['Law school'])).toBe(true);
    expect(directionsFrom({ curious_path: 'Law school', careers_ruled_out: ['Lawyer'] })).toEqual([]);
  });

  it('matches a short word the student typed exactly', () => {
    expect(isRuledOut('HR generalist', ['HR'])).toBe(true);
    expect(isRuledOut('HR', ['HR generalist'])).toBe(true);
    expect(directionsFrom({ current_careers_considered: ['HR generalist'], careers_ruled_out: ['HR'] })).toEqual([]);
  });

  it('does not match on one or two characters', () => {
    expect(isRuledOut('Marketing', ['ma'])).toBe(false);
  });

  // The single most likely pair of answers here is a student who rules out one
  // school and is considering another, since the question's own placeholder
  // reads "e.g. Law school". Dropping the second one is not a rough edge: it
  // empties the screen and then explains the empty screen with a sentence
  // about the student that is not true.
  it('leaves an unrelated career that happens to share a word', () => {
    const pairs = [
      ['Law school', 'Business school'],
      ['Law school', 'Nursing school'],
      ['Computer science', 'Political science'],
      ['Software engineering', 'Civil engineering'],
      ['Product design', 'Graphic design'],
      ['Product management', 'Sports management'],
      ['Data analyst', 'Financial analyst'],
      ['Investment banking', 'Investment management'],
      ['Public relations', 'Public health'],
      ['Sports medicine', 'Sports management'],
      ['Marketing manager', 'Project manager'],
      ['Physical therapy', 'Occupational therapy'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} killed ${considering}`).toBe(false);
      expect(isRuledOut(out, [considering]), `${considering} killed ${out}`).toBe(false);
    }
  });

  it('does not match two answers on a word like "of"', () => {
    expect(isRuledOut('Head of design', ['Director of nursing'])).toBe(false);
    expect(isRuledOut('Master of fine arts', ['Doctor of medicine'])).toBe(false);
  });

  it('drops the same career written with a different ending', () => {
    // Nurse and Nursing is at least as likely as Lawyer and Law school, and
    // "Already off the table: Nurse" directly above "Worth testing: Nursing" is
    // the screen failing at the one thing it is here to do.
    const pairs = [
      ['Nurse', 'Nursing'],
      ['Teacher', 'Teaching'],
      ['Accountant', 'Accounting'],
      ['Therapist', 'Therapy'],
      ['Engineer', 'Engineering'],
      ['Consultant', 'Consulting'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} let ${considering} through`).toBe(true);
      expect(isRuledOut(out, [considering]), `${considering} let ${out} through`).toBe(true);
    }
  });

  it('reads a shorter answer as the whole of a longer one, not a word inside it', () => {
    // Ruling out Nursing has to take Nursing school with it, while ruling out
    // Nursing school leaves Business school alone.
    expect(isRuledOut('Nursing school', ['Nursing'])).toBe(true);
    expect(isRuledOut('Business school', ['Nursing school'])).toBe(false);
    expect(isRuledOut('Medicine', ['Med school'])).toBe(true);
    expect(isRuledOut('Law school', ['Med school'])).toBe(false);
  });

  it('drops nothing for a ruled-out entry with no words in it', () => {
    expect(isRuledOut('Nursing', ['.*'])).toBe(false);
    expect(isRuledOut('Law school', ['!!!'])).toBe(false);
  });

  // A career with no latin letters or digits in it has no words to compare, so
  // the word rule cannot see it at all, not even against a string identical to
  // it. That put "Already off the table: 医学" and "Worth testing: 医学" on the
  // same screen, which is the exact promise this function exists to keep.
  it('matches a career written in a script the word rule cannot read', () => {
    for (const name of ['医学', 'Кино', 'Ιατρική', '의학', '🎬', '???']) {
      expect(isRuledOut(name, [name]), `${name} did not match itself`).toBe(true);
    }
  });

  it('still leaves two different careers in the same script alone', () => {
    expect(isRuledOut('医学', ['法律'])).toBe(false);
    expect(isRuledOut('Кино', ['医学'])).toBe(false);
    expect(isRuledOut('医学', ['Medicine'])).toBe(false);
    expect(isRuledOut('Medicine', ['医学'])).toBe(false);
  });

  it('reads padding and capitals off a non-latin answer the same way', () => {
    expect(isRuledOut('  医学  ', ['医学'])).toBe(true);
    expect(isRuledOut('Кино', ['  кино '])).toBe(true);
  });

  // The trailing "?" comes off the whole-string key but the space in front of
  // it stays, so "医学 ?" and "医学" were two different keys and the screen put
  // both of them up. The same typing in a latin script never showed it, because
  // that side still has a word to compare and never reaches this key at all.
  it('matches a non-latin answer typed with a space before its punctuation', () => {
    expect(isRuledOut('医学', ['医学 ?'])).toBe(true);
    expect(isRuledOut('医学 ?', ['医学'])).toBe(true);
    expect(isRuledOut('Кино', ['Кино !'])).toBe(true);
    expect(isRuledOut('의학 .', ['의학'])).toBe(true);
    expect(isRuledOut('🎬', ['🎬 ?'])).toBe(true);
  });

  it('is the same answer the latin control already gave', () => {
    expect(isRuledOut('Law', ['Law ?'])).toBe(true);
    expect(isRuledOut('Law ?', ['Law'])).toBe(true);
  });

  it('still leaves two different non-latin careers alone with the space in', () => {
    expect(isRuledOut('医学', ['法律 ?'])).toBe(false);
    expect(isRuledOut('医学 ?', ['法律'])).toBe(false);
    expect(isRuledOut('医学', ['???'])).toBe(false);
    expect(isRuledOut('医学 ?', ['???'])).toBe(false);
  });

  // All four of these are two different careers that happen to share the front
  // of a word once an ending comes off. Losing the second one empties the
  // screen and then explains it with a sentence about the student that is not
  // true. Physics and Physical therapy is an ordinary pair of answers from one
  // pre-health student.
  it('leaves a different career that only shares a stem with the ruled-out one', () => {
    const pairs = [
      ['Physics', 'Physical therapy'],
      ['Physics', 'Physician'],
      ['Police', 'Public policy'],
      ['Police', 'Policy analyst'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} killed ${considering}`).toBe(false);
      expect(isRuledOut(out, [considering]), `${considering} killed ${out}`).toBe(false);
    }
  });

  it('still drops the same career when only the ending changed', () => {
    // What the single-letter endings were doing is done here by the longer
    // ending coming off the other side, so none of these move.
    const pairs = [
      ['Physics', 'Physicist'],
      ['Journalism', 'Journalist'],
      ['Economics', 'Economist'],
      ['Psychology', 'Psychologist'],
      ['Pharmacy', 'Pharmacist'],
      ['Education', 'Educator'],
      ['Animation', 'Animator'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} let ${considering} through`).toBe(true);
      expect(isRuledOut(out, [considering]), `${considering} let ${out} through`).toBe(true);
    }
  });

  // MIN_STEM is the only thing holding these apart, and its comment used to
  // name the wrong pair, so it read as a constant that guards nothing. Lower
  // the floor to 3 and every line here starts dropping a career the student is
  // still considering.
  it('does not take an unrelated career with a short ruled-out word', () => {
    expect(isRuledOut('Actuary', ['Acting'])).toBe(false);
    expect(isRuledOut('Artificial intelligence', ['Artist'])).toBe(false);
    expect(isRuledOut('Pathology', ['Patent law'])).toBe(false);
    expect(isRuledOut('Cardiology', ['Care'])).toBe(false);
  });

  // Two careers that share a long front once one of them loses an ending. The
  // share floor is what holds them apart: "chem" is half of "chemical" and
  // "profess" is under three fifths of "professional", while every pair in the
  // test above sits at two thirds or more. Both of these used to be handed back
  // under the line promising they would not be.
  it('leaves a career that only shares a short part of a longer stem', () => {
    const pairs = [
      ['Professor', 'Professional athlete'],
      ['Chemical engineering', 'Chemist'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} killed ${considering}`).toBe(false);
      expect(isRuledOut(out, [considering]), `${considering} killed ${out}`).toBe(false);
    }
  });

  // The pairs the share floor had to survive, sitting either side of the line
  // it draws: "nurs" is four fifths of "nurse" and "educat" is two thirds of
  // "education", so the floor never reaches them.
  it('keeps dropping the ending pairs that sit above the share floor', () => {
    const pairs = [
      ['Nurse', 'Nursing'],
      ['Journalism', 'Journalist'],
      ['Education', 'Educator'],
      ['Animation', 'Animator'],
      ['Pharmacy', 'Pharmacist'],
      ['Therapist', 'Therapy'],
      ['Manager', 'Management'],
      ['Developer', 'Development'],
    ];
    for (const [out, considering] of pairs) {
      expect(isRuledOut(considering, [out]), `${out} let ${considering} through`).toBe(true);
      expect(isRuledOut(out, [considering]), `${considering} let ${out} through`).toBe(true);
    }
  });

  // Known and measured, not an oversight. MIN_STEM is what stops these two
  // meeting, and lowering it also joins Acting to Actuary, Artist to Artificial
  // intelligence and Patent law to Pathology. The share floor above is a
  // different lever and does not reach this pair: neither word loses an ending
  // in the first place, because there is not enough left of either once it
  // comes off.
  it('is documented as missing Acting against Actor', () => {
    expect(isRuledOut('Actor', ['Acting'])).toBe(false);
    expect(isRuledOut('Baker', ['Baking'])).toBe(false);
  });

  it('is false when nothing was ruled out', () => {
    expect(isRuledOut('Law', [])).toBe(false);
    expect(isRuledOut('Law', undefined)).toBe(false);
    expect(isRuledOut('', ['Law'])).toBe(false);
  });
});

describe('reflectionFrom', () => {
  it('reads the clarity number back without dressing it up', () => {
    expect(reflectionFrom({ baseline_career_clarity: 2 })[0]).toContain('2 out of 10');
    expect(reflectionFrom({ baseline_career_clarity: 2 })[0]).toContain('still open');
    expect(reflectionFrom({ baseline_career_clarity: 9 })[0]).toContain('holds up');
  });

  it('hands back the words the question used, not our word for it', () => {
    // The student was asked how certain they are. They never saw "clarity",
    // which is our name for the field, not theirs.
    expect(reflectionFrom({ baseline_career_clarity: 3 })[0].toLowerCase()).not.toContain('clarity');
    expect(reflectionFrom({ baseline_career_clarity: 3 })[0]).toContain('certain');
  });

  it('notices a real gap between the two numbers and ignores a small one', () => {
    const wide = reflectionFrom({ baseline_career_clarity: 8, baseline_confidence: 3 });
    expect(wide.some(l => l.includes('clearer on the direction'))).toBe(true);

    const other = reflectionFrom({ baseline_career_clarity: 2, baseline_confidence: 9 });
    expect(other.some(l => l.includes('do not know yet'))).toBe(true);

    const close = reflectionFrom({ baseline_career_clarity: 5, baseline_confidence: 4 });
    expect(close).toHaveLength(1);
  });

  it('does not say they are sure of not knowing right after saying some is settled', () => {
    const lines = reflectionFrom({ baseline_career_clarity: 4, baseline_confidence: 7 });
    expect(lines[0]).toContain('some of this is settled');
    expect(lines.some(l => l.includes('do not know yet'))).toBe(false);
  });

  it('counts the careers on the list', () => {
    expect(reflectionFrom({ current_careers_considered: ['Banking'] })[0]).toBe('One career on your list: Banking.');
    expect(reflectionFrom({ current_careers_considered: ['Banking', 'Design'] })[0])
      .toBe('2 careers on your list: Banking, Design.');
  });

  it('says what was ruled out and promises not to bring it back', () => {
    const lines = reflectionFrom({ careers_ruled_out: ['Law', 'Medicine'] });
    expect(lines[0]).toContain('Law, Medicine');
    expect(lines[0]).toContain('will not put those back');
  });

  it('keeps the pressure separate from the careers', () => {
    const lines = reflectionFrom({ pressured_path: 'Law school', curious_path: 'Writing' });
    expect(lines.some(l => l.includes('pushed at you: Law school'))).toBe(true);
    // The curious answer is a direction, not a line here, so it is not said twice.
    expect(lines.some(l => l.includes('Writing'))).toBe(false);
  });

  it('includes the fixed choices and the note for what they are deciding', () => {
    const lines = reflectionFrom({
      current_decision_pressure: ['Finding an internship'],
      current_decision_pressure_note: 'whether to transfer',
    });
    expect(lines[0]).toBe('In front of you this term: Finding an internship.');
    expect(lines[1]).toBe('Also on your mind: whether to transfer.');
  });

  it('keeps a note that opens with a conjunction off the end of the list', () => {
    // Comma-joined it reads as a broken list item: "Summer internship, and a
    // transfer". The note is the student's own sentence, so it gets its own line
    // rather than being edited.
    const lines = reflectionFrom({
      current_decision_pressure: ['Summer internship'],
      current_decision_pressure_note: 'and a transfer',
    });
    expect(lines[0]).toBe('In front of you this term: Summer internship.');
    expect(lines[1]).toBe('Also on your mind: and a transfer.');
  });

  it('uses the one line when only the note was written', () => {
    expect(reflectionFrom({ current_decision_pressure_note: 'whether to transfer' }))
      .toEqual(['In front of you this term: whether to transfer.']);
  });

  it('says nothing about a question that was skipped', () => {
    expect(reflectionFrom({})).toEqual([]);
    expect(reflectionFrom({ current_careers_considered: [], careers_ruled_out: [] })).toEqual([]);
  });
});

describe('the honest unknown', () => {
  it('asks whose the pressured path is when there is one', () => {
    const read = earlyRead({ ...CLARITY_ONLY, pressured_path: 'Law school' });
    expect(read.unknown).toContain('Law school');
    expect(read.unknown).toContain('yours or someone else');
  });

  it('does not re-open a pressured career the student already ruled out', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      careers_ruled_out: ['Medicine'],
      pressured_path: 'Medicine',
      current_careers_considered: ['Nursing'],
    });
    expect(read.unknown).not.toContain('Medicine');
    expect(read.unknown).toContain('Nursing');
  });

  it('asks which one they would like doing when there are several', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_careers_considered: ['Banking', 'Design'] });
    expect(read.unknown).toContain('Which of these');
  });

  it('claims nothing about how the careers compare to each other', () => {
    const read = earlyRead({ ...CLARITY_ONLY, curious_path: 'Writing', current_careers_considered: ['Investment banking'] });
    expect(read.unknown).toContain('Which of these');
    expect(read.unknown).not.toContain('read about the same');
  });

  it('asks whether the single one holds up', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_careers_considered: ['Banking'] });
    expect(read.unknown).toContain('Whether Banking holds up');
  });

  it('falls back to the honest general one when nothing was named', () => {
    const read = earlyRead({ ...CLARITY_ONLY, careers_ruled_out: ['Law'] });
    expect(read.unknown).toContain('What kind of work you actually like');
  });
});

describe('earlyRead, the empty middle', () => {
  it('explains an empty list when every named career was ruled out', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_careers_considered: ['Law'], careers_ruled_out: ['Law'] });
    expect(read.directions).toEqual([]);
    expect(read.directionsNote).toContain('also on your ruled-out list');
  });

  it('explains an empty list when no career was named at all', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_decision_pressure: ['Choosing or changing my major'] });
    expect(read.directionsNote).toContain('not named a career yet');
  });

  it('leaves the note empty when there are directions to show', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_careers_considered: ['Banking'] });
    expect(read.directionsNote).toBe('');
  });

  // A student naming one school and ruling out another is an ordinary pair of
  // answers, and it used to empty the screen and then tell them their own
  // career was on their ruled-out list.
  it('does not empty the screen over a word two unrelated careers share', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      current_careers_considered: ['Business school'],
      careers_ruled_out: ['Law school'],
    });
    expect(read.directions.map(d => d.name)).toEqual(['Business school']);
    expect(read.directionsNote).toBe('');
  });

  // One ruled-out answer used to take the student's only other answer with it,
  // leaving a heading promising directions over a sentence saying we treated
  // everything they named as ruled out. They did not name it.
  it('keeps a pre-health student their only career', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      current_careers_considered: ['Physical therapy'],
      careers_ruled_out: ['Physics'],
    });
    expect(read.directions.map(d => d.name)).toEqual(['Physical therapy']);
    expect(read.directionsNote).toBe('');
  });

  // The matcher is deliberately loose, so it must never be what decides to
  // print a sentence about what the student did. Only the same career typed
  // into both questions can do that.
  it('only says a career is on the ruled-out list when the student put it there', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      current_careers_considered: ['Nursing school'],
      careers_ruled_out: ['Nursing'],
    });
    expect(read.directions).toEqual([]);
    expect(read.directionsNote).not.toContain('also on your ruled-out list');
    expect(read.directionsNote).toContain('took everything you named as already ruled out');
  });

  it('still says it plainly when they did type the same career into both', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      curious_path: 'Law',
      current_careers_considered: ['Medicine'],
      careers_ruled_out: ['medicine.', 'Law'],
    });
    expect(read.directions).toEqual([]);
    expect(read.directionsNote).toContain('also on your ruled-out list');
  });

  // The screen prints the ruled-out list and the pressured path two lines above
  // this note, so a note saying no career was named contradicts the screen it
  // sits on. "I do not know what I want but I know it is not X" is a signature
  // student here, not an edge case.
  it('does not claim nothing was named when careers were ruled out', () => {
    const read = earlyRead({ ...CLARITY_ONLY, careers_ruled_out: ['Law school', 'Medicine'] });
    expect(read.directions).toEqual([]);
    expect(read.directionsNote).not.toContain('not named a career yet');
    expect(read.directionsNote).toContain('do not want');
  });

  it('does not claim nothing was named when a career is being pushed at them', () => {
    const read = earlyRead({ ...CLARITY_ONLY, pressured_path: 'Medicine' });
    expect(read.directionsNote).not.toContain('not named a career yet');
    expect(read.directionsNote).toContain('pushed at you');
  });

  it('does not claim nothing was named when both were answered', () => {
    const read = earlyRead({ ...CLARITY_ONLY, careers_ruled_out: ['Medicine'], pressured_path: 'Medicine' });
    expect(read.directionsNote).not.toContain('not named a career yet');
    expect(read.directionsNote).toContain('ruled out');
    expect(read.directionsNote).toContain('pushed at you');
  });
});

describe('how many directions there were before the cap', () => {
  it('reports the full count so the screen can say what it left out', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      current_careers_considered: ['Investment banking', 'Consulting', 'Product design', 'Teaching', 'Nursing'],
    });
    expect(read.directions).toHaveLength(3);
    expect(read.directionsTotal).toBe(5);
  });

  it('reports the same number when nothing was left out', () => {
    const read = earlyRead({ ...CLARITY_ONLY, current_careers_considered: ['Banking', 'Design'] });
    expect(read.directionsTotal).toBe(2);
    expect(read.directions).toHaveLength(2);
  });

  it('does not count a career the student ruled out', () => {
    const read = earlyRead({
      ...CLARITY_ONLY,
      current_careers_considered: ['Banking', 'Law school'],
      careers_ruled_out: ['Law'],
    });
    expect(read.directionsTotal).toBe(1);
  });
});

describe('what the screen is not allowed to say', () => {
  const FILLED = {
    baseline_career_clarity: 6,
    baseline_confidence: 2,
    current_careers_considered: ['Investment banking', 'Product design'],
    careers_ruled_out: ['Law'],
    pressured_path: 'Medicine',
    curious_path: 'Writing',
    current_decision_pressure: ['Finding an internship'],
    current_decision_pressure_note: 'whether to study abroad',
  };

  it('never scores, ranks, or claims a fit', () => {
    const text = joined(earlyRead(FILLED)).toLowerCase();
    for (const word of ['%', 'match', 'best fit', 'ranked', 'ranking', 'top pick', 'score', 'recommend']) {
      expect(text.includes(word), `said "${word}"`).toBe(false);
    }
  });

  it('never uses an em dash or an en dash', () => {
    for (const data of [FILLED, CLARITY_ONLY, {}]) {
      expect(/[—–]/.test(joined(earlyRead(data)))).toBe(false);
    }
  });

  it('names only careers the student typed', () => {
    const read = earlyRead(FILLED);
    for (const d of read.directions) {
      expect([...FILLED.current_careers_considered, FILLED.curious_path]).toContain(d.name);
    }
  });
});

describe('earlyReadEventProps', () => {
  it('sends counts and booleans, never a word the student typed', () => {
    const read = earlyRead({
      baseline_career_clarity: 5,
      current_careers_considered: ['Investment banking'],
      pressured_path: 'my father the surgeon',
    });
    const props = earlyReadEventProps(read);
    expect(props).toEqual({ sparse: false, directions_count: 1, reflection_count: 3 });
    for (const value of Object.values(props)) {
      expect(['number', 'boolean']).toContain(typeof value);
    }
  });

  it('reports the skipped case as sparse', () => {
    expect(earlyReadEventProps(earlyRead(CLARITY_ONLY))).toEqual({
      sparse: true, directions_count: 0, reflection_count: 1,
    });
  });
});
