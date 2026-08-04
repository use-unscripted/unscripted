import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  chooseAsk, expireStale, isRetired, rungFor, shouldSkipPass,
  ACCEPTANCE_WINDOW_DAYS, PENDING_EXPIRY_DAYS, RETIRE_AFTER_ASKS, SILENCE_LIMIT_ASKS,
} from './nudge.js';
import { LADDERS, MAX_TITLE_CHARS, RUNG_SIZES, fillRung, ladderFor } from './nudge-ladder.js';
import { readPulse } from './student-pulse.js';

const DAY = 86400000;
const BASE = Date.parse('2026-06-01T12:00:00.000Z');
const NOW = new Date(BASE).toISOString();
/** An instant `d` days after the anchor. Negative goes backwards. */
const at = (d) => new Date(BASE + d * DAY).toISOString();

// The ten kinds student-pulse can emit. If stage 1 grows an eleventh, the
// ladder integrity test below is what will catch the missing copy.
const STALL_KINDS = [
  'no_path_selected',
  'path_without_experiment',
  'experiment_without_guide',
  'guide_never_acted_on',
  'mission_planned_stale',
  'outreach_never_sent',
  'outreach_no_followup',
  'experiment_no_proof',
  'reflection_overdue',
  'dormant_account',
];

// Every stall these tests run on comes out of student-pulse itself, on three
// fixture accounts between them stuck in all ten ways. Hand copying stage 1's
// labels here is what let an earlier version of this suite stay green while the
// labels drifted underneath it and every email fell back to a generic noun.
const pulseUser = { id: 'u1', email: 'sam@fairfield.edu', created_date: at(-40) };

// Paths generated, none of them picked.
const noPickInput = {
  now: NOW,
  user: pulseUser,
  paths: [
    { id: 'p1', path_name: 'Product analyst', status: 'exploring', created_date: at(-40), generated_at: at(-40) },
    { id: 'p2', path_name: 'Ops analyst', status: 'exploring', created_date: at(-40), generated_at: at(-40) },
  ],
};

// A path picked and nothing set up underneath it.
const emptyPathInput = {
  now: NOW,
  user: pulseUser,
  paths: [{
    id: 'p1', path_name: 'Product analyst', is_primary_focus: true, status: 'active',
    created_date: at(-40), started_at: at(-20),
  }],
};

// Everything set up and nothing done: one experiment with no steps, one with
// steps nobody ran, one running with nothing logged, a mission on the list, a
// contact never written to and a contact who never wrote back.
const stuckInput = {
  now: NOW,
  user: pulseUser,
  paths: [{
    id: 'p1', path_name: 'Product analyst', is_primary_focus: true, status: 'active',
    created_date: at(-40), started_at: at(-39),
  }],
  experiments: [
    { id: 'e1', title: 'Shadow a product analyst', path_id: 'p1', status: 'planned', created_date: at(-30) },
    { id: 'e2', title: 'Sit in on a sprint review', path_id: 'p1', status: 'planned', created_date: at(-30) },
    {
      id: 'e3', title: 'Write up a pricing teardown', path_id: 'p1', status: 'in_progress',
      created_date: at(-28), status_history: [{ to_status: 'in_progress', changed_at: at(-20) }],
    },
  ],
  guides: [{
    id: 'g1', experiment_id: 'e2', guide_title: 'How to shadow an analyst',
    status: 'active', created_date: at(-25),
  }],
  missions: [{ id: 'm1', experiment_id: 'e2', title: 'Email two analysts', status: 'planned', created_date: at(-20) }],
  outreach: [
    { id: 'c1', name: 'Ada Reyes', response_status: 'not_sent', created_date: at(-20) },
    { id: 'c2', name: 'Ada Reyes', response_status: 'no_response', date_contacted: at(-20), created_date: at(-25) },
  ],
};

const REAL_STALLS = {};
for (const stall of [
  ...readPulse(noPickInput).stalls,
  ...readPulse(emptyPathInput).stalls,
  ...readPulse(stuckInput).stalls,
]) {
  if (!REAL_STALLS[stall.kind]) REAL_STALLS[stall.kind] = stall;
}

const stallFor = (kind, over = {}) => ({ ...REAL_STALLS[kind], ...over });

const pulseWith = (stalls, over = {}) => ({
  state: 'stalled',
  daysSinceSignup: 40,
  lastEvidenceAt: null,
  daysSinceEvidence: null,
  lastEvidenceKind: null,
  neverReturned: true,
  evidence: {
    proof: 0, missionsCompleted: 0, outreachSent: 0, outreachResponded: 0, reflections: 0, guides: 0,
  },
  claimed: {
    paths: 3, experiments: 1, experimentsInProgress: 0, experimentsCompleted: 0, missionsPlanned: 0,
  },
  gap: { experimentsWithoutGuide: 1, experimentsWithoutProof: 1, missionsNeverCompleted: 0 },
  stalls,
  topStall: stalls[0] || null,
  ...over,
});

