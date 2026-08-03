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

import { PLAIN_PROSE_RULES } from '@/lib/llm';

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

/**
 * Proof is submitted by uploading a file on the Proof of Work page — that is the
 * only capture mechanism that exists today. Do not invent an inbox, address, or
 * forwarding flow here; a guide that names an address we don't run tells students
 * to send evidence into a black hole.
 */
const PROOF_DESTINATION = 'the Proof of Work page';

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * A real event off the student's own campus calendar, anchoring step 1.
 *
 * The model is told the event exists and what it is about, but never allowed to
 * restate its date, time, or room — those render from the calendar record via
 * step.campus_event, which attachCampusEvent() writes after validation. A model
 * that paraphrases "Thursday at 5 in Dolan 220" from memory is how a student
 * ends up outside a locked building.
 */
function campusEventSection(event) {
  if (!event) return '';

  const g = event.guidance || {};
  const facts = [
    event.title && `Event: "${event.title}"`,
    event.departments?.length && `Hosted by: ${event.departments.join(', ')}`,
    event.topics?.length && `Topics: ${event.topics.join(', ')}`,
    event.types?.length && `Format: ${event.types.join(', ')}`,
    event.has_register && 'Registration is required to attend.',
    event.description && `Description: ${event.description.slice(0, 500)}`,
    g.fit_reason && `Why it fits this student: ${g.fit_reason}`,
    g.what_to_do?.length && `Plan for the room:\n${g.what_to_do.map(a => `  - ${a}`).join('\n')}`,
    g.questions_to_ask?.length && `Questions already drafted (use verbatim or sharpen; do not replace with weaker ones):\n${g.questions_to_ask.map(q => `  - ${q}`).join('\n')}`,
    g.proof_to_capture && `Proof this produces: ${g.proof_to_capture}`,
  ].filter(Boolean).join('\n');

  return `

## This guide is anchored to a real campus event

${facts}

The student's first rep is LOCKING IN this event: registering or putting it on
their calendar. Not preparing for it, not researching it. Committing to it.

Rules 4 and 5 are replaced by these for step 1:

E1. Step 1 is is_first_rep: true and is ≤10 minutes: register or add the event
    to their calendar, plus the single smallest act of preparation that fits in
    the same sitting. done_when is "the event is on your calendar"${event.has_register ? ' and "you have a registration confirmation"' : ''}.

E2. NEVER write the event's date, time, day of week, room, or building into any
    step, artifact, or description. Not once, not as a reminder, not in an email
    signature. The app renders those from the calendar feed. If you need to
    refer to timing, write "the event" or "before you go".

E3. Step 2 is what they do IN THE ROOM. Its artifact is a question_list of
    questions written out verbatim, ready to say out loud to a stranger who does
    this work. Not "prepare thoughtful questions". Write the questions.

E4. At least one later step converts the event into a relationship: the
    follow-up message to someone they met, written in full, with a blank only
    for the person's name and the specific thing they discussed.

E5. Later steps still follow every rule below, including artifacts written out
    in full and objectively checkable done_when.`;
}

