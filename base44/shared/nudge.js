/**
 * The memory layer: decide the one thing to ask a student this week, given
 * everything we have already asked them.
 *
 * A chat window can write a good outreach email. What it cannot do is remember
 * that it already told you to run a 30 day experiment, notice that you did not,
 * and come back with a ten minute version instead. That is this file. The asset
 * is not the ask, it is the record of what was asked and refused.
 *
 * Two rules here are worth arguing about, so they are written down rather than
 * left in the code:
 *
 * 1. **Silence and a no are the same signal.** A nudge that expired unanswered
 *    drops a rung exactly like a decline does. Treating silence as neutral is
 *    how this product ended up with 265 experiments and 1 proof row.
 * 2. **An unfulfilled yes is worse than a no.** Accepting and then not doing it
 *    is the strongest evidence the ask was too big, so it drops a rung too. Do
 *    not read `accepted` as success. Only `completed`, or a later
 *    `evidence_seen_at` from the pulse, is success.
 *
 * Pure functions. No SDK import, no network, no clock: `now` is always a
 * parameter. Relative, extension qualified imports only, so a Deno backend
 * function can import this file as it stands.
 */
import { entityTime } from './dates.js';
import { summarizePulse } from './student-pulse.js';
import { fillRung, ladderFor } from './nudge-ladder.js';
import { isOptedOut } from './nudge-response.js';

const DAY = 86400000;

/**
 * How long a sent nudge waits for an answer before it counts as ignored.
 * The pass runs weekly, so an ask that is still unanswered when the next pass
 * comes round has had its whole life and did not get one.
 */
export const PENDING_EXPIRY_DAYS = 7;

/**
 * How long an accepted nudge has to produce evidence before we decide the ask
 * was too big. Same week: they said yes, they had every day until the next
 * pass, and the pulse saw nothing.
 */
export const ACCEPTANCE_WINDOW_DAYS = 7;

/**
 * Hard cap on asks per stall kind between successes. The ladders are shorter
 * than this, so it only bites when a ladder is edited after rows already exist.
 * It is here so that lengthening a ladder can never turn into an endless drip.
 */
export const RETIRE_AFTER_ASKS = 6;

/**
 * How many asks a student can be sent, with not one answer of any kind ever,
 * before we stop writing to them for good. A student who declines gets three
 * emails, so a student who says nothing cannot be allowed to get forty.
 */
export const SILENCE_LIMIT_ASKS = 7;

const PENDING_EXPIRY_MS = PENDING_EXPIRY_DAYS * DAY;
const ACCEPTANCE_WINDOW_MS = ACCEPTANCE_WINDOW_DAYS * DAY;

const SUBJECT_TYPES = ['experiment', 'mission', 'outreach', 'path', 'account'];

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const isDeleted = (r) => r.deletion_status === 'deleted' || r.deletion_status === 'permanently_deleted';

/** Objects only, soft-deleted rows dropped. Every row here was written by a job. */
function liveRows(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((r) => !!r && typeof r === 'object' && !isDeleted(r));
}

/** When the student was actually asked. Delivery first, generation as a fallback. */
const askedAt = (row) => row.delivered_at || row.generated_at || row.created_date || null;

/** When they answered, for the rows that have an answer. */
const answeredAt = (row) => row.responded_at || askedAt(row);

/** Age in milliseconds, or null when the row cannot be dated at all. */
function ageMs(value, nowMs) {
  const t = entityTime(value);
  if (!Number.isFinite(t) || !Number.isFinite(nowMs)) return null;
  return nowMs - t;
}

/**
 * Oldest first, with a row we cannot date treated as the newest thing here.
 *
 * The comment used to say these rows keep their original order and the code
 * sorted them to the front, which is the one reading that is certainly wrong:
 * the last row in the sort is the one the rung decision is made against, so an
 * undateable row sorted to the front hides itself and hands the decision to an
 * older row. Rows are written one per pass and appended, so an undateable row
 * is the most recent one we know of. Sorting it last says that.
 */
function byTimeAsc(a, b) {
  const ta = entityTime(askedAt(a));
  const tb = entityTime(askedAt(b));
  const ka = Number.isFinite(ta) ? ta : Infinity;
  const kb = Number.isFinite(tb) ? tb : Infinity;
  if (ka === kb) return 0;
  return ka < kb ? -1 : 1;
}