const row = (over = {}) => ({
  id: 'n1',
  user_id: 'u1',
  stall_kind: 'experiment_without_guide',
  subject_id: 'e1',
  pass_number: 1,
  generated_at: at(-10),
  delivered_at: at(-10),
  delivered_channel: 'email',
  rung: 0,
  rung_key: 'experiment_without_guide.r0',
  size: 'large',
  action_kind: 'generate_guide',
  status: 'pending',
  deletion_status: 'active',
  ...over,
});

/** One weekly pass: expire what went unanswered, then ask one thing. */
function runPass({ history, now, passNumber, pulse }) {
  const stale = expireStale(history, now);
  const marked = history.map((r) => (stale.includes(r.id) ? { ...r, status: 'expired' } : r));
  const ask = chooseAsk({ pulse, history: marked, now, passNumber, userId: 'u1' });
  const next = ask
    ? [...marked, { ...ask, id: `n${marked.length + 1}`, delivered_at: now, delivered_channel: 'email' }]
    : marked;
  return { history: next, ask };
}

/** `count` passes eight days apart, with the student answering none of them. */
function ignoreFor(count, pulse) {
  let history = [];
  const asks = [];
  for (let pass = 1; pass <= count; pass += 1) {
    const result = runPass({ history, now: at((pass - 1) * 8), passNumber: pass, pulse });
    history = result.history;
    asks.push(result.ask);
  }
  return { history, asks };
}

/** Every rung of every ladder, flat. */
const allRungs = Object.entries(LADDERS).flatMap(([kind, ladder]) => ladder.map((r) => ({ kind, r })));

describe('the ask gets smaller every time it is ignored', () => {
  it('gives three different, strictly smaller asks over three ignored passes', () => {
    const pulse = pulseWith([stallFor('experiment_without_guide')]);
    const { asks } = ignoreFor(3, pulse);

    expect(asks.map((a) => a.rung)).toEqual([0, 1, 2]);
    expect(asks.map((a) => a.size)).toEqual(['large', 'medium', 'one_line']);

    const keys = asks.map((a) => a.rung_key);
    expect(new Set(keys).size).toBe(3);

    // The third ask has to be answerable in one sentence. That is the point of
    // the ladder: by the third refusal we are asking for a reply, not for work.
    expect(asks[2].action_kind).toBe('answer_question');
    expect(asks[2].question.length).toBeGreaterThan(0);
  });

  it('lands on a one sentence question by the third pass for every ladder that is long enough', () => {
    for (const kind of STALL_KINDS) {
      const ladder = ladderFor(kind);
      if (ladder.length < 4) continue;
      const { asks } = ignoreFor(3, pulseWith([stallFor(kind)]));
      expect(asks.map((a) => a.rung), kind).toEqual([0, 1, 2]);
      expect(asks[2].size, kind).toBe('one_line');
      expect(asks[2].question.length, kind).toBeGreaterThan(0);
    }
  });

  it('offers to rule the thing out once one sentence has been refused', () => {
    const { asks } = ignoreFor(4, pulseWith([stallFor('experiment_without_guide')]));
    expect(asks[3].action_kind).toBe('rule_out');
    expect(asks[3].rung).toBe(3);
  });
});

describe('accepted is not the same as done', () => {
  const pulse = pulseWith([stallFor('experiment_without_guide')]);

  it('drops a rung when an accepted ask produced no evidence inside the window', () => {
    const history = [row({
      status: 'accepted',
      responded_at: at(-(ACCEPTANCE_WINDOW_DAYS + 2)),
      delivered_at: at(-(ACCEPTANCE_WINDOW_DAYS + 3)),
    })];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(1);

    const ask = chooseAsk({ pulse, history, now: NOW, passNumber: 2, userId: 'u1' });
    expect(ask.rung).toBe(1);
    expect(ask.size).toBe('medium');
  });

  it('holds the rung while an accepted ask is still inside the window', () => {
    const history = [row({ status: 'accepted', responded_at: at(-1), delivered_at: at(-2) })];
    expect(chooseAsk({ pulse, history, now: NOW, passNumber: 2, userId: 'u1' })).toBeNull();
  });

  it('treats evidence on an accepted ask as success and stays off the ladder', () => {
    const history = [row({
      status: 'accepted',
      responded_at: at(-(ACCEPTANCE_WINDOW_DAYS + 2)),
      evidence_seen_at: at(-1),
    })];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(0);
  });
});

describe('a kind that worked starts over next time it comes back', () => {
  it('resets to rung 0 after a completed ask', () => {
    const history = [
      row({ id: 'n1', rung: 0, rung_key: 'experiment_without_guide.r0', status: 'expired', delivered_at: at(-40) }),
      row({ id: 'n2', rung: 1, rung_key: 'experiment_without_guide.r1', status: 'expired', delivered_at: at(-30) }),
      row({ id: 'n3', rung: 2, rung_key: 'experiment_without_guide.r2', status: 'completed', delivered_at: at(-20) }),
    ];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(0);

    const ask = chooseAsk({
      pulse: pulseWith([stallFor('experiment_without_guide')]), history, now: NOW, passNumber: 9, userId: 'u1',
    });
    expect(ask.rung).toBe(0);
    expect(ask.rung_key).toBe('experiment_without_guide.r0');
  });

  it('counts a refusal after the reset, not the refusals before it', () => {
    const history = [
      row({ id: 'n1', rung: 0, rung_key: 'experiment_without_guide.r0', status: 'expired', delivered_at: at(-40) }),
      row({ id: 'n2', rung: 2, rung_key: 'experiment_without_guide.r2', status: 'completed', delivered_at: at(-30) }),
      row({ id: 'n3', rung: 0, rung_key: 'experiment_without_guide.r0', status: 'declined', delivered_at: at(-20) }),
    ];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(1);
  });
});