export function buildGuidePrompt(experiment, { variationInstruction = '', version = 1, campusEvent = null } = {}) {
  const base = `You are Unscripted, an AI career coach for college students.

Generate a PRE-FILLED Mission Guide for the experiment below.

Experiment title: "${experiment.title}"
Objective: "${experiment.objective}"
Path being tested: "${experiment.path_name || 'Not specified'}"
${experiment.deliverable ? `Deliverable: "${experiment.deliverable}"` : ''}

This is Version ${version}.${campusEventSection(campusEvent)}

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
   know: the person's name, their firm, a detail from their background. Mark
   each blank as [SQUARE_BRACKET_TOKEN] and list it in "blanks" with a short
   hint. Never leave a blank for something you could write yourself.
   "[WRITE A COMPELLING OPENING]" is a failure. Write the opening.

3. Use ONE token per distinct fact, spelled identically everywhere it appears.
   [UNIVERSITY_NAME] and [YOUR_UNIVERSITY_NAME] in the same guide is a bug.
   Every token you use must appear in that artifact's "blanks" array.

3a. For facts about the STUDENT, you must use exactly these tokens and no
    variants. They are auto-filled from the profile before the student ever
    sees the guide:
      [YOUR_NAME]        their full name
      [YOUR_UNIVERSITY]  their college
      [YOUR_MAJOR]       their major
      [YOUR_YEAR]        their school year (e.g. Senior)
      [YOUR_GRAD_YEAR]   their graduation year
    Everything else (the contact's name, their firm, a specific deal) stays a
    normal blank the student fills in.

3c. Only email and message artifacts have a "subject". Never set one on a
    question_list, outline, checklist, or search_query.

3d. The instruction line must not restate the step's "description". The student
    already read it one line above. Say only what they do with the payload, or
    leave it empty.

3b. A non-email artifact's "body" is a SHORT instruction line telling the
    student what to do with the payload, and the payload goes in "items". Do not
    put the payload in the body. For search_query, "items" holds only the literal
    strings to paste, with no numbering, quotes, or commentary of your own.

4. Exactly ONE step has is_first_rep: true, and it must be step_number 1. It is
   a ≤10 minute action producing something real in one sitting, before the
   student closes the tab. Highest-leverage first move, ending with an artifact
   in their hand.

5. Never assume the student already has a person, company, or target. If the
   experiment needs one, finding it is the first rep, and it carries an
   artifact too: literal copy-pasteable search strings (LinkedIn search syntax,
   alumni-directory filters), not "search for analysts".

6. Order steps so the student's own writing effort comes LAST, after momentum
   exists. Front-load steps where they only have to send, click, or ask.

7. "done_when" is an objectively checkable fact: "the email is in your sent
   folder", "a calendar invite exists". Never a feeling like "you understand X".

8. "proof_capture" names the specific file or screenshot that ALREADY EXISTS as
   a result of doing the step (the sent email, the calendar invite, the notes
   doc) and says to add it on ${PROOF_DESTINATION}. Name the actual artifact,
   not a chore: "a screenshot of the sent email" is good, "document your work"
   is a failure. The top-level "proof_requirement" follows the same rule.

   Never instruct the student to email, forward, BCC, or send anything to an
   Unscripted address. No such inbox exists. Uploading on ${PROOF_DESTINATION}
   is the only way proof is submitted.

9. estimated_minutes is a NUMBER of minutes. Not a string, not a range.

10. Format email and message bodies as a real email, using \\n\\n between the
    greeting, each paragraph, and the sign-off. One unbroken block of text is a
    failure. It has to be pasteable into Gmail as-is.

11. Voice: a competent 20-year-old writing to a stranger. Warm, direct, no
    filler, no "I hope this email finds you well", no corporate throat-clearing.
    Short sentences. Sendable as-is once blanks are filled.

Write it as if the student will send your words verbatim to a real professional
today, because they will.
${PLAIN_PROSE_RULES}`;

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

/**
 * A fill-in blank: a short bracketed label the student replaces before sending.
 *
 * Deliberately wider than the original [A-Z0-9_]. A model emitting
 * [Contact Name] or [CONTÁCT_NAME] was invisible here, so the blank it declared
 * was dropped as unused and the live placeholder shipped inside a cold email
 * with no field to fill it — the same harm as an untrimmed token, through a
 * different door.
 *
 * Still narrow enough to leave ordinary bracketed prose alone:
 *   - opens on a letter or digit, closes on a letter, digit or underscore, so
 *     "[See the note below.]" does not match
 *   - between them only word characters, spaces and - ' . / — no , ; : ! ?, so
 *     bracketed asides and sentences do not match
 *   - never immediately followed by "(", so markdown links stay links
 *   - 2–60 characters, and see isPlaceholder for the rest
 */
const newTokenRe = () => /\[[\p{L}\p{N}][\p{L}\p{N}_'’./ -]{0,58}[\p{L}\p{N}_]\](?!\()/gu;

/** Longest a real placeholder gets. Past this it is prose, not a label. */
const MAX_TOKEN_WORDS = 6;

/**
 * Second half of the placeholder test, kept out of the regex because it reads
 * better here. A blank is a short label — [Contact Name], [FIRM]. A bracketed
 * sentence in guide text is prose, and promoting one to a blank puts a dead
 * input field in front of the student.
 *
 * Requiring a letter also drops bare citation markers like [12].
 */
function isPlaceholder(token) {
  const inner = token.slice(1, -1).trim();
  if (!inner || !/\p{L}/u.test(inner)) return false;
  return inner.split(/\s+/).length <= MAX_TOKEN_WORDS;
}

/**
 * Every fill-in blank in a string. Single source of truth — collectTokens, the
 * profile substitution and the blank-survival check must all agree on what
 * counts as a token, or a blank gets declared in one place and dropped in
 * another.
 */
function findTokens(text) {
  if (typeof text !== 'string') return [];
  return (text.match(newTokenRe()) || []).filter(isPlaceholder);
}

/**
 * Facts onboarding already collected. The prompt tells the model to use exactly
 * these tokens; the aliases below catch the drift it produces anyway.
 */
export const PROFILE_TOKENS = {
  '[YOUR_NAME]': p => p.name,
  '[YOUR_UNIVERSITY]': p => p.college,
  '[YOUR_MAJOR]': p => p.major,
  '[YOUR_YEAR]': p => p.school_year,
  '[YOUR_GRAD_YEAR]': p => p.graduation_year,
};

const TOKEN_ALIASES = {
  '[NAME]': '[YOUR_NAME]',
  '[STUDENT_NAME]': '[YOUR_NAME]',
  '[YOUR_FULL_NAME]': '[YOUR_NAME]',
  '[FULL_NAME]': '[YOUR_NAME]',
  '[UNIVERSITY_NAME]': '[YOUR_UNIVERSITY]',
  '[YOUR_UNIVERSITY_NAME]': '[YOUR_UNIVERSITY]',
  '[COLLEGE_NAME]': '[YOUR_UNIVERSITY]',
  '[YOUR_COLLEGE]': '[YOUR_UNIVERSITY]',
  '[SCHOOL_NAME]': '[YOUR_UNIVERSITY]',
  '[YOUR_SCHOOL]': '[YOUR_UNIVERSITY]',
  '[MAJOR]': '[YOUR_MAJOR]',
  '[YOUR_MAJOR_NAME]': '[YOUR_MAJOR]',
  '[SCHOOL_YEAR]': '[YOUR_YEAR]',
  '[CLASS_YEAR]': '[YOUR_YEAR]',
  '[YOUR_CLASS_YEAR]': '[YOUR_YEAR]',
  '[GRADUATION_YEAR]': '[YOUR_GRAD_YEAR]',
  '[YOUR_GRADUATION_YEAR]': '[YOUR_GRAD_YEAR]',
};

export const canonicalToken = token => TOKEN_ALIASES[token] || token;

/**
 * Substitutes what the student already told us at onboarding, so they only fill
 * in what we genuinely cannot know.
 *
 * Runs at render time rather than generation time — a stored guide then reflects
 * the current profile instead of whatever it said the day it was generated.
 */
export function fillProfileTokens(artifact, profile) {
  if (!artifact) return artifact;

  const values = {};
  if (profile) {
    for (const [canonical, read] of Object.entries(PROFILE_TOKENS)) {
      const value = read(profile);
      if (typeof value === 'string' && value.trim()) values[canonical] = value.trim();
    }
  }

  const prefilled = new Set();
  const substitute = text =>
    typeof text === 'string'
      ? text.replace(newTokenRe(), token => {
          if (!isPlaceholder(token)) return token;
          const value = values[canonicalToken(token)];
          if (!value) return token;
          prefilled.add(token);
          return value;
        })
      : text;

  const next = {
    ...artifact,
    subject: substitute(artifact.subject),
    body: substitute(artifact.body),
    items: (artifact.items || []).map(substitute),
  };

  const stillPresent = new Set();
  for (const text of [next.subject, next.body, ...next.items]) {
    for (const token of findTokens(text)) stillPresent.add(token);
  }

  next.blanks = (artifact.blanks || []).filter(b => stillPresent.has(b.token));
  next.prefilled = [...prefilled];
  return next;
}

/** "[YOUR_UNIVERSITY_NAME]" -> "Your university name" */
function humanizeToken(token) {
  const words = token.replace(/^\[|\]$/g, '').split('_').filter(Boolean);
  if (!words.length) return 'Fill this in';
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a step actually came back as, for the rejection message. Calling a null
 * step "plain text" sends the model chasing a formatting problem it does not
 * have — a dropped step and a stringified one need different corrections.
 */
function describeStep(step) {
  if (step === null) return 'null';
  if (step === undefined) return 'missing entries';
  if (Array.isArray(step)) return 'a list';
  if (typeof step === 'string') return 'plain text';
  return `a ${typeof step}`;
}

/** Accepts 15, "15", "15 minutes", "about 20 min". Returns null if unparseable. */
/** A single step should fit in one sitting. Four hours is already generous. */
const MAX_STEP_MINUTES = 240;

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
    for (const token of findTokens(source)) found.add(token);
  }
  return found;
}

/**
 * Repairs what is safely repairable, and reports what is not.
 *
 * Returns { ok, guide, errors, warnings }. `errors` non-empty means the caller
 * should regenerate; `warnings` are silent fixes worth surfacing in dev.
 */
/**
 * A hard-coded date or time in the prose is the one campus-event failure that
 * actually hurts: the card next to it renders the real time off the calendar,
 * and the student has no way to know which one to trust.
 *
 * Deliberately narrow. Only clock times and month-day pairs — "within two days"
 * and "Monday morning energy" are legitimate and must not trip this.
 */
const CLOCK_RE = /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/i;

/**
 * Month names are spelled out rather than matched as a prefix plus any letters.
 * "Dec" followed by more letters is usually not a month: "Decide 3 people to
 * talk to" and "Separate 2 lists" are ordinary step prose, and flagging them
 * spends the one retry and hands the student no guide at all.
 */
const MONTH_DAY_RE = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?\s+\d{1,2}\b/i;

function findHardcodedTiming(guide) {
  const offenders = [];
  for (const [index, step] of (guide.steps || []).entries()) {
    const texts = [
      step.title,
      step.description,
      step.done_when,
      step.artifact?.subject,
      step.artifact?.body,
      ...(step.artifact?.items || []),
    ];
    for (const text of texts) {
      if (typeof text !== 'string') continue;
      const hit = text.match(CLOCK_RE) || text.match(MONTH_DAY_RE);
      if (hit) {
        offenders.push(`Step ${index + 1} writes the event timing ("${hit[0]}") into its text`);
        break;
      }
    }
  }
  return offenders;
}

export function validateGuide(raw, { campusEvent = null } = {}) {
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

  // The model's known drift is returning steps as bare prose instead of objects.
  // Spreading a string produces a character map that satisfies every check below
  // and ships a guide of empty steps, so reject it before the repair pass.
  const malformed = guide.steps.filter(s => !s || typeof s !== 'object' || Array.isArray(s));
  if (malformed.length) {
    const shapes = [...new Set(malformed.map(describeStep))];
    return {
      ok: false,
      guide: null,
      errors: [
        ...errors,
        `${malformed.length} of ${guide.steps.length} steps came back as ${shapes.join(' / ')} instead of structured step objects. Every step must be an object with a title, a description and an artifact.`,
      ],
      warnings,
    };
  }

  guide.steps = guide.steps.map((rawStep, index) => {
    const step = { ...rawStep };
    const label = `Step ${index + 1}`;

    step.step_number = index + 1;

    // Errors are worded to survive having their "Step N:" prefix stripped — the
    // model never sees its own previous output, so the index means nothing to it
    // and only the shape-level instruction is actionable. The index stays on for
    // the console, where it points at a step someone can actually go look at.
    if (typeof step.title !== 'string' || !step.title.trim()) {
      errors.push(`${label}: every step needs a title. An untitled step renders as an empty row the student cannot act on.`);
    }

    // Only the first rep was ever bounded, so a later step claiming 600 minutes
    // shipped and rolled straight into the guide's total time. A step longer
    // than a long afternoon is the model ignoring the brief, not an estimate.
    const minutes = coerceMinutes(step.estimated_minutes ?? step.estimated_time);
    if (minutes === null) {
      warnings.push(`${label}: no usable time estimate; defaulted to 15 minutes.`);
      step.estimated_minutes = 15;
    } else if (minutes <= 0 || minutes > MAX_STEP_MINUTES) {
      warnings.push(`${label}: time estimate of ${minutes} minutes is outside 1 to ${MAX_STEP_MINUTES}; defaulted to 15 minutes.`);
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
    // Normalise tokens once. A blank declared as " [NAME] " used to be counted as
    // declared but then dropped as unused, leaving a live token in the email with
    // no field to fill it in.
    artifact.blanks = (Array.isArray(artifact.blanks) ? artifact.blanks : [])
      .filter(b => b && typeof b.token === 'string' && b.token.trim())
      .map(b => ({ ...b, token: b.token.trim() }));

    // Only emails have a subject. Left on a list, it renders nowhere but its
    // tokens still count as blanks — the student is told to fill in something
    // they cannot see.
    if (!KINDS_NEEDING_BODY.includes(artifact.kind) && artifact.subject) {
      delete artifact.subject;
    }

    if (artifact.kind !== 'none') {
      const hasBody = typeof artifact.body === 'string' && artifact.body.trim().length > 0;
      const hasItems = artifact.items.length > 0;

      if (KINDS_NEEDING_BODY.includes(artifact.kind) && !hasBody) {
        errors.push(`${label}: every "${artifact.kind}" artifact needs a full body. Write the message itself, not a description of it.`);
      }
      if (KINDS_NEEDING_ITEMS.includes(artifact.kind) && !hasItems) {
        errors.push(`${label}: every "${artifact.kind}" artifact needs its items written out. The payload was missing.`);
      }

      // Every token used must be declared. This is the defect that ships an
      // unfilled [TOKEN] inside a real outbound email.
      const used = collectTokens(artifact);
      const declared = new Set(artifact.blanks.map(b => b.token));

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

  // Two tiers on purpose: the prompt asks for ≤10, and rejecting every 11–15
  // minute first rep would burn a retry on output that is still usable.
  const firstRep = guide.steps[0];
  if (firstRep.estimated_minutes > 15) {
    errors.push(`First rep is ${firstRep.estimated_minutes} minutes. It must be a ≤10 minute action a student can finish before closing the tab.`);
  } else if (firstRep.estimated_minutes > 10) {
    warnings.push(`First rep is ${firstRep.estimated_minutes} minutes, over the 10-minute target.`);
  }

  // Keep the entity's existing string field truthful rather than model-authored.
  const total = guide.steps.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0);
  const plural = (n, unit) => `${n} ${n === 1 ? unit : `${unit}s`}`;
  guide.estimated_time = total >= 60
    ? plural(Math.round((total / 60) * 10) / 10, 'hour')
    : plural(total, 'minute');

  // Guard against the failure this file previously caused: telling students to
  // send evidence to an Unscripted address that does not exist.
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
  for (const text of [guide.proof_requirement, ...guide.steps.map(s => s.proof_capture)]) {
    const hit = typeof text === 'string' ? text.match(EMAIL_RE) : null;
    if (hit) {
      errors.push(`Proof instructions name the address ${hit[0]}. Proof is uploaded on ${PROOF_DESTINATION}; there is no Unscripted inbox to send to.`);
      break;
    }
  }

  // Guard the campus-event contract: the calendar record is the only source of
  // when and where, so the prose must not compete with it.
  if (campusEvent) {
    for (const offender of findHardcodedTiming(guide)) {
      errors.push(`${offender}. Never write the date, time, or room. The app renders those from the campus calendar. Say "the event" or "before you go".`);
    }
  }

  return { ok: errors.length === 0, guide, errors, warnings };
}

/**
 * The subset of validator errors worth sending back to the model on a retry.
 *
 * The model is not shown its own previous output, so a "Step 2:" prefix points
 * at something it cannot find — those indexes are noise that dilutes the
 * instruction next to them. Strip them and dedupe, leaving only the shape-level
 * corrections. The full indexed errors still go to the console, where the index
 * points at a step a person can go and look at.
 */
export function toModelCorrections(errors) {
  return [...new Set(
    (errors || [])
      .map(e => (typeof e === 'string' ? e.replace(/^Step\s+\d+:\s*/, '').trim() : ''))
      .filter(Boolean)
  )];
}

/**
 * Pins the authoritative calendar record onto the first rep.
 *
 * Stored on the step rather than the guide because `MissionGuides.steps` is
 * typed as untyped objects — this persists with no entity schema change, and it
 * keeps when/where next to the action it belongs to.
 */
export function attachCampusEvent(guide, event) {
  if (!guide || !event || !Array.isArray(guide.steps) || !guide.steps.length) return guide;

  const steps = [...guide.steps];
  steps[0] = {
    ...steps[0],
    campus_event: {
      id: String(event.id),
      title: event.title || '',
      start: event.start || '',
      end: event.end || '',
      all_day: Boolean(event.all_day),
      location: event.location || '',
      room: event.room || '',
      address: event.address || '',
      url: event.url || '',
      ics_url: event.ics_url || '',
      ticket_url: event.ticket_url || '',
      has_register: Boolean(event.has_register),
      // Carried through as-is, including null for "the calendar didn't say".
      is_free: typeof event.is_free === 'boolean' ? event.is_free : null,
      departments: event.departments || [],
      source: 'campus_calendar',
    },
  };

  return { ...guide, steps };
}
