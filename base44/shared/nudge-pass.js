/**
 * One weekly pass, decided without touching the network.
 *
 * The backend function around this file does four things: read every entity,
 * call `planPass`, write what it says, send what it says. Everything that
 * involves a judgement lives here instead, because a decision that can only be
 * tested by running a scheduled job against 86 real students is a decision that
 * never gets tested.
 *
 * Pure. No SDK, no clock, no network, relative and extension qualified imports
 * only, so a Deno backend function can import this file as it stands.
 */
import { entityTime } from './dates.js';
import { readPulse, summarizePulse } from './student-pulse.js';
import { chooseAsk, expireStale, shouldSkipPass } from './nudge.js';

/**
 * How many students one pass may write to.
 *
 * Low on purpose and duplicated as a hard cap in the backend function. 82 of 86
 * students currently produce an ask, and there is no week where sending all 82
 * is a better idea than sending 25 and reading what comes back.
 */
export const DEFAULT_PASS_LIMIT = 25;

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const rows = (v) => (Array.isArray(v) ? v.filter((r) => !!r && typeof r === 'object') : []);

/** Ordering helper that survives Infinity, which subtraction does not. */
const cmp = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/** The instant a nudge row reached the student, or -Infinity if it never did. */
function askedMs(row) {
  const t = entityTime(row.delivered_at || row.generated_at || row.created_date);
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * Every entity list, grouped into one bucket per student.
 *
 * The backend function reads each entity once for the whole population, which
 * is 11 requests rather than 86 times 11. This is what turns those flat lists
 * back into the per student shape `readPulse` wants.
 *
 * The owner of a row is looked for in three places, in order, because
 * `user_id` on these entities is written by several different code paths and is
 * not reliably populated: some rows carry it, some carry only the Base44
 * `created_by_id`, and the oldest carry only the `created_by` email.
 * StudentProfile has no `user_id` field at all.
 *
 * @param {object[]} users the User rows
 * @param {object} lists {profiles, paths, experiments, missions, guides, proof,
 *   reflections, outreach, events, nudges}, each an array
 * @returns {object} user id to the bucket readPulse and chooseAsk want
 */
export function groupRowsByUser(users, lists = {}) {
  const byId = new Map();
  const byEmail = new Map();
  const out = {};

  for (const user of rows(users)) {
    const id = str(user.id);
    if (!id) continue;
    byId.set(id, id);
    const email = str(user.email).toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, id);
    out[id] = {
      profile: null,
      paths: [],
      experiments: [],
      missions: [],
      guides: [],
      proof: [],
      reflections: [],
      outreach: [],
      events: [],
      nudges: [],
    };
  }

  const ownerOf = (row) => {
    const direct = str(row.user_id);
    if (direct && byId.has(direct)) return direct;
    const creator = str(row.created_by_id);
    if (creator && byId.has(creator)) return creator;
    const email = (str(row.created_by) || str(row.user_email)).toLowerCase();
    if (email && byEmail.has(email)) return byEmail.get(email);
    return '';
  };

  const file = (key, list) => {
    for (const row of rows(list)) {
      const owner = ownerOf(row);
      if (owner) out[owner][key].push(row);
    }
  };

  // A student can have several profile rows. The newest one is the one the app
  // itself reads, so it is the one used here.
  let bestProfile = {};
  for (const row of rows(lists.profiles)) {
    const owner = ownerOf(row);
    if (!owner) continue;
    const t = entityTime(row.updated_date || row.created_date);
    const held = bestProfile[owner];
    if (!held || (Number.isFinite(t) && t > held.t)) {
      bestProfile[owner] = { row, t: Number.isFinite(t) ? t : -Infinity };
      out[owner].profile = row;
    }
  }
  bestProfile = null;

  file('paths', lists.paths);
  file('experiments', lists.experiments);
  file('missions', lists.missions);
  file('guides', lists.guides);
  file('proof', lists.proof);
  file('reflections', lists.reflections);
  file('outreach', lists.outreach);
  file('events', lists.events);
  file('nudges', lists.nudges);

  return out;
}

/** The prior nudge rows for one student, from whichever shape the caller has. */
function historyIndex(history) {
  const index = new Map();
  if (Array.isArray(history)) {
    for (const row of rows(history)) {
      const uid = str(row.user_id);
      if (!uid) continue;
      if (!index.has(uid)) index.set(uid, []);
      index.get(uid).push(row);
    }
  } else if (history && typeof history === 'object') {
    for (const [uid, list] of Object.entries(history)) index.set(uid, rows(list));
  }
  return index;
}