/**
 * Which rung of the current ladder a stored row came from.
 *
 * `rung_key` is the stable id and is checked first. Ladders do get edited after
 * rows exist, so a key that no longer resolves falls back to the number, and a
 * number that is missing or out of range falls back to the top of the ladder.
 * The one thing this must never do is throw: a single stale row would otherwise
 * take out the whole weekly pass.
 */
function rungIndex(row, ladder) {
  const key = str(row.rung_key);
  if (key) {
    const found = ladder.findIndex((r) => r.key === key);
    if (found >= 0) return found;
  }
  if (Number.isFinite(row.rung)) {
    return Math.max(0, Math.min(ladder.length - 1, Math.floor(row.rung)));
  }
  return 0;
}

/**
 * Did this row tell us the ask was too big.
 *
 * A decline says so. An expiry says so, because not answering and saying no are
 * the same signal here. A pending row that has outlived its window says the
 * same thing and is read that way here rather than waiting for something else
 * to write `expired` on it first: an ignored ask has to cost a rung on its own,
 * or a student who answers nothing gets the same email six times. Marking the
 * row is then a tidy-up, not the thing the ladder depends on. And an acceptance
 * that produced nothing inside the window says so loudest of all.
 */
function dropsARung(row, nowMs) {
  if (row.status === 'declined' || row.status === 'expired') return true;
  if (row.status === 'pending') {
    const age = ageMs(askedAt(row), nowMs);
    return age !== null && age > PENDING_EXPIRY_MS;
  }
  if (row.status !== 'accepted') return false;
  if (str(row.evidence_seen_at)) return false;
  const age = ageMs(answeredAt(row), nowMs);
  return age !== null && age > ACCEPTANCE_WINDOW_MS;
}

/**
 * Is this row a reason to leave the kind alone this pass.
 *
 * Pending and still inside its window: they have an ask open and stacking a
 * second one on top is how a nudge engine becomes spam. Accepted and still
 * inside the acceptance window: they said yes this week, so give them the week.
 *
 * A pending row we cannot date blocks nothing. It also never expires, which is
 * a small leak, but the alternative is one undateable row freezing a student's
 * whole ladder forever.
 */
function blocksNewAsk(row, nowMs) {
  if (row.status === 'pending') {
    const age = ageMs(askedAt(row), nowMs);
    return age !== null && age <= PENDING_EXPIRY_MS;
  }
  if (row.status === 'accepted' && !str(row.evidence_seen_at)) {
    const age = ageMs(answeredAt(row), nowMs);
    return age !== null && age <= ACCEPTANCE_WINDOW_MS;
  }
  return false;
}

/**
 * The rung to ask next for one stall kind, or null when the kind is retired for
 * this student.
 *
 * `now` is a third parameter rather than part of the history because rule 5,
 * the unfulfilled acceptance, is the one rule that needs a clock. Without a
 * usable `now` an acceptance is left alone rather than counted as a refusal,
 * which is the conservative direction.
 *
 * @param {string} stallKind the `kind` from a readPulse stall
 * @param {object[]} history prior StudentNudge rows, any kinds, any shape
 * @param {Date|string|number} [now]
 * @param {string} [subjectId] the row the next ask is about. Left out, the
 *   answer covers the kind as a whole, which is what `isRetired` wants.
 * @returns {number|null}
 */
export function rungFor(stallKind, history, now, subjectId) {
  const ladder = ladderFor(stallKind);
  if (!ladder.length) return null;
  const nowMs = entityTime(now);

  const mine = liveRows(history)
    .filter((r) => r.stall_kind === stallKind)
    .sort(byTimeAsc);

  // Everything up to and including the last success is a closed chapter. A kind
  // that comes back after it worked is a new instance of the problem, not a
  // repeat refusal, so it starts at the top of the ladder again.
  let lastWin = -1;
  mine.forEach((row, i) => {
    if (row.status === 'completed' || str(row.evidence_seen_at)) lastWin = i;
  });
  const open = mine.slice(lastWin + 1);
  // The cap is on the kind as a whole and is checked before the subject is,
  // because a student with 31 guideless experiments would otherwise hear about
  // nothing else for the rest of the year: a fresh subject starts a fresh
  // ladder, and fresh ladders never run out.
  if (open.length >= RETIRE_AFTER_ASKS) return null;

  // Which rung, though, is per subject. 72 of the 73 students with a guideless
  // experiment have two or more of them, so "you have ignored this three times,
  // shall we rule it out" lands on an experiment nobody was ever asked about:
  // they act on the first one, it drops out of the pulse, and the next row
  // inherits three refusals it had nothing to do with. A caller that does not
  // name a subject still gets the whole-kind read.
  const scoped = subjectId === undefined
    ? open
    : open.filter((row) => str(row.subject_id) === str(subjectId));

  if (scoped.length === 0) return 0;

  // The highest rung reached, not the last one recorded, so a stale or repaired
  // row can never walk a student back up to an ask they already refused.
  let highest = 0;
  for (const row of scoped) highest = Math.max(highest, rungIndex(row, ladder));

  const latest = scoped[scoped.length - 1];
  const next = dropsARung(latest, nowMs) ? highest + 1 : highest;
  if (next >= ladder.length) return null;
  return next;
}