describe('retiring a kind', () => {
  /** A ladder walked all the way to the bottom and refused at every rung. */
  const exhausted = (kind, idPrefix) => ladderFor(kind).map((r, i) => row({
    id: `${idPrefix}${i}`,
    stall_kind: kind,
    subject_id: REAL_STALLS[kind].subjectId || '',
    rung: i,
    rung_key: r.key,
    size: r.size,
    action_kind: r.action_kind,
    status: 'expired',
    delivered_at: at(-(40 - i * 5)),
  }));

  it('skips a retired kind and asks about the next stall instead', () => {
    const history = exhausted('experiment_without_guide', 'a');
    expect(isRetired('experiment_without_guide', history, NOW)).toBe(true);

    const pulse = pulseWith([stallFor('experiment_without_guide'), stallFor('reflection_overdue')]);
    const ask = chooseAsk({ pulse, history, now: NOW, passNumber: 6, userId: 'u1' });
    expect(ask.stall_kind).toBe('reflection_overdue');
    expect(ask.rung).toBe(0);
  });

  it('says nothing at all once every raised kind is retired', () => {
    const history = [
      ...exhausted('experiment_without_guide', 'a'),
      ...exhausted('reflection_overdue', 'b'),
    ];
    const pulse = pulseWith([stallFor('experiment_without_guide'), stallFor('reflection_overdue')]);
    expect(chooseAsk({ pulse, history, now: NOW, passNumber: 9, userId: 'u1' })).toBeNull();
  });

  it('says nothing when there is nothing stalled', () => {
    expect(chooseAsk({
      pulse: pulseWith([], { state: 'working' }), history: [], now: NOW, passNumber: 1, userId: 'u1',
    })).toBeNull();
  });

  it('retires a kind that outlived its ladder, so a longer ladder cannot drip forever', () => {
    const history = Array.from({ length: RETIRE_AFTER_ASKS }, (unused, i) => row({
      id: `x${i}`, rung: 0, rung_key: 'experiment_without_guide.r0', status: 'declined', delivered_at: at(-(60 - i)),
    }));
    expect(rungFor('experiment_without_guide', history, NOW)).toBeNull();
  });
});

