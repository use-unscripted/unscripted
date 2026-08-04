/**
 * Answering a nudge: what to show a student, and what to write when they reply.
 *
 * The rest of the stack asks. This file is the half where a student gets to
 * answer, which until now has not existed anywhere in the product. Everything
 * here is pure: it decides, it does not write. The page and the backend
 * function perform the writes it returns.
 *
 * Three rules are load bearing and are written down rather than left in the
 * code, because each of them is a thing somebody would reasonably undo.
 *
 * 1. **The copy on screen comes from the ladder, and from nowhere else.** Row
 *    level update on StudentNudge is keyed on `data.user_id`, Base44 has no
 *    field level rules, and a student can therefore rewrite every field of
 *    their own nudge row, `user_id` included. `rung_key` is one of those
 *    fields, so "fall back to the stored strings when the key is unknown" is
 *    not a fallback at all: blank the key, write what you like into
 *    `ask_title`, move the row onto somebody else's `user_id`, and we print it
 *    to them as a heading in our type on our domain. An earlier version of this
 *    file did exactly that. So an unresolved `rung_key` now yields **no strings
 *    at all**, and the page says plainly that the question is gone. A ladder
 *    edited after rows exist is a real case and it costs those students one
 *    unanswerable ask, which is the cheap half of this trade.
 *
 * 2. **A reply never becomes a ProofOfWork row.** That entity holds exactly one
 *    row, it belongs to a founder, and its count is a number we quote to
 *    buyers. Every question rung today asks what is in the way, which is not
 *    evidence of anything. The plumbing for a later rung that genuinely does
 *    produce evidence is here (`yieldsProof` on a rung, honoured below), and no
 *    rung in the ladder file sets it.
 *
 * 3. **Ruling something out is a success state.** "I tried it and I do not want
 *    it" is the most useful result an experiment produces and there has never
 *    been anywhere in this product to say it. So a rule out writes a real
 *    status onto the real row, carries the student's words across, and the data
 *    must not read as a failure. See RULE_OUT below for which enum value each
 *    subject gets and why.
 *
 * Pure. No SDK, no clock, no network, relative and extension qualified imports
 * only, so a Deno backend function can import this file as it stands.
 */
import { LADDERS, fillRung } from './nudge-ladder.js';

const DAY = 86400000;

/** How long a soft deleted opt out sits before the purge job may remove it. */
export const OPT_OUT_PURGE_DAYS = 30;

/** The only fields a student's answer is allowed to change on their own row. */
export const RESPONSE_FIELDS = ['status', 'responded_at', 'decline_reason', 'reply_text'];

/** The three things a student can do with an ask. */
export const CHOICES = ['accepted', 'declined', 'answered'];

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const isDeleted = (r) => r.deletion_status === 'deleted' || r.deletion_status === 'permanently_deleted';