/** True when this student has run out of ladder for a kind. */
export function isRetired(stallKind, history, now) {
  return rungFor(stallKind, history, now) === null;
}

/**
 * The pending nudges that have waited long enough to count as ignored.
 *
 * A row sitting exactly on the window is not expired yet. The pass does not run
 * at the same minute every week, and costing somebody a rung over a rounding
 * boundary is a bad trade.
 *
 * @param {object[]} history prior StudentNudge rows
 * @param {Date|string|number} now
 * @returns {string[]} row ids
 */
export function expireStale(history, now) {
  const nowMs = entityTime(now);
  if (!Number.isFinite(nowMs)) return [];
  const out = [];
  for (const row of liveRows(history)) {
    if (row.status !== 'pending') continue;
    const age = ageMs(askedAt(row), nowMs);
    if (age === null || age <= PENDING_EXPIRY_MS) continue;
    const id = str(row.id);
    if (id) out.push(id);
  }
  return out;
}

function resolveUserId({ userId, user, history }) {
  const direct = str(userId) || str(typeof user === 'string' ? user : user && user.id);
  if (direct) return direct;
  for (const row of history) {
    const fromRow = str(row.user_id);
    if (fromRow) return fromRow;
  }
  return '';
}

function accountLooksGone(user) {
  if (!user || typeof user !== 'object') return false;
  return isDeleted(user) || user.is_deleted === true;
}

/**
 * Has this student told us to stop.
 *
 * The test is a decline at the bottom of a ladder, on every kind we have ever
 * raised with them. One kind refused at the bottom is a verdict on that kind.
 * Every kind refused at the bottom is a verdict on us.
 */
/** The statuses that only exist because the student did something with an ask. */
const ANSWERED_STATUSES = ['accepted', 'declined', 'completed'];

/**
 * Has this student ever answered anything, in any way. A reply, a yes, a no, or
 * evidence the pulse tied back to an ask all count. Silence is the only thing
 * that does not.
 */
function everAnswered(history) {
  return history.some((row) => ANSWERED_STATUSES.includes(row.status)
    || !!str(row.reply_text)
    || !!str(row.evidence_seen_at));
}

function toldUsToStop(history) {
  const kinds = new Set();
  const silenced = new Set();
  for (const row of history) {
    const kind = str(row.stall_kind);
    if (!kind) continue;
    kinds.add(kind);
    if (row.status !== 'declined') continue;
    if (row.size === 'one_line' || row.action_kind === 'rule_out') {
      silenced.add(kind);
      continue;
    }
    // Older rows may not carry size or action_kind. Ask the ladder instead.
    const ladder = ladderFor(kind);
    const rung = ladder[rungIndex(row, ladder)];
    if (rung && (rung.size === 'one_line' || rung.action_kind === 'rule_out')) silenced.add(kind);
  }
  if (kinds.size === 0) return false;
  for (const kind of kinds) if (!silenced.has(kind)) return false;
  return true;
}

/**
 * Should this pass write nothing at all for this student.
 *
 * `optOuts` and `optedOut` are both optional and both additive: a caller that
 * passes neither gets exactly the behaviour this function had before opting out
 * existed. `optOuts` is the raw NudgeOptOut rows, `optedOut` is the answer when
 * the caller has already worked it out for the whole population.
 *
 * @param {{pulse: object, history?: object[], now: any, user?: object|string,
 *   userId?: string, optOuts?: object[], optedOut?: boolean}} input
 * @returns {string|null} null to proceed, otherwise a short reason for the log
 */