describe('one proposal at a time', () => {
  it('skips the pass while an unanswered ask is still inside its window', () => {
    const history = [row({ status: 'pending', delivered_at: at(-(PENDING_EXPIRY_DAYS - 1)) })];
    const reason = shouldSkipPass({
      pulse: pulseWith([stallFor('experiment_without_guide')]), history, now: NOW, userId: 'u1',
    });
    expect(typeof reason).toBe('string');
    expect(reason.length).toBeGreaterThan(0);
  });

  it('proceeds once that ask has gone past its window', () => {
    const history = [row({ status: 'pending', delivered_at: at(-(PENDING_EXPIRY_DAYS + 2)) })];
    expect(shouldSkipPass({
      pulse: pulseWith([stallFor('experiment_without_guide')]), history, now: NOW, userId: 'u1',
    })).toBeNull();
  });

  it('skips a student who has refused one sentence on every kind we raised', () => {
    const history = [
      row({ id: 'n1', rung: 2, rung_key: 'experiment_without_guide.r2', size: 'one_line', status: 'declined', delivered_at: at(-20) }),
      row({ id: 'n2', stall_kind: 'reflection_overdue', rung: 3, rung_key: 'reflection_overdue.r3', size: 'one_line', action_kind: 'rule_out', status: 'declined', delivered_at: at(-15) }),
    ];
    expect(shouldSkipPass({
      pulse: pulseWith([stallFor('experiment_without_guide')]), history, now: NOW, userId: 'u1',
    })).toBe('the student has asked us to stop');
  });

  it('does not skip when only one of two raised kinds was refused at the bottom', () => {
    const history = [
      row({ id: 'n1', rung: 2, rung_key: 'experiment_without_guide.r2', size: 'one_line', status: 'declined', delivered_at: at(-20) }),
      row({ id: 'n2', stall_kind: 'reflection_overdue', rung: 0, rung_key: 'reflection_overdue.r0', size: 'large', status: 'expired', delivered_at: at(-15) }),
    ];
    expect(shouldSkipPass({
      pulse: pulseWith([stallFor('reflection_overdue')]), history, now: NOW, userId: 'u1',
    })).toBeNull();
  });

  it('skips the pass while an accepted ask is still outstanding, whatever else is stalled', () => {
    const history = [row({
      status: 'accepted',
      delivered_at: at(-3),
      responded_at: at(-1),
    })];
    const pulse = pulseWith([stallFor('experiment_without_guide'), stallFor('reflection_overdue')]);
    const reason = shouldSkipPass({ pulse, history, now: NOW, userId: 'u1' });
    expect(typeof reason).toBe('string');
    expect(reason.length).toBeGreaterThan(0);
  });

  it('proceeds once an accepted ask has gone past its window with nothing to show', () => {
    const history = [row({
      status: 'accepted',
      delivered_at: at(-(ACCEPTANCE_WINDOW_DAYS + 3)),
      responded_at: at(-(ACCEPTANCE_WINDOW_DAYS + 2)),
    })];
    expect(shouldSkipPass({
      pulse: pulseWith([stallFor('experiment_without_guide')]), history, now: NOW, userId: 'u1',
    })).toBeNull();
  });

  it('goes quiet for good once a student has ignored every ask we ever sent', () => {
    const silent = (n) => Array.from({ length: n }, (unused, i) => row({
      id: `s${i}`, status: 'expired', rung: i % 4, rung_key: `experiment_without_guide.r${i % 4}`,
      delivered_at: at(-(90 - i * 8)),
    }));
    const pulse = pulseWith([stallFor('experiment_without_guide')]);

    expect(shouldSkipPass({ pulse, history: silent(SILENCE_LIMIT_ASKS - 1), now: NOW, userId: 'u1' })).toBeNull();
    expect(shouldSkipPass({ pulse, history: silent(SILENCE_LIMIT_ASKS), now: NOW, userId: 'u1' }))
      .toBe('this student has never answered anything we sent');
    expect(shouldSkipPass({ pulse, history: silent(SILENCE_LIMIT_ASKS + 9), now: NOW, userId: 'u1' }))
      .toBe('this student has never answered anything we sent');
  });

  it('keeps going for a student who answered once, however long ago', () => {
    const pulse = pulseWith([stallFor('experiment_without_guide')]);
    const base = Array.from({ length: SILENCE_LIMIT_ASKS + 2 }, (unused, i) => row({
      id: `s${i}`, status: 'expired', rung: 0, rung_key: 'experiment_without_guide.r0',
      delivered_at: at(-(90 - i * 8)),
    }));

    const replied = base.map((r, i) => (i === 0 ? { ...r, reply_text: 'no time this semester' } : r));
    expect(shouldSkipPass({ pulse, history: replied, now: NOW, userId: 'u1' })).toBeNull();

    const acted = base.map((r, i) => (i === 0 ? { ...r, evidence_seen_at: at(-60) } : r));
    expect(shouldSkipPass({ pulse, history: acted, now: NOW, userId: 'u1' })).toBeNull();

    const said = base.map((r, i) => (i === 0 ? { ...r, status: 'declined' } : r));
    expect(shouldSkipPass({ pulse, history: said, now: NOW, userId: 'u1' })).toBeNull();
  });

  it('skips a working student with nothing stalled, and a deleted account', () => {
    expect(shouldSkipPass({
      pulse: pulseWith([], { state: 'working' }), history: [], now: NOW, userId: 'u1',
    })).toBe('the student is working and nothing is stalled');
    expect(shouldSkipPass({
      pulse: pulseWith([]), history: [], now: NOW, user: { id: 'u1', deletion_status: 'deleted' },
    })).toBe('the account is deleted');
    expect(shouldSkipPass({ pulse: pulseWith([]), history: [], now: NOW })).toBeTruthy();
  });
});

describe('expireStale', () => {
  it('takes the pending rows past the window and nothing else', () => {
    const history = [
      row({ id: 'past', status: 'pending', delivered_at: at(-(PENDING_EXPIRY_DAYS + 1)) }),
      // Exactly on the window. Not expired yet: the pass does not run at the
      // same minute every week and a rung is too expensive to lose to rounding.
      row({ id: 'boundary', status: 'pending', delivered_at: at(-PENDING_EXPIRY_DAYS) }),
      row({ id: 'fresh', status: 'pending', delivered_at: at(-2) }),
      row({ id: 'answered', status: 'declined', delivered_at: at(-40) }),
      row({ id: 'deleted', status: 'pending', delivered_at: at(-40), deletion_status: 'deleted' }),
      row({ id: 'undateable', status: 'pending', delivered_at: null, generated_at: null, created_date: null }),
    ];
    expect(expireStale(history, NOW)).toEqual(['past']);
  });

  it('returns nothing without a usable clock, and survives junk', () => {
    expect(expireStale([row({ status: 'pending', delivered_at: at(-40) })], 'not a date')).toEqual([]);
    expect(expireStale(null, NOW)).toEqual([]);
    expect(expireStale([null, 'x', 7], NOW)).toEqual([]);
  });
});

