/**
 * Pre-filled Mission Guide — prompt, response schema, and validator.
 *
 * The guide's job is to hand the student something to EDIT, not a description of
 * something to write. Every language-producing step carries a finished artifact
 * (the actual email, the actual questions) with only genuinely-unknowable facts
 * left as [BRACKETED] blanks.
 *
 * Everything new lives inside steps[] items, which the MissionGuides entity types
 * as untyped objects — so this persists with no entity schema change.
 */

export const ARTIFACT_KINDS = [
  'email',
  'message',
  'question_list',
  'outline',
  'checklist',
  'search_query',
  'none',
];

const KINDS_NEEDING_BODY = ['email', 'message'];
const KINDS_NEEDING_ITEMS = ['question_list', 'outline', 'checklist', 'search_query'];

export const PROOF_INBOX = 'proof@useunscripted.com';

// ── Prompt ──────────────────────────────────────────────────────────────────

export function buildGuidePrompt(experiment, { variationInstruction = '', version = 1 } = {}) {
  const base = `You are Unscripted, an AI career coach for college students.

Generate a PRE-FILLED Mission Guide for the experiment below.

Experiment title: "${experiment.title}"
Objective: "${experiment.objective}"
Path being tested: "${experiment.path_name || 'Not specified'}"
${experiment.deliverable ? `Deliverable: "${experiment.deliverable}"` : ''}

This is Version ${version}.

## What makes this different from a normal guide

A normal guide TELLS the student what to do: "Send a personalized cold email."
That is useless. It hands them a blank page and an 8-hour bill, and they quit.

This guide DOES the work up front and hands them something to EDIT.
You are not describing the email. You are WRITING the email.

## Hard rules

1. Every step that involves producing language MUST carry a finished artifact:
   the actual email (subject + full body), the actual questions, the actual
   outline with real section headers. Written out in full. Never a description
   of what to write.

2. Artifacts are ~90% complete. The ONLY blanks are facts you genuinely cannot
   know — the person's name, their firm, a detail from their background. Mark
   each blank as [SQUARE_BRACKET_TOKEN] and list it in "blanks" with a short
   hint. Never leave a blank for something you could write yourself.
   "[WRITE A COMPELLING OPENING]" is a failure. Write the opening.

3. Use ONE token per distinct fact, spelled identically everywhere it appears.
   [UNIVERSITY_NAME] and [YOUR_UNIVERSITY_NAME] in the same guide is a bug.
   Every token you use must appear in that artifact's "blanks" array.

4. Exactly ONE step has is_first_rep: true, and it must be step_number 1. It is
   a ≤10 minute action producing something real in one sitting, before the
   student closes the tab. Highest-leverage first move, ending with an artifact
   in their hand.

5. Never assume the student already has a person, company, or target. If the
   experiment needs one, finding it is the first rep — and it carries an
   artifact too: literal copy-pasteable search strings (LinkedIn search syntax,
   alumni-directory filters), not "search for analysts".

6. Order steps so the student's own writing effort comes LAST, after momentum
   exists. Front-load steps where they only have to send, click, or ask.

7. "done_when" is an objectively checkable fact — "the email is in your sent
   folder", "a calendar invite exists". Never a feeling like "you understand X".

8. "proof_capture" states how evidence is captured AS A BYPRODUCT of doing the
   step — BCC ${PROOF_INBOX} on the send, forward the calendar invite, paste the
   reply. Never a separate chore. The top-level "proof_requirement" follows the
   same rule: evidence that already exists because the steps were done. "Take a
   screenshot at the end" is a failure.

9. estimated_minutes is a NUMBER of minutes. Not a string, not a range.

10. Format email and message bodies as a real email, using \\n\\n between the
    greeting, each paragraph, and the sign-off. One unbroken block of text is a
    failure — it has to be pasteable into Gmail as-is.

11. Voice: a competent 20-year-old writing to a stranger. Warm, direct, no
    filler, no "I hope this email finds you well", no corporate throat-clearing.
    Short sentences. Sendable as-is once blanks are filled.

Write it as if the student will send your words verbatim to a real professional
today — because they will.`;

  return variationInstruction
    ? `${base}\n\nVariation instruction: ${variationInstruction}`
    : base;
}

// ── Response schema ─────────────────────────────────────────────────────────

const ARTIFACT_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ARTIFACT_KINDS },
    subject: { type: 'string' },
    body: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
    blanks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          hint: { type: 'string' },
        },
      },
    },
  },
};

export const GUIDE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    guide_title: { type: 'string' },
    objective: { type: 'string' },
    estimated_time: { type: 'string' },
    deliverable: { type: 'string' },
    proof_requirement: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step_number: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          estimated_minutes: { type: 'number' },
          is_first_rep: { type: 'boolean' },
          done_when: { type: 'string' },
          proof_capture: { type: 'string' },
          artifact: ARTIFACT_SCHEMA,
        },
      },
    },
    reflection_questions: { type: 'array', items: { type: 'string' } },
  },
};

// ── Validation ──────────────────────────────────────────────────────────────

const TOKEN_RE = /\[[A-Z0-9_]{2,60}\]/g;