/** Trims and caps a free text field, so one paste cannot fill a row. */
function boundedText(value, max) {
  const text = str(value);
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

/** A reply is one sentence. The cap is generous, it is there to stop a paste. */
const MAX_REPLY_CHARS = 2000;

/**
 * Every rung in the file, by its stable key.
 *
 * Built once. Keys are unique across the whole ladder file and a test in
 * nudge.test.js holds them that way.
 */
const RUNGS_BY_KEY = (() => {
  const map = new Map();
  for (const [kind, ladder] of Object.entries(LADDERS)) {
    if (!Array.isArray(ladder)) continue;
    ladder.forEach((rung, index) => {
      if (rung && typeof rung === 'object' && str(rung.key)) {
        map.set(rung.key, { rung, kind, index });
      }
    });
  }
  return map;
})();

/** The rung a stored row came from, or null when the ladder has moved on. */
export function rungForKey(key) {
  const found = RUNGS_BY_KEY.get(str(key));
  return found ? found.rung : null;
}

/**
 * A stall shaped object rebuilt from a stored row, so `fillRung` can run.
 *
 * Only the structural fields are taken off the row. The subject's name comes
 * from the caller, which reads it off the student's own record through their
 * own session, so it is their data rather than anything written into the nudge
 * row. With no name the copy falls back to the ladder's generic noun, which
 * reads correctly in every sentence in the file.
 */
function stallFromRow(row, names = {}) {
  return {
    kind: str(row.stall_kind),
    subjectId: str(row.subject_id) || null,
    subjectName: str(names.subjectName),
    pathName: str(names.pathName),
    subjectType: str(row.subject_type) || 'account',
    label: '',
  };
}

/**
 * Nothing to show, because the rung this row names is not one we have.
 *
 * Every string is empty on purpose. The only strings left on an unresolved row
 * are the ones a student could have written, and the page that renders this
 * puts a heading in our type on our domain in front of whoever the row's
 * `user_id` points at. `closes` is false and both subject fields are blank so
 * that a click on such a row cannot aim a write at a row id somebody chose.
 */
const NOTHING_TO_ASK = {
  title: '',
  body: '',
  question: '',
  action_kind: '',
  size: '',
  target: '',
  source: 'unknown',
  rungKnown: false,
  closes: false,
  yieldsProof: false,
  stallKind: '',
  subjectType: '',
  subjectId: '',
};

/**
 * Will answering yes to this ask actually close something.
 *
 * The page asks so it can stop offering "yes, close it out" on an ask where
 * nothing would be closed, and `planResponse` agrees with it by construction
 * rather than by both of them reading the same fields the same way.
 */
function closesSomething(actionKind, subjectType, subjectId) {
  if (actionKind !== 'rule_out') return false;
  if (subjectType === 'account') return true;
  return !!RULE_OUT[subjectType] && !!str(subjectId);
}

/**
 * What to put on screen for one stored nudge row.
 *
 * @param {object} nudgeRow the StudentNudge row
 * @param {{subjectName?: string, pathName?: string}} [names] read from the
 *   student's own subject record, never from the nudge row
 * @returns {{title: string, body: string, question: string, action_kind: string,
 *   size: string, target: string, source: 'ladder'|'unknown',
 *   rungKnown: boolean, closes: boolean, yieldsProof: boolean,
 *   stallKind: string, subjectType: string, subjectId: string}}
 */
export function describeAsk(nudgeRow, names = {}) {
  const row = nudgeRow && typeof nudgeRow === 'object' ? nudgeRow : {};

  const rung = rungForKey(row.rung_key);
  // No rung, no ask. See rule 1 at the top of this file before softening this
  // into "show the stored strings when we cannot resolve the key".
  if (!rung) return { ...NOTHING_TO_ASK };

  const subjectType = str(row.subject_type) || 'account';
  const subjectId = str(row.subject_id);
  const filled = fillRung(rung, stallFromRow(row, names), null);
  return {
    title: filled.title,
    body: filled.body,
    question: filled.question,
    action_kind: filled.action_kind,
    size: filled.size,
    target: filled.target,
    source: 'ladder',
    rungKnown: true,
    closes: closesSomething(filled.action_kind, subjectType, subjectId),
    yieldsProof: rung.yieldsProof === true,
    stallKind: str(row.stall_kind),
    subjectType,
    subjectId,
  };
}

/**
 * Where a deliberate rule out is recorded, per subject type.
 *
 * **No entity in this app has an enum value that means "the student decided
 * against this on purpose."** Every status list was written for work that
 * either finishes or does not. So each of these is the closest honest existing
 * value, and the student's own words go alongside it in a field built for text,
 * because the words are the part that is worth anything later:
 *
 *   experiment  status: 'skipped'. Not 'completed', which would be a lie, and
 *               not a new enum value. The reason goes on `status_history`,
 *               which is the one field in this app already shaped for exactly
 *               this (`from_status`, `to_status`, `changed_at`, `reason`).
 *               'skipped' also takes the row out of student-pulse's stall
 *               detectors, so we stop asking, which is the point.
 *   mission     status: 'skipped'. Same list, same reasoning, and Missions has
 *               no status history, so the reason goes on `notes`.
 *   outreach    response_status: 'closed'. This one is genuinely honest: the
 *               enum was written with a deliberate ending in it.
 *   path        status: 'deprioritized', and no longer the primary focus.
 *               Also honest. A student saying "not this one" is deprioritising
 *               it, and 'archived' would read as filing rather than deciding.
 *   account     nothing is patched. Ruling out at the account level is the
 *               "tell us to stop" rung, and what it produces is an opt out.
 *
 * If somebody later adds a `ruled_out` value to any of these lists, this is the
 * table to change, and the reason line becomes redundant rather than wrong.
 */
const RULE_OUT = {
  experiment: { entity: 'Experiments', field: 'status', value: 'skipped', reasonField: 'status_history' },
  mission: { entity: 'Missions', field: 'status', value: 'skipped', reasonField: 'notes' },
  outreach: { entity: 'OutreachContacts', field: 'response_status', value: 'closed', reasonField: 'notes' },
  path: { entity: 'PathRecommendations', field: 'status', value: 'deprioritized', reasonField: 'notes' },
};

/** The line the student's words are filed under on a row that has only notes. */
const NOTE_PREFIX = 'Closed out by the student';

/** Appends to a free text field without ever losing what was already there. */
function appendNote(existing, reason) {
  const line = reason ? `${NOTE_PREFIX}: ${reason}` : `${NOTE_PREFIX}.`;
  const before = str(existing);
  return before ? `${before}\n\n${line}` : line;
}

/**
 * The patch that records a rule out against the real row, or null.
 *
 * `subject` is the current row, when the caller has it. Without it the status
 * still changes and the reason is dropped rather than guessed at, because both
 * fields it could land in are free text a student or a model already wrote in,
 * and overwriting one of those blind is worse than losing a sentence we also
 * keep on the nudge row.
 */
function ruleOutFor({ subjectType, subjectId, reason, nowISO, subject }) {
  const spec = RULE_OUT[subjectType];
  const id = str(subjectId);
  if (!spec || !id) return null;

  const patch = { [spec.field]: spec.value };
  if (subjectType === 'path') patch.is_primary_focus = false;

  const row = subject && typeof subject === 'object' ? subject : null;
  if (row) {
    if (spec.reasonField === 'status_history') {
      const history = Array.isArray(row.status_history) ? row.status_history : [];
      patch.status_history = [...history, {
        from_status: str(row.status) || 'unknown',
        to_status: spec.value,
        changed_at: nowISO,
        reason: reason || 'Ruled out by the student.',
      }];
    } else {
      patch[spec.reasonField] = appendNote(row[spec.reasonField], reason);
    }
  }

  return { entity: spec.entity, id, patch };
}

/**
 * A fresh opt out row.
 *
 * @param {{userId: string, source?: string, reason?: string, now?: any}} input
 */
export function buildOptOut({ userId, source, reason, now } = {}) {
  const sources = ['settings', 'answer_page', 'email_link', 'admin'];
  const when = toISO(now);
  return {
    user_id: str(userId),
    opted_out_at: when,
    reason: boundedText(reason, 500),
    source: sources.includes(str(source)) ? str(source) : 'settings',
    deletion_status: 'active',
  };
}

/**
 * The patch that turns the emails back on: a soft delete, like everything else
 * in this repo. The row stays, so "off in March, on in April" is still there.
 */
export function optBackInPatch(now) {
  const ms = Date.parse(toISO(now));
  const purge = Number.isFinite(ms) ? new Date(ms + OPT_OUT_PURGE_DAYS * DAY) : new Date();
  return {
    deletion_status: 'deleted',
    deleted_at: toISO(now),
    purge_at: purge.toISOString(),
  };
}

/**
 * Is this student opted out of the nudge emails.
 *
 * Soft deleted rows do not count: deleting the row is how opting back in is
 * recorded.
 *
 * **`created_by_id` must equal `user_id`, with no exception.** RLS on this
 * entity satisfies `create` with `created_by_id == {{user.id}}`, which the
 * server fills in for whoever is signed in, so any student can create a row
 * naming any other student's `user_id` and silence our emails to them. Victim
 * ids are not secret: NetworkProfile, Follow and User all read openly.
 *
 * An earlier version of this check let a row through when `created_by_id` and
 * `user_id` disagreed as long as the row said `source: 'admin'`, and let a row
 * with no `created_by_id` at all through by short circuiting on the empty
 * string. Both are fields on a row a student writes, so both were the attack
 * rather than the defence. There is no admin exemption here now: if one is ever
 * genuinely needed, resolve `created_by_id` against the loaded `User` rows and
 * require `role === 'admin'` there. Never trust `source`.
 *
 * @param {object[]} optOutRows NudgeOptOut rows, any shape
 * @param {string} userId
 * @returns {boolean}
 */
export function isOptedOut(optOutRows, userId) {
  const uid = str(userId);
  if (!uid || !Array.isArray(optOutRows)) return false;
  return optOutRows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    if (isDeleted(row)) return false;
    if (str(row.user_id) !== uid) return false;
    // A missing creator is a row we cannot attribute, which is not the same as
    // a row the student wrote. It does not count.
    return str(row.created_by_id) === uid;
  });
}