describe('ladder integrity', () => {
  it('has a ladder for every kind student-pulse can emit', () => {
    for (const kind of STALL_KINDS) {
      expect(ladderFor(kind).length, kind).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(LADDERS).sort()).toEqual([...STALL_KINDS].sort());
  });

  it('gives every rung a key that is unique across the whole file', () => {
    const keys = allRungs.map(({ r }) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const { kind, r } of allRungs) expect(r.key.startsWith(`${kind}.`), r.key).toBe(true);
  });

  it('gets strictly smaller every rung, with only the way out allowed to hold', () => {
    for (const [kind, ladder] of Object.entries(LADDERS)) {
      const sizes = ladder.map((r) => RUNG_SIZES.indexOf(r.size));
      expect(sizes.includes(-1), kind).toBe(false);
      expect(ladder[0].size, kind).toBe('large');
      // Every step down the ladder has to cost less than the one above it. The
      // last rung is the exception and the only one: it offers to rule the
      // thing out, which is one sentence, same as the question above it.
      for (let i = 1; i < sizes.length - 1; i += 1) {
        expect(sizes[i], `${kind} rung ${i} is no smaller than rung ${i - 1}`).toBeGreaterThan(sizes[i - 1]);
      }
      const last = sizes[sizes.length - 1];
      expect(last, `${kind} last rung`).toBeGreaterThanOrEqual(sizes[sizes.length - 2]);
    }
  });

  // The size field is a claim about commitment, and a rung can lie about it:
  // outreach_no_followup shipped a "small" middle rung that still ended with a
  // message going to a person, which is the entire cost of the rung above it.
  // The size test cannot see that, so the two ladders whose top rung asks a
  // student to write to a human are pinned here: their middle rung has to say
  // out loud that nothing needs to be sent.
  it('lets the middle rung of an outreach ladder stop short of sending', () => {
    for (const kind of ['outreach_never_sent', 'outreach_no_followup']) {
      const middle = ladderFor(kind).filter((r, i) => i > 0 && r.size !== 'one_line');
      expect(middle.length, kind).toBeGreaterThan(0);
      for (const r of middle) {
        const body = r.body.toLowerCase();
        expect(/do not have to send it|do not send it/.test(body), `${kind} ${r.key}`).toBe(true);
      }
    }
  });

  it('ends every ladder with one sentence and then a way out', () => {
    for (const [kind, ladder] of Object.entries(LADDERS)) {
      const last = ladder[ladder.length - 1];
      const secondLast = ladder[ladder.length - 2];
      expect(secondLast.size, kind).toBe('one_line');
      expect(secondLast.action_kind, kind).toBe('answer_question');
      expect(typeof secondLast.question, kind).toBe('string');
      expect(secondLast.question.trim().length, kind).toBeGreaterThan(0);
      expect(last.action_kind, kind).toBe('rule_out');
    }
  });
});

describe('copy integrity', () => {
  // Words and shapes that make a machine obvious. The register a student reads
  // is the register a career services buyer reads, so this is not a style nit.
  const BANNED = [
    'journey', 'unlock', 'leverage', 'empower', 'dive in', 'delve', 'robust', 'vibrant',
    'crucial', 'pivotal', 'seamless', 'testament', 'tapestry', 'landscape', 'underscore',
    'showcase', 'foster', 'elevate', 'navigate', 'not just', 'not only', 'let us', 'utilize',
    'exciting', 'excited', 'realm', 'myriad', 'game changer', 'no worries', 'sorry to bother',
  ];

  const everyString = allRungs.flatMap(({ kind, r }) => [
    { kind, field: 'title', value: r.title },
    { kind, field: 'body', value: r.body },
    { kind, field: 'question', value: r.question || '' },
  ]);

  it('has no em dash and no en dash anywhere', () => {
    for (const { kind, field, value } of everyString) {
      // The two characters on this line are the only ones in the file, and they
      // are inside the rule that bans them. Same exception as PLAIN_PROSE_RULES.
      expect(/[—–]/.test(value), `${kind}.${field}`).toBe(false);
    }
  });

  it('uses none of the banned words and no exclamation marks', () => {
    for (const { kind, field, value } of everyString) {
      const lower = value.toLowerCase();
      for (const word of BANNED) {
        expect(lower.includes(word), `${kind}.${field} contains "${word}"`).toBe(false);
      }
      expect(value.includes('!'), `${kind}.${field}`).toBe(false);
    }
  });

  it('keeps questions in the question field, not in the body', () => {
    for (const { kind, field, value } of everyString) {
      if (field === 'question') {
        expect(value === '' || value.endsWith('?'), kind).toBe(true);
        continue;
      }
      expect(value.includes('?'), `${kind}.${field}`).toBe(false);
    }
  });

  it('keeps every title short, before and after the subject is filled in', () => {
    for (const { kind, r } of allRungs) {
      expect(r.title.length, `${kind} raw title`).toBeLessThan(60);
      const filled = fillRung(r, stallFor(kind));
      expect(filled.title.length, `${kind} filled title: ${filled.title}`).toBeLessThanOrEqual(MAX_TITLE_CHARS);
    }
  });

  it('leaves no placeholder unfilled on a realistic stall', () => {
    for (const { kind, r } of allRungs) {
      const filled = fillRung(r, stallFor(kind));
      for (const field of ['title', 'body', 'question']) {
        expect(/\{[A-Za-z]+\}/.test(filled[field]), `${kind}.${field}: ${filled[field]}`).toBe(false);
      }
    }
  });

  it('names the actual subject rather than a generic noun', () => {
    const guide = fillRung(LADDERS.experiment_without_guide[0], stallFor('experiment_without_guide'));
    expect(guide.title).toContain('Shadow a product analyst');
    expect(guide.body).toContain('Shadow a product analyst');

    const contact = fillRung(LADDERS.outreach_never_sent[0], stallFor('outreach_never_sent'));
    expect(contact.title).toContain('Ada Reyes');

    const path = fillRung(LADDERS.path_without_experiment[0], stallFor('path_without_experiment'));
    expect(path.body).toContain('Product analyst');
  });

  it('falls back to a readable noun when the stall has no name at all', () => {
    const filled = fillRung(
      LADDERS.experiment_without_guide[0],
      stallFor('experiment_without_guide', {
        subjectName: '',
        label: 'One of your experiments has no steps yet.',
      }),
    );
    expect(filled.title).toBe('Get the steps for your experiment');
    expect(filled.body.startsWith('Your experiment has no steps')).toBe(true);
  });

  it('shortens a very long subject instead of overrunning the title', () => {
    const filled = fillRung(
      LADDERS.reflection_overdue[0],
      stallFor('reflection_overdue', {
        subjectName: 'Write a full market map of every mid market vendor in the northeast',
      }),
    );
    expect(filled.title.length).toBeLessThanOrEqual(MAX_TITLE_CHARS);
    expect(filled.title.startsWith('Write down what')).toBe(true);
  });

  it('sends every action somewhere the app actually has', () => {
    const KNOWN = ['', '/paths', '/experiments', '/experiments/new', '/journey', '/evidence', '/experiment'];
    for (const { kind, r } of allRungs) {
      const { target } = fillRung(r, stallFor(kind));
      const base = target.split('?')[0];
      expect(KNOWN.includes(base), `${kind} -> ${target}`).toBe(true);
    }
    const withId = fillRung(LADDERS.experiment_without_guide[0], stallFor('experiment_without_guide'));
    expect(withId.target).toBe('/experiment?experimentId=e1');
    const noId = fillRung(LADDERS.experiment_without_guide[0], stallFor('experiment_without_guide', { subjectId: null }));
    expect(noId.target).toBe('/experiments');
  });
});