export function shouldSkipPass(input = {}) {
  const {
    pulse, history, now, user = null, userId, optOuts, optedOut,
  } = input || {};
  const rowsAll = liveRows(history);
  const nowMs = entityTime(now);

  if (accountLooksGone(user)) return 'the account is deleted';
  const uid = resolveUserId({ userId, user, history: rowsAll });
  if (!uid) return 'no account id to write a nudge for';

  // Checked before anything else about their records, because this is the one
  // skip reason that is a promise rather than a judgement. Every email we send
  // ends with a sentence saying they can turn these off, and this is the line
  // that makes that sentence true.
  if (optedOut === true || isOptedOut(optOuts, uid)) return 'the student turned these emails off';
  if (!pulse || typeof pulse !== 'object') return 'no pulse to read';
  if (!Number.isFinite(nowMs)) return 'no usable clock for this pass';

  // One open proposal at a time, whatever its status. An accepted ask inside
  // its week is as open as an unanswered one: they said yes and have not done
  // it yet, and a second ask on a different kind on top of that is the engine
  // talking over itself.
  const open = rowsAll.find((row) => blocksNewAsk(row, nowMs));
  if (open) return 'an ask from an earlier pass is still open';

  if (toldUsToStop(rowsAll)) return 'the student has asked us to stop';

  // Nobody home. Everything we sent went unanswered, so stop for good rather
  // than keep a one sided correspondence going for another eight months.
  if (rowsAll.length >= SILENCE_LIMIT_ASKS && !everAnswered(rowsAll)) {
    return 'this student has never answered anything we sent';
  }

  const stalls = Array.isArray(pulse.stalls) ? pulse.stalls : [];
  if (pulse.state === 'working' && stalls.length === 0) return 'the student is working and nothing is stalled';

  return null;
}

/**
 * The one thing to ask this pass, as a row ready to become a StudentNudge, or
 * null for "say nothing this week."
 *
 * Null has to be genuinely reachable. An engine that always has something to
 * say is a spam engine, and the students this is for have already ignored
 * everything else we sent them.
 *
 * @param {{pulse: object, history?: object[], now: any, passNumber?: number,
 *   user?: object|string, userId?: string, pulseSummary?: string}} input
 * @returns {object|null}
 */
export function chooseAsk(input = {}) {
  const { pulse, history, now, passNumber, user = null, userId, pulseSummary } = input || {};
  if (!pulse || typeof pulse !== 'object') return null;

  const nowMs = entityTime(now);
  // A proposal that cannot be dated cannot be expired later, and a nudge that
  // never expires never drops a rung, so there is no safe version of this.
  if (!Number.isFinite(nowMs)) return null;

  const rowsAll = liveRows(history);
  const uid = resolveUserId({ userId, user, history: rowsAll });
  if (!uid) return null;

  const stalls = Array.isArray(pulse.stalls) ? pulse.stalls : [];
  for (const stall of stalls) {
    if (!stall || typeof stall !== 'object') continue;
    const kind = str(stall.kind);
    const ladder = ladderFor(kind);
    if (!ladder.length) continue;

    const mine = rowsAll.filter((row) => row.stall_kind === kind);
    if (mine.some((row) => blocksNewAsk(row, nowMs))) continue;

    const subjectId = str(stall.subjectId);
    const index = rungFor(kind, mine, now, subjectId);
    if (index === null) continue;

    const filled = fillRung(ladder[index], stall, pulse);
    const subjectType = SUBJECT_TYPES.includes(stall.subjectType) ? stall.subjectType : 'account';

    return {
      user_id: uid,
      pass_number: Number.isFinite(passNumber) ? Math.max(1, Math.floor(passNumber)) : 1,
      generated_at: new Date(nowMs).toISOString(),
      stall_kind: kind,
      subject_type: subjectType,
      subject_id: subjectId,
      rung: index,
      rung_key: filled.key,
      size: filled.size,
      ask_title: filled.title,
      ask_body: filled.body,
      action_kind: filled.action_kind,
      action_target: filled.target,
      question: filled.question,
      status: 'pending',
      delivered_channel: 'none',
      pulse_summary: str(pulseSummary) || summarizePulse(pulse),
      deletion_status: 'active',
    };
  }

  return null;
}