/** An ISO string from whatever the caller had, falling back to right now. */
function toISO(now) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now.toISOString();
  if (typeof now === 'number' && Number.isFinite(now)) return new Date(now).toISOString();
  const text = str(now);
  if (text) {
    const ms = Date.parse(text.length === 10 ? `${text}T12:00:00Z` : text);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Everything one answer should write, as data, with nothing written.
 *
 * @param {{nudge: object, choice: string, replyText?: string,
 *   declineReason?: string, now?: any, subject?: object}} input
 *   `subject` is the row the ask is about, when the caller has already loaded
 *   it. It is only ever read, never trusted for copy.
 * @returns {{nudgeUpdate: object|null, ruleOut: object|null,
 *   optOut: object|null, proof: null, errors: string[]}}
 */
export function planResponse(input = {}) {
  const {
    nudge, choice, replyText, declineReason, now, subject,
  } = input || {};

  const errors = [];
  const empty = () => ({
    nudgeUpdate: null, ruleOut: null, optOut: null, proof: null, errors,
  });

  const row = nudge && typeof nudge === 'object' ? nudge : null;
  if (!row) {
    errors.push('There is no ask here to answer.');
    return empty();
  }
  if (!CHOICES.includes(choice)) {
    errors.push('That is not something you can do with this ask.');
    return empty();
  }
  if (isDeleted(row)) {
    errors.push('This ask has been removed.');
    return empty();
  }
  if (str(row.status) && str(row.status) !== 'pending') {
    errors.push('This one has already been answered.');
    return empty();
  }

  const nowISO = toISO(now);
  const ask = describeAsk(row);
  const reply = boundedText(replyText, MAX_REPLY_CHARS);
  const reason = boundedText(declineReason, MAX_REPLY_CHARS);
  const isRuleOut = ask.action_kind === 'rule_out';
  // `closes` is the narrower of the two and is what every write below keys on.
  // It is false for an ask whose rung we could not resolve, which is the case
  // where `action_kind` and `subject_id` are strings a student may have typed,
  // and false for a rule out with nothing on the other end of it.
  const willClose = ask.closes === true;

  // Only ever the response fields. Never `user_id`, never the copy, never
  // `evidence_seen_at`: that one is the pulse's word that the student really
  // did the thing, and it is the field the ladder reads as success.
  const nudgeUpdate = { status: '', responded_at: nowISO, decline_reason: '', reply_text: '' };

  if (choice === 'declined') {
    // No reason required, ever. Forcing one is a dark pattern and what it
    // actually produces is a row whose decline_reason is a full stop.
    nudgeUpdate.status = 'declined';
    nudgeUpdate.decline_reason = reason;
    return {
      nudgeUpdate, ruleOut: null, optOut: null, proof: null, errors,
    };
  }

  if (choice === 'answered') {
    if (!reply) {
      errors.push('Write a sentence first, then send it.');
      return empty();
    }
    // Answering is doing the thing that was asked, so it closes the ask rather
    // than merely acknowledging it. `completed` is what makes the next pass
    // start this stall kind again at the top of the ladder if it comes back.
    nudgeUpdate.status = 'completed';
    nudgeUpdate.reply_text = reply;
    return {
      nudgeUpdate,
      // A rule out rung answered in words is still a rule out. The sentence is
      // the reason, and it is the most valuable thing on the page.
      ruleOut: willClose
        ? ruleOutFor({
          subjectType: ask.subjectType, subjectId: ask.subjectId, reason: reply, nowISO, subject,
        })
        : null,
      optOut: willClose && ask.subjectType === 'account'
        ? buildOptOut({
          userId: row.user_id, source: 'answer_page', reason: reply, now: nowISO,
        })
        : null,
      // Deliberately null. See rule 2 at the top of this file. When a rung is
      // written that genuinely produces evidence, it sets `yieldsProof` and
      // this is where the ProofOfWork row gets built, and the allowed field
      // list above grows `reply_became_proof_id` on purpose rather than by
      // accident.
      proof: null,
      errors,
    };
  }

  // Accepted. On an action rung that means "yes, I will", and the page sends
  // them to the thing. On a rule out rung it means "yes, close it", which is
  // the student finishing the ask rather than promising to.
  nudgeUpdate.status = isRuleOut ? 'completed' : 'accepted';
  nudgeUpdate.reply_text = reply;
  return {
    nudgeUpdate,
    ruleOut: willClose
      ? ruleOutFor({
        subjectType: ask.subjectType, subjectId: ask.subjectId, reason: reply, nowISO, subject,
      })
      : null,
    optOut: willClose && ask.subjectType === 'account'
      ? buildOptOut({
        userId: row.user_id, source: 'answer_page', reason: reply, now: nowISO,
      })
      : null,
    proof: null,
    errors,
  };
}