describe('the entity a student has to be able to read their own row of', () => {
  // Read from disk rather than restated here, because the whole failure this
  // guards is a rule that looks right in review and matches nothing at run
  // time: a student reads none of their own nudges and can neither accept nor
  // decline, and it looks exactly like apathy. A property is `data.<field>`.
  // `created_by_id` is a system field and is the one key that stays bare.
  const source = readFileSync(new URL('../../base44/entities/StudentNudge.jsonc', import.meta.url), 'utf8');
  const entity = JSON.parse(source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n'));

  it('scopes read and update on the row owner, with the data prefix', () => {
    expect(entity.rls.read.$or).toContainEqual({ 'data.user_id': '{{user.id}}' });
    expect(entity.rls.update.$or).toContainEqual({ 'data.user_id': '{{user.id}}' });
    expect(JSON.stringify(entity.rls)).not.toContain('"user_id"');
  });

  it('leaves writing a nudge to an admin, so nobody can forge one', () => {
    expect(entity.rls.create).toEqual({ user_condition: { role: 'admin' } });
    expect(entity.rls.delete).toEqual({ user_condition: { role: 'admin' } });
  });
});

describe('the subject name comes from the stall, not from its label', () => {
  it('reads every kind of stall student-pulse emits, with a name on the ones that have one', () => {
    for (const kind of STALL_KINDS) {
      expect(REAL_STALLS[kind], `no ${kind} stall came out of the fixtures`).toBeTruthy();
      expect(typeof REAL_STALLS[kind].subjectName, kind).toBe('string');
    }
    expect(REAL_STALLS.experiment_without_guide.subjectName).toBe('Shadow a product analyst');
    expect(REAL_STALLS.guide_never_acted_on.subjectName).toBe('How to shadow an analyst');
    expect(REAL_STALLS.mission_planned_stale.subjectName).toBe('Email two analysts');
    expect(REAL_STALLS.outreach_never_sent.subjectName).toBe('Ada Reyes');
    expect(REAL_STALLS.path_without_experiment.subjectName).toBe('Product analyst');
    // Nothing to name: the subject is the account, or the set of paths.
    expect(REAL_STALLS.dormant_account.subjectName).toBe('');
    expect(REAL_STALLS.no_path_selected.subjectName).toBe('');
  });

  it('keeps a title that has quotes in it whole', () => {
    const stall = stallFor('experiment_without_guide', {
      subjectName: 'Ask “why” five times',
      label: '“Ask “why” five times” has no steps yet, so there is nothing to start on.',
    });
    const filled = fillRung(LADDERS.experiment_without_guide[0], stall);
    expect(filled.title).toContain('Ask “why” five times');
    expect(filled.body).toContain('Ask “why” five times');
  });

  it('keeps a contact whose name has a nickname in it whole', () => {
    const stall = stallFor('outreach_never_sent', {
      subjectName: 'Robert “Bob” Chen',
      label: 'You saved Robert “Bob” Chen 9 days ago and never sent anything.',
    });
    expect(fillRung(LADDERS.outreach_never_sent[0], stall).title).toBe('Send the note to Robert “Bob” Chen');
  });

  it('writes a sentence that still reads when the contact has no name', () => {
    const stall = stallFor('outreach_never_sent', {
      subjectName: '',
      label: 'You saved someone 9 days ago and never sent anything.',
    });
    const filled = fillRung(LADDERS.outreach_never_sent[0], stall);
    expect(filled.body.startsWith('You saved this contact and never sent anything.')).toBe(true);
    expect(filled.title).toBe('Send the note to this contact');
  });

  it('writes a sentence that still reads when the path has no name', () => {
    const stall = stallFor('path_without_experiment', {
      subjectName: '',
      label: 'You picked a path and there is still no experiment under it.',
    });
    const closeOut = fillRung(LADDERS.path_without_experiment[3], stall);
    expect(closeOut.title).toBe('Close out this path');
    // The generic noun cannot repeat a verb the sentence around it already
    // uses. "the path you picked" gave us "You picked the path you picked."
    expect(fillRung(LADDERS.path_without_experiment[0], stall).body)
      .toContain('You picked this path and there is nothing under it');
  });

  it('still recovers a name from the label for a stall built before names existed', () => {
    const old = {
      kind: 'experiment_without_guide',
      subjectType: 'experiment',
      subjectId: 'e1',
      label: '“Shadow a product analyst” has no steps yet, so there is nothing to start on.',
    };
    expect(fillRung(LADDERS.experiment_without_guide[0], old).title).toContain('Shadow a product analyst');
  });
});

describe('an ignored ask costs a rung on its own', () => {
  // The ladder cannot depend on something else writing `expired` on a row
  // first. Nothing writes that today, and a ladder that stands still is six
  // identical emails.
  it('gets smaller over four passes with nothing ever marking a row expired', () => {
    const pulse = pulseWith([stallFor('experiment_without_guide')]);
    let history = [];
    const asks = [];
    for (let pass = 1; pass <= 4; pass += 1) {
      const ask = chooseAsk({ pulse, history, now: at((pass - 1) * 8), passNumber: pass, userId: 'u1' });
      asks.push(ask);
      history = [...history, { ...ask, id: `n${history.length + 1}`, delivered_at: at((pass - 1) * 8) }];
    }
    expect(history.every((r) => r.status === 'pending')).toBe(true);
    expect(asks.map((a) => a.rung)).toEqual([0, 1, 2, 3]);
    expect(asks.map((a) => a.size)).toEqual(['large', 'medium', 'one_line', 'one_line']);
    expect(asks[3].action_kind).toBe('rule_out');
  });

  it('holds the rung while the unanswered ask is still inside its window', () => {
    const history = [row({ status: 'pending', delivered_at: at(-(PENDING_EXPIRY_DAYS - 1)) })];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(0);
  });

  it('drops a rung once it is past the window, without anyone touching the row', () => {
    const history = [row({ status: 'pending', delivered_at: at(-(PENDING_EXPIRY_DAYS + 1)) })];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(1);
  });
});

describe('the rung starts over when the subject changes', () => {
  it('asks a fresh experiment from the top after two passes on another one', () => {
    const first = stallFor('experiment_without_guide');
    const second = stallFor('experiment_without_guide', {
      subjectId: 'e9', subjectName: 'Sit in on a sprint review',
    });
    let history = [];
    const asks = [];
    for (let pass = 1; pass <= 4; pass += 1) {
      const stall = pass <= 2 ? first : second;
      const now = at((pass - 1) * 8);
      const ask = chooseAsk({ pulse: pulseWith([stall]), history, now, passNumber: pass, userId: 'u1' });
      asks.push(ask);
      history = [...history, { ...ask, id: `n${history.length + 1}`, delivered_at: now }];
    }
    expect(asks.map((a) => a.subject_id)).toEqual(['e1', 'e1', 'e9', 'e9']);
    expect(asks.map((a) => a.rung)).toEqual([0, 1, 0, 1]);
    // The third email is the one that mattered: a rule out on an experiment
    // nobody had been asked about once.
    expect(asks[2].action_kind).toBe('generate_guide');
    expect(asks[2].ask_title).toContain('Sit in on a sprint review');
  });

  it('reads a whole ladder of refusals about one subject as nothing about another', () => {
    const history = [
      row({ id: 'n1', subject_id: 'e1', rung: 0, rung_key: 'experiment_without_guide.r0', status: 'declined', delivered_at: at(-30) }),
      row({ id: 'n2', subject_id: 'e1', rung: 1, rung_key: 'experiment_without_guide.r1', status: 'declined', delivered_at: at(-20) }),
    ];
    expect(rungFor('experiment_without_guide', history, NOW, 'e1')).toBe(2);
    expect(rungFor('experiment_without_guide', history, NOW, 'e2')).toBe(0);
    // No subject named at all is still the whole-kind read, which is what
    // isRetired asks for.
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(2);
  });

  it('still caps the kind, so a pile of new subjects cannot restart it forever', () => {
    const history = Array.from({ length: RETIRE_AFTER_ASKS }, (unused, i) => row({
      id: `x${i}`, subject_id: `e${i}`, rung: 0, rung_key: 'experiment_without_guide.r0',
      status: 'expired', delivered_at: at(-(60 - i)),
    }));
    expect(rungFor('experiment_without_guide', history, NOW, 'brand-new')).toBeNull();
    expect(isRetired('experiment_without_guide', history, NOW)).toBe(true);
  });
});

describe('the row chooseAsk hands back', () => {
  it('is complete, with no undefined and no NaN', () => {
    const pulse = pulseWith([stallFor('experiment_without_guide')]);
    const ask = chooseAsk({ pulse, history: [], now: NOW, passNumber: 3, userId: 'u1' });

    for (const field of ['user_id', 'stall_kind', 'status']) {
      expect(typeof ask[field]).toBe('string');
      expect(ask[field].length).toBeGreaterThan(0);
    }
    for (const [field, value] of Object.entries(ask)) {
      expect(value, field).not.toBeUndefined();
      expect(value, field).not.toBeNull();
      if (typeof value === 'number') expect(Number.isFinite(value), field).toBe(true);
    }

    expect(ask.user_id).toBe('u1');
    expect(ask.pass_number).toBe(3);
    expect(ask.generated_at).toBe(NOW);
    expect(ask.status).toBe('pending');
    expect(ask.delivered_channel).toBe('none');
    expect(ask.deletion_status).toBe('active');
    expect(ask.subject_type).toBe('experiment');
    expect(ask.subject_id).toBe('e1');
    expect(ask.rung).toBe(0);
    expect(ask.rung_key).toBe('experiment_without_guide.r0');
    expect(ask.pulse_summary.length).toBeGreaterThan(0);
  });

  it('takes the user id from the history when no user was passed in', () => {
    const pulse = pulseWith([stallFor('reflection_overdue')]);
    const ask = chooseAsk({ pulse, history: [row({ stall_kind: 'nothing', user_id: 'u9', status: 'completed' })], now: NOW });
    expect(ask.user_id).toBe('u9');
  });

  it('walks the stalls in the order student-pulse sorted them', () => {
    const pulse = pulseWith([stallFor('no_path_selected'), stallFor('experiment_without_guide')]);
    const ask = chooseAsk({ pulse, history: [], now: NOW, passNumber: 1, userId: 'u1' });
    expect(ask.stall_kind).toBe('no_path_selected');
    expect(ask.subject_type).toBe('path');
  });

  it('falls back to the account subject type when the stall carries a strange one', () => {
    const pulse = pulseWith([stallFor('experiment_without_guide', { subjectType: 'wormhole' })]);
    const ask = chooseAsk({ pulse, history: [], now: NOW, passNumber: 1, userId: 'u1' });
    expect(ask.subject_type).toBe('account');
  });
});

describe('malformed input never takes the pass down', () => {
  const pulse = pulseWith([stallFor('experiment_without_guide')]);

  it('survives null rows, missing statuses, and unparseable dates', () => {
    const history = [
      null,
      undefined,
      'not a row',
      7,
      {},
      { stall_kind: 'experiment_without_guide' },
      { stall_kind: 'experiment_without_guide', status: 'declined', generated_at: 'whenever', rung: 'two' },
    ];
    expect(() => rungFor('experiment_without_guide', history, NOW)).not.toThrow();
    const ask = chooseAsk({ pulse, history, now: NOW, passNumber: 2, userId: 'u1' });
    expect(ask).not.toBeNull();
    expect(Number.isInteger(ask.rung)).toBe(true);
    expect(ask.rung).toBeGreaterThanOrEqual(0);
  });

  it('degrades a rung_key that no longer exists instead of throwing', () => {
    const history = [row({ rung_key: 'experiment_without_guide.r99', rung: 1, status: 'declined' })];
    expect(rungFor('experiment_without_guide', history, NOW)).toBe(2);

    const orphan = [row({ rung_key: 'a_kind_we_deleted.r0', rung: undefined, status: 'declined' })];
    expect(rungFor('experiment_without_guide', orphan, NOW)).toBe(1);
  });

  it('returns null for a kind with no ladder, and for junk arguments', () => {
    expect(rungFor('a_kind_we_deleted', [], NOW)).toBeNull();
    expect(rungFor(null, null, null)).toBeNull();
    expect(chooseAsk()).toBeNull();
    expect(chooseAsk({ pulse: null, history: [], now: NOW })).toBeNull();
    expect(chooseAsk({ pulse, history: [], now: 'whenever', userId: 'u1' })).toBeNull();
    expect(chooseAsk({ pulse, history: [], now: NOW })).toBeNull();
    expect(chooseAsk({ pulse: pulseWith([null, { kind: 'a_kind_we_deleted' }]), history: [], now: NOW, userId: 'u1' })).toBeNull();
    expect(() => fillRung(null, null)).not.toThrow();
    expect(() => shouldSkipPass()).not.toThrow();
  });

  it('leaves an acceptance alone when there is no clock to age it against', () => {
    const history = [row({ status: 'accepted', responded_at: at(-40) })];
    expect(rungFor('experiment_without_guide', history, 'whenever')).toBe(0);
  });
});