/** "[YOUR_UNIVERSITY_NAME]" -> "Your university name" */
function humanizeToken(token) {
  const words = token.replace(/^\[|\]$/g, '').split('_').filter(Boolean);
  if (!words.length) return 'Fill this in';
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Accepts 15, "15", "15 minutes", "about 20 min". Returns null if unparseable. */
function coerceMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function collectTokens(artifact) {
  const sources = [artifact.subject, artifact.body, ...(artifact.items || [])];
  const found = new Set();
  for (const source of sources) {
    if (typeof source !== 'string') continue;
    for (const token of source.match(TOKEN_RE) || []) found.add(token);
  }
  return found;
}

/**
 * Repairs what is safely repairable, and reports what is not.
 *
 * Returns { ok, guide, errors, warnings }. `errors` non-empty means the caller
 * should regenerate; `warnings` are silent fixes worth surfacing in dev.
 */
export function validateGuide(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, guide: null, errors: ['Model returned no guide object.'], warnings };
  }

  const guide = { ...raw };

  if (!guide.objective) errors.push('Guide is missing an objective.');
  if (!Array.isArray(guide.steps) || guide.steps.length === 0) {
    return { ok: false, guide: null, errors: [...errors, 'Guide has no steps.'], warnings };
  }

  guide.steps = guide.steps.map((rawStep, index) => {
    const step = { ...rawStep };
    const label = `Step ${index + 1}`;

    step.step_number = index + 1;

    const minutes = coerceMinutes(step.estimated_minutes ?? step.estimated_time);
    if (minutes === null) {
      warnings.push(`${label}: no usable time estimate; defaulted to 15 minutes.`);
      step.estimated_minutes = 15;
    } else {
      step.estimated_minutes = minutes;
    }
    delete step.estimated_time;

    if (!step.done_when) {
      warnings.push(`${label}: missing done_when.`);
      step.done_when = '';
    }
    if (!step.proof_capture) {
      warnings.push(`${label}: missing proof_capture.`);
      step.proof_capture = '';
    }

    // ── Artifact ──
    const artifact = { ...(step.artifact || {}) };
    if (!ARTIFACT_KINDS.includes(artifact.kind)) {
      if (artifact.kind) warnings.push(`${label}: unknown artifact kind "${artifact.kind}"; treated as none.`);
      artifact.kind = 'none';
    }
    artifact.items = Array.isArray(artifact.items) ? artifact.items.filter(Boolean) : [];
    artifact.blanks = Array.isArray(artifact.blanks) ? artifact.blanks : [];

    if (artifact.kind !== 'none') {
      const hasBody = typeof artifact.body === 'string' && artifact.body.trim().length > 0;
      const hasItems = artifact.items.length > 0;

      if (KINDS_NEEDING_BODY.includes(artifact.kind) && !hasBody) {
        errors.push(`${label}: artifact kind "${artifact.kind}" has no body — the guide describes the message instead of writing it.`);
      }
      if (KINDS_NEEDING_ITEMS.includes(artifact.kind) && !hasItems) {
        errors.push(`${label}: artifact kind "${artifact.kind}" has no items — nothing was actually written out.`);
      }

      // Every token used must be declared. This is the defect that ships an
      // unfilled [TOKEN] inside a real outbound email.
      const used = collectTokens(artifact);
      const declared = new Set(
        artifact.blanks.map(b => (b && typeof b.token === 'string' ? b.token.trim() : '')).filter(Boolean)
      );

      for (const token of used) {
        if (!declared.has(token)) {
          warnings.push(`${label}: token ${token} was used but not declared; added to blanks.`);
          artifact.blanks.push({ token, hint: humanizeToken(token) });
        }
      }

      // Drop declared-but-unused blanks so the fill-in UI has no dead fields.
      const before = artifact.blanks.length;
      artifact.blanks = artifact.blanks.filter(b => b && used.has(b.token));
      if (artifact.blanks.length !== before) {
        warnings.push(`${label}: dropped ${before - artifact.blanks.length} blank(s) not present in the artifact.`);
      }

      artifact.blanks = artifact.blanks.map(b => ({
        token: b.token,
        hint: b.hint || humanizeToken(b.token),
      }));
    }

    step.artifact = artifact;
    return step;
  });

  // ── First rep ──
  const firstRepCount = guide.steps.filter(s => s.is_first_rep).length;
  if (firstRepCount !== 1) {
    warnings.push(`Expected exactly one first rep, found ${firstRepCount}; using step 1.`);
    guide.steps.forEach((s, i) => { s.is_first_rep = i === 0; });
  } else if (!guide.steps[0].is_first_rep) {
    warnings.push('First rep was not step 1; reassigned to step 1.');
    guide.steps.forEach((s, i) => { s.is_first_rep = i === 0; });
  }

  const firstRep = guide.steps[0];
  if (firstRep.estimated_minutes > 15) {
    errors.push(`First rep is ${firstRep.estimated_minutes} minutes — it must be a ≤10 minute action a student can finish before closing the tab.`);
  }

  // Keep the entity's existing string field truthful rather than model-authored.
  const total = guide.steps.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0);
  const plural = (n, unit) => `${n} ${n === 1 ? unit : `${unit}s`}`;
  guide.estimated_time = total >= 60
    ? plural(Math.round((total / 60) * 10) / 10, 'hour')
    : plural(total, 'minute');

  if (/screenshot|upload/i.test(guide.proof_requirement || '')) {
    warnings.push('proof_requirement asks for retrospective upload/screenshot rather than byproduct capture.');
  }

  return { ok: errors.length === 0, guide, errors, warnings };
}
