import { describe, it, expect } from 'vitest';
import {
  chooseAsk, expireStale, isRetired, rungFor, shouldSkipPass,
  ACCEPTANCE_WINDOW_DAYS, PENDING_EXPIRY_DAYS, RETIRE_AFTER_ASKS,
} from './nudge.js';
import { LADDERS, MAX_TITLE_CHARS, RUNG_SIZES, fillRung, ladderFor } from './nudge-ladder.js';

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

// One realistic stall per kind, with the label written the way student-pulse
// writes it. The copy pulls the subject's name back out of these labels, so a
// made up label would test nothing.
const REAL_STALLS = {
  no_path_selected: {
    subjectType: 'path', subjectId: null,
    label: 'You have paths to compare, and you have not picked one to test yet.',
  },
  path_without_experiment: {
    subjectType: 'path', subjectId: 'p1',
    label: 'You picked Product analyst and there is still no experiment under it.',
  },
  experiment_without_guide: {
    subjectType: 'experiment', subjectId: 'e1',
    label: '“Shadow a product analyst” has no steps yet, so there is nothing to start on.',
  },
  guide_never_acted_on: {
    subjectType: 'experiment', subjectId: 'e1',
    label: 'You asked for the steps to “How to shadow an analyst” 12 days ago and have not run any of them.',
  },
  mission_planned_stale: {
    subjectType: 'mission', subjectId: 'm1',
    label: '“Email two analysts” has been on your list for 12 days and has not been started.',
  },
  outreach_never_sent: {
    subjectType: 'outreach', subjectId: 'c1',
    label: 'You saved Ada Reyes 9 days ago and never sent anything.',
  },
  outreach_no_followup: {
    subjectType: 'outreach', subjectId: 'c1',
    label: 'You wrote to Ada Reyes and have not heard back. A short nudge is normal here.',
  },
  experiment_no_proof: {
    subjectType: 'experiment', subjectId: 'e1',
    label: '“Shadow a product analyst” has been open for 14 days with nothing logged against it.',
  },
  reflection_overdue: {
    subjectType: 'experiment', subjectId: 'e1',
    label: 'You have not written down what “Shadow a product analyst” is teaching you.',
  },
  dormant_account: {
    subjectType: 'account', subjectId: 'u1',
    label: 'You signed up 30 days ago and nothing has happened since.',
  },
};

const stallFor = (kind, over = {}) => ({
  kind,
  severity: 50,
  sinceISO: at(-30),
  days: 30,
  ...REAL_STALLS[kind],
  ...over,
});

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

  it('never gets bigger going down a ladder', () => {
    for (const [kind, ladder] of Object.entries(LADDERS)) {
      const sizes = ladder.map((r) => RUNG_SIZES.indexOf(r.size));
      expect(sizes.includes(-1), kind).toBe(false);
      for (let i = 1; i < sizes.length; i += 1) {
        expect(sizes[i], `${kind} rung ${i}`).toBeGreaterThanOrEqual(sizes[i - 1]);
      }
      expect(ladder[0].size, kind).toBe('large');
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

  it('falls back to a readable noun when the label carries no name', () => {
    const filled = fillRung(
      LADDERS.experiment_without_guide[0],
      stallFor('experiment_without_guide', { label: 'One of your experiments has no steps yet.' }),
    );
    expect(filled.title).toBe('Get the steps for your experiment');
    expect(filled.body.startsWith('Your experiment has no steps')).toBe(true);
  });

  it('shortens a very long subject instead of overrunning the title', () => {
    const long = '“Write a full market map of every mid market vendor in the northeast”';
    const filled = fillRung(
      LADDERS.reflection_overdue[0],
      stallFor('reflection_overdue', { label: `You have not written down what ${long} is teaching you.` }),
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
