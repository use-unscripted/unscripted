import { describe, expect, it } from 'vitest';
import {
  canonicalToken,
  fillProfileTokens,
  validateGuide,
} from './guideSchema';

/** Valid on every rule, so each test can break exactly one thing. */
function validStep(overrides = {}) {
  return {
    title: 'Register for the panel',
    description: 'Lock in your seat before the room fills.',
    estimated_minutes: 8,
    is_first_rep: true,
    done_when: 'the event is on your calendar',
    proof_capture: 'a screenshot of the confirmation',
    artifact: { kind: 'none' },
    ...overrides,
  };
}

function validGuide(overrides = {}) {
  return {
    guide_title: 'Test the analyst path',
    objective: 'Talk to two people who do the job',
    proof_requirement: 'a screenshot of the sent email',
    steps: [validStep()],
    ...overrides,
  };
}

/** A guide identical to the valid one apart from a single step field. */
function guideWith(field, value) {
  return validGuide({ steps: [validStep({ [field]: value })] });
}

describe('validateGuide: shape', () => {
  it('rejects a non-object', () => {
    for (const raw of [null, undefined, 'a guide', 42]) {
      const result = validateGuide(raw);
      expect(result.ok).toBe(false);
      expect(result.guide).toBeNull();
      expect(result.errors).toContain('Model returned no guide object.');
    }
  });

  it('rejects a guide with no steps', () => {
    expect(validateGuide(validGuide({ steps: [] })).errors).toContain('Guide has no steps.');
    expect(validateGuide(validGuide({ steps: undefined })).errors).toContain('Guide has no steps.');
    expect(validateGuide(validGuide({ steps: [] })).guide).toBeNull();
  });

  it('reports a missing objective but still returns the repaired guide', () => {
    const result = validateGuide(validGuide({ objective: '' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Guide is missing an objective.');
    expect(result.guide.steps).toHaveLength(1);
  });

  it('renumbers steps from the array order', () => {
    const result = validateGuide(
      validGuide({
        steps: [validStep({ step_number: 7 }), validStep({ step_number: 3, is_first_rep: false })],
      })
    );
    expect(result.guide.steps.map(s => s.step_number)).toEqual([1, 2]);
  });

  it('fills in missing done_when and proof_capture rather than failing', () => {
    const result = validateGuide(
      validGuide({ steps: [validStep({ done_when: '', proof_capture: '' })] })
    );
    expect(result.ok).toBe(true);
    expect(result.guide.steps[0].done_when).toBe('');
    expect(result.warnings).toContain('Step 1: missing done_when.');
    expect(result.warnings).toContain('Step 1: missing proof_capture.');
  });
});

describe('validateGuide: minute coercion', () => {
  const minutesOf = step => validateGuide(validGuide({ steps: [step] })).guide.steps[0].estimated_minutes;

  it('accepts a number', () => {
    expect(minutesOf(validStep({ estimated_minutes: 9 }))).toBe(9);
  });

  it('rounds a fractional number', () => {
    expect(minutesOf(validStep({ estimated_minutes: 7.6 }))).toBe(8);
  });

  it('reads the first number out of a string', () => {
    expect(minutesOf(validStep({ estimated_minutes: '10' }))).toBe(10);
    expect(minutesOf(validStep({ estimated_minutes: '10 minutes' }))).toBe(10);
    expect(minutesOf(validStep({ estimated_minutes: 'about 8 min' }))).toBe(8);
  });

  it('falls back to a model-invented estimated_time field and drops it', () => {
    const result = validateGuide(
      validGuide({ steps: [validStep({ estimated_minutes: undefined, estimated_time: '7 minutes' })] })
    );
    expect(result.guide.steps[0].estimated_minutes).toBe(7);
    expect(result.guide.steps[0]).not.toHaveProperty('estimated_time');
  });

  it('defaults to 15 minutes when nothing parses', () => {
    const result = validateGuide(
      validGuide({ steps: [validStep({ estimated_minutes: 'a while' })] })
    );
    expect(result.guide.steps[0].estimated_minutes).toBe(15);
    expect(result.warnings).toContain('Step 1: no usable time estimate; defaulted to 15 minutes.');
  });

  it('rewrites the guide total instead of trusting the model', () => {
    const total = steps => validateGuide(validGuide({ steps })).guide.estimated_time;
    expect(total([validStep({ estimated_minutes: 1 })])).toBe('1 minute');
    expect(total([validStep({ estimated_minutes: 8 })])).toBe('8 minutes');
    expect(
      total([validStep({ estimated_minutes: 10 }), validStep({ is_first_rep: false, estimated_minutes: 50 })])
    ).toBe('1 hour');
    expect(
      total([validStep({ estimated_minutes: 10 }), validStep({ is_first_rep: false, estimated_minutes: 80 })])
    ).toBe('1.5 hours');
  });
});

describe('validateGuide: first rep', () => {
  it('assigns the first rep to step 1 when the model marked none', () => {
    const result = validateGuide(
      validGuide({ steps: [validStep({ is_first_rep: false }), validStep({ is_first_rep: false })] })
    );
    expect(result.guide.steps.map(s => s.is_first_rep)).toEqual([true, false]);
    expect(result.warnings).toContain('Expected exactly one first rep, found 0; using step 1.');
  });

  it('collapses multiple first reps to step 1', () => {
    const result = validateGuide(validGuide({ steps: [validStep(), validStep()] }));
    expect(result.guide.steps.map(s => s.is_first_rep)).toEqual([true, false]);
    expect(result.warnings).toContain('Expected exactly one first rep, found 2; using step 1.');
  });

  it('moves a first rep that landed on a later step', () => {
    const result = validateGuide(
      validGuide({ steps: [validStep({ is_first_rep: false }), validStep()] })
    );
    expect(result.guide.steps.map(s => s.is_first_rep)).toEqual([true, false]);
    expect(result.warnings).toContain('First rep was not step 1; reassigned to step 1.');
  });

  // Two tiers on purpose: 11–15 is still usable, so rejecting it would spend a
  // retry on output the student could have acted on.
  it('warns but passes when the first rep is 11-15 minutes', () => {
    const result = validateGuide(validGuide({ steps: [validStep({ estimated_minutes: 12 })] }));
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('First rep is 12 minutes, over the 10-minute target.');
  });

  it('rejects a first rep over 15 minutes', () => {
    const result = validateGuide(validGuide({ steps: [validStep({ estimated_minutes: 20 })] }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('First rep is 20 minutes');
  });
});

describe('validateGuide: artifacts', () => {
  const withArtifact = artifact => validateGuide(guideWith('artifact', artifact));

  it('rejects an email that describes the message instead of writing it', () => {
    const result = withArtifact({ kind: 'email', subject: 'Coffee?', body: '   ' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('needs a full body');
  });

  it('rejects a message with no body', () => {
    expect(withArtifact({ kind: 'message' }).ok).toBe(false);
  });

  it('rejects a list kind with no items', () => {
    for (const kind of ['question_list', 'outline', 'checklist', 'search_query']) {
      const result = withArtifact({ kind, body: 'Paste these into LinkedIn.' });
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('needs its items written out');
    }
  });

  it('accepts kind "none" with nothing else', () => {
    expect(withArtifact({ kind: 'none' }).ok).toBe(true);
  });

  it('treats an unrecognised kind as none', () => {
    const result = withArtifact({ kind: 'voicemail', body: 'Hi there' });
    expect(result.guide.steps[0].artifact.kind).toBe('none');
    expect(result.warnings).toContain('Step 1: unknown artifact kind "voicemail"; treated as none.');
    expect(result.ok).toBe(true);
  });

  it('defaults a missing artifact to none', () => {
    const result = validateGuide(guideWith('artifact', undefined));
    expect(result.guide.steps[0].artifact.kind).toBe('none');
    expect(result.ok).toBe(true);
  });

  it('drops empty items', () => {
    const result = withArtifact({ kind: 'checklist', items: ['Bring a notebook', '', null] });
    expect(result.guide.steps[0].artifact.items).toEqual(['Bring a notebook']);
  });

  // A subject on a list renders nowhere, but its tokens would still be counted as
  // blanks — the student is asked to fill in something they cannot see.
  it('strips a subject from a non-email artifact', () => {
    const result = withArtifact({ kind: 'question_list', subject: 'Questions', items: ['Why here?'] });
    expect(result.guide.steps[0].artifact).not.toHaveProperty('subject');
  });

  it('keeps the subject on an email', () => {
    const result = withArtifact({ kind: 'email', subject: 'Quick question', body: 'Hi there.' });
    expect(result.guide.steps[0].artifact.subject).toBe('Quick question');
  });

  it('declares a token the model used but forgot to list', () => {
    const result = withArtifact({
      kind: 'email',
      subject: 'Hello from [YOUR_UNIVERSITY]',
      body: 'Hi [CONTACT_NAME], I am a student.',
      blanks: [],
    });
    expect(result.guide.steps[0].artifact.blanks).toEqual([
      { token: '[YOUR_UNIVERSITY]', hint: 'Your university' },
      { token: '[CONTACT_NAME]', hint: 'Contact name' },
    ]);
    expect(result.warnings).toContain('Step 1: token [YOUR_UNIVERSITY] was used but not declared; added to blanks.');
  });

  it('finds tokens in items too', () => {
    const result = withArtifact({ kind: 'search_query', items: ['[YOUR_UNIVERSITY] alumni analyst'] });
    expect(result.guide.steps[0].artifact.blanks.map(b => b.token)).toEqual(['[YOUR_UNIVERSITY]']);
  });

  it('drops a declared blank that appears nowhere in the artifact', () => {
    const result = withArtifact({
      kind: 'email',
      body: 'Hi [CONTACT_NAME], I am a student.',
      blanks: [
        { token: '[CONTACT_NAME]', hint: 'Their name' },
        { token: '[DEAL_NAME]', hint: 'A deal they worked on' },
      ],
    });
    expect(result.guide.steps[0].artifact.blanks).toEqual([
      { token: '[CONTACT_NAME]', hint: 'Their name' },
    ]);
    expect(result.warnings).toContain('Step 1: dropped 1 blank(s) not present in the artifact.');
  });

  it('writes a readable hint when the model left one out', () => {
    const result = withArtifact({
      kind: 'email',
      body: 'Hi [YOUR_UNIVERSITY_NAME].',
      blanks: [{ token: '[YOUR_UNIVERSITY_NAME]' }],
    });
    expect(result.guide.steps[0].artifact.blanks[0].hint).toBe('Your university name');
  });
});

describe('validateGuide: proof destination guard', () => {
  // The app has no inbox. A guide naming one sends a student's only evidence
  // into a black hole.
  it('rejects an email address in the top-level proof requirement', () => {
    const result = validateGuide(validGuide({ proof_requirement: 'Email it to proof@unscripted.app' }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('proof@unscripted.app');
  });

  it('rejects an email address in a step proof_capture', () => {
    const result = validateGuide(guideWith('proof_capture', 'BCC evidence@useunscripted.com on the email'));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('evidence@useunscripted.com');
  });

  it('accepts proof that points at the Proof of Work page', () => {
    const result = validateGuide(
      guideWith('proof_capture', 'a screenshot of the sent email, added on the Proof of Work page')
    );
    expect(result.ok).toBe(true);
  });

  // Only proof fields are searched, so an address the student is told to write TO
  // is left alone.
  it('leaves an address in the artifact body alone', () => {
    const result = validateGuide(
      guideWith('artifact', { kind: 'email', body: 'Send this to careers@fairfield.edu.' })
    );
    expect(result.ok).toBe(true);
  });
});

describe('fillProfileTokens', () => {
  const PROFILE = {
    name: 'Maya Chen',
    college: 'Fairfield University',
    major: 'Finance',
    school_year: 'Junior',
    graduation_year: '2027',
  };

  it('substitutes the canonical tokens across subject, body, and items', () => {
    const filled = fillProfileTokens(
      {
        kind: 'email',
        subject: 'Question from a [YOUR_UNIVERSITY] student',
        body: 'I am [YOUR_NAME], a [YOUR_YEAR] studying [YOUR_MAJOR], graduating [YOUR_GRAD_YEAR].',
        items: ['[YOUR_UNIVERSITY] alumni in equity research'],
        blanks: [],
      },
      PROFILE
    );
    expect(filled.subject).toBe('Question from a Fairfield University student');
    expect(filled.body).toBe('I am Maya Chen, a Junior studying Finance, graduating 2027.');
    expect(filled.items).toEqual(['Fairfield University alumni in equity research']);
  });

  // The prompt names five exact tokens; the model produces variants anyway, and
  // an unfilled variant ships inside a real outbound email.
  it('canonicalises the aliases the model drifts to', () => {
    const filled = fillProfileTokens(
      { kind: 'email', body: '[STUDENT_NAME] · [UNIVERSITY_NAME] · [MAJOR] · [CLASS_YEAR] · [GRADUATION_YEAR]' },
      PROFILE
    );
    expect(filled.body).toBe('Maya Chen · Fairfield University · Finance · Junior · 2027');
  });

  it('exposes the alias map through canonicalToken', () => {
    expect(canonicalToken('[YOUR_SCHOOL]')).toBe('[YOUR_UNIVERSITY]');
    expect(canonicalToken('[CONTACT_NAME]')).toBe('[CONTACT_NAME]');
  });

  it('keeps only the blanks the student still has to fill', () => {
    const filled = fillProfileTokens(
      {
        kind: 'email',
        body: 'Hi [CONTACT_NAME], I am [YOUR_NAME] from [YOUR_UNIVERSITY].',
        blanks: [
          { token: '[CONTACT_NAME]', hint: 'Their name' },
          { token: '[YOUR_NAME]', hint: 'Your name' },
          { token: '[YOUR_UNIVERSITY]', hint: 'Your university' },
        ],
      },
      PROFILE
    );
    expect(filled.blanks).toEqual([{ token: '[CONTACT_NAME]', hint: 'Their name' }]);
    expect(filled.prefilled).toEqual(['[YOUR_NAME]', '[YOUR_UNIVERSITY]']);
  });

  it('reports each prefilled token once, by the spelling the model used', () => {
    const filled = fillProfileTokens(
      { kind: 'email', body: '[STUDENT_NAME] again: [STUDENT_NAME]' },
      PROFILE
    );
    expect(filled.prefilled).toEqual(['[STUDENT_NAME]']);
  });

  it('leaves everything to the student when there is no profile', () => {
    const artifact = {
      kind: 'email',
      body: 'I am [YOUR_NAME] from [YOUR_UNIVERSITY].',
      blanks: [
        { token: '[YOUR_NAME]', hint: 'Your name' },
        { token: '[YOUR_UNIVERSITY]', hint: 'Your university' },
      ],
    };
    const filled = fillProfileTokens(artifact, null);
    expect(filled.body).toBe('I am [YOUR_NAME] from [YOUR_UNIVERSITY].');
    expect(filled.blanks).toEqual(artifact.blanks);
    expect(filled.prefilled).toEqual([]);
  });

  it('ignores a profile field that is blank or not a string', () => {
    const filled = fillProfileTokens(
      { kind: 'email', body: '[YOUR_NAME] from [YOUR_UNIVERSITY], class of [YOUR_GRAD_YEAR]' },
      { name: '   ', college: '', graduation_year: 2027 }
    );
    expect(filled.body).toBe('[YOUR_NAME] from [YOUR_UNIVERSITY], class of [YOUR_GRAD_YEAR]');
    expect(filled.prefilled).toEqual([]);
  });

  it('handles an artifact with no tokens at all', () => {
    const filled = fillProfileTokens(
      { kind: 'checklist', items: ['Bring a notebook'], blanks: [] },
      PROFILE
    );
    expect(filled.items).toEqual(['Bring a notebook']);
    expect(filled.blanks).toEqual([]);
    expect(filled.prefilled).toEqual([]);
  });

  it('handles an artifact with no items and no body', () => {
    const filled = fillProfileTokens({ kind: 'none' }, PROFILE);
    expect(filled.items).toEqual([]);
    expect(filled.blanks).toEqual([]);
  });

  it('passes a missing artifact straight through', () => {
    expect(fillProfileTokens(null, PROFILE)).toBeNull();
    expect(fillProfileTokens(undefined, PROFILE)).toBeUndefined();
  });

  it('does not mutate the stored artifact', () => {
    const artifact = {
      kind: 'email',
      body: 'I am [YOUR_NAME].',
      blanks: [{ token: '[YOUR_NAME]', hint: 'Your name' }],
    };
    const snapshot = JSON.parse(JSON.stringify(artifact));
    fillProfileTokens(artifact, PROFILE);
    expect(artifact).toEqual(snapshot);
  });
});