const emptyPlan = (passNumber, generatedAt, users, reason) => ({
  passNumber,
  generatedAt,
  toExpire: [],
  toCreate: [],
  toEmail: [],
  skipped: rows(users).map((u) => ({ userId: str(u.id), reason })),
  silent: [],
  counts: { users: rows(users).length, asked: 0, skipped: rows(users).length, silent: 0, expired: 0 },
});

/**
 * Everything one pass would do, as data, with nothing done.
 *
 * @param {{users: object[], rowsByUser: object, history?: object[]|object,
 *   now: any, passNumber?: number, limit?: number}} input
 * @returns {object} PassPlan
 */
export function planPass(input = {}) {
  const {
    users, rowsByUser = {}, history, now, passNumber, limit,
  } = input || {};

  const people = rows(users);
  const pass = Number.isFinite(passNumber) ? Math.max(1, Math.floor(passNumber)) : 1;
  const nowMs = entityTime(now);
  const generatedAt = Number.isFinite(nowMs) ? new Date(nowMs).toISOString() : null;
  if (!Number.isFinite(nowMs)) {
    return emptyPlan(pass, generatedAt, people, 'no usable clock for this pass');
  }

  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : DEFAULT_PASS_LIMIT;
  const index = historyIndex(history);

  const toExpire = [];
  const skipped = [];
  const silent = [];
  const candidates = [];

  for (const user of people) {
    const userId = str(user.id);
    if (!userId) {
      skipped.push({ userId: '', reason: 'no account id on the user row' });
      continue;
    }

    const bucket = rowsByUser[userId] || {};
    const stored = index.has(userId) ? index.get(userId) : rows(bucket.nudges);

    // Expiring is bookkeeping and happens for everyone, including students this
    // pass will not write to. A row left pending forever never costs a rung, and
    // a rung that is never dropped is the whole ladder not working.
    const expiredIds = expireStale(stored, now);
    for (const id of expiredIds) toExpire.push(id);
    const expired = new Set(expiredIds);
    const seen = expired.size
      ? stored.map((r) => (expired.has(str(r.id)) ? { ...r, status: 'expired' } : r))
      : stored;

    const email = str(user.email);
    if (!email) {
      skipped.push({ userId, reason: 'no email address on the account' });
      continue;
    }

    const pulse = readPulse({
      now,
      user,
      profile: bucket.profile || null,
      paths: bucket.paths,
      experiments: bucket.experiments,
      missions: bucket.missions,
      guides: bucket.guides,
      proof: bucket.proof,
      reflections: bucket.reflections,
      outreach: bucket.outreach,
      events: bucket.events,
    });

    const reason = shouldSkipPass({ pulse, history: seen, now, user, userId });
    if (reason) {
      skipped.push({ userId, reason });
      continue;
    }

    const summary = summarizePulse(pulse);
    const ask = chooseAsk({
      pulse, history: seen, now, passNumber: pass, user, userId, pulseSummary: summary,
    });
    if (!ask) {
      silent.push({ userId });
      continue;
    }

    candidates.push({
      userId,
      email,
      ask,
      lastAskedMs: seen.reduce((best, r) => Math.max(best, askedMs(r)), -Infinity),
      lastEvidenceMs: Number.isFinite(entityTime(pulse.lastEvidenceAt))
        ? entityTime(pulse.lastEvidenceAt)
        : -Infinity,
    });
  }

  // Whoever sorts first gets the email, because the cap is 25 and there are 82
  // people who qualify. Sorting by anything to do with the student (severity,
  // signup date, id) would mean the same 25 students hear from us every week
  // and the other 57 never do. Longest since we last wrote is the one key that
  // rotates: sending to somebody moves them to the back of the queue. Longest
  // without any evidence breaks the tie among the people we have never written
  // to, and the id breaks the last tie so two runs of the same pass agree.
  candidates.sort((a, b) => cmp(a.lastAskedMs, b.lastAskedMs)
    || cmp(a.lastEvidenceMs, b.lastEvidenceMs)
    || cmp(a.userId, b.userId));

  const chosen = candidates.slice(0, cap);
  for (const held of candidates.slice(cap)) {
    // Deliberately no row and no email. A StudentNudge row written for somebody
    // we did not contact is an ask they never saw, and it would block next
    // week's real one and then cost them a rung when it expired.
    skipped.push({ userId: held.userId, reason: 'held back by the send cap for this pass' });
  }

  return {
    passNumber: pass,
    generatedAt,
    toExpire,
    toCreate: chosen.map((c) => c.ask),
    toEmail: chosen.map((c) => ({ userId: c.userId, email: c.email, ask: c.ask })),
    skipped,
    silent,
    counts: {
      users: people.length,
      asked: chosen.length,
      skipped: skipped.length,
      silent: silent.length,
      expired: toExpire.length,
    },
  };
}
