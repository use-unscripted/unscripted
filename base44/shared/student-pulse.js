/**
 * Student pulse: one evidence-based read of where a student actually is.
 *
 * The rule that defines this file: **do not believe the status field.**
 * `status: 'in_progress'` on an experiment means somebody clicked a button once.
 * `updated_date` means a row got touched, and the 2026-08-01 backfill touched
 * every mission in the database inside one second. Neither is proof a student
 * did anything.
 *
 * Evidence is a record that could only exist because a student did real work:
 * a ProofOfWork row, a mission actually marked completed, a contact actually
 * written to, a reflection actually filled in, a guide they at least asked for,
 * and the PilotEvent ledger, which is a real activity log and is read here
 * rather than rebuilt.
 *
 * The output keeps `claimed` (what the status fields assert) and `evidence`
 * (what happened) in separate buckets on purpose, with `gap` between them. That
 * gap is the product's whole problem in one object: 265 experiments, 14 guides,
 * 1 proof row.
 *
 * Pure and dependency free. No SDK import, no network, no clock. `now` is a
 * parameter so a caller can ask "where was this student last Tuesday", and so
 * this can be unit tested and later run unchanged inside a Deno backend
 * function. Nothing in here throws: every row in this database was written by a
 * model at some point and is capable of being any shape.
 */
// Relative and extension qualified so a Deno backend function can import this
// file as it stands, without the `@/` alias the Vite build supplies.
import { entityDate, entityTime } from './dates.js';

const DAY = 86400000;

/** Soft-deleted rows are the easiest way to overcount evidence. */
const isLive = (r) => !!r && typeof r === 'object'
  && (!r.deletion_status || r.deletion_status === 'active');

/** Guides carry the deletion twice: `deletion_status` and their own status enum. */
const isLiveGuide = (g) => isLive(g) && g.status !== 'deleted';

/**
 * Paths (PathRecommendations rows) have no deletion_status, only a status enum.
 *
 * Two of its values mean the path is behind the student rather than in front of
 * them, and both have to be out of this list or the nudges get worse the moment
 * somebody makes a decision. `archived` is filing. `deprioritized` is the
 * student saying "not this one", which is the answer this whole product is
 * built to collect, and it is what a rule out writes.
 *
 * Leaving `deprioritized` in here is not a small miss. A one path account that
 * rules its path out keeps a live path with nothing focused, so `chosenPath`
 * goes undefined and `no_path_selected` fires at severity 97 where
 * `path_without_experiment` had been sitting at 88. The student says "yes,
 * close this out" and the next email is more insistent than the last one and
 * tells them to pick from a set of one they have just rejected.
 *
 * `src/pages/ExperimentsPage.jsx` and `path-sort-filter.js` already read these
 * two together. This file was the outlier.
 */
const PATH_DECIDED_STATUSES = ['archived', 'deprioritized'];
const isLivePath = (p) => isLive(p) && !PATH_DECIDED_STATUSES.includes(p.status);

const rows = (v) => (Array.isArray(v) ? v.filter((r) => !!r && typeof r === 'object') : []);

const num = (n) => (Number.isFinite(n) ? n : 0);

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/** A contact in one of these has not been written to yet, whatever else the row says. */
const UNSENT_STATUSES = ['not_sent', 'planning'];
/** Somebody wrote back. */
const REPLIED_STATUSES = ['responded', 'call_scheduled', 'completed'];
/**
 * Written to, still nothing back. `no_response` and `follow_up_needed` are the
 * two the student sets by hand once they notice the silence, so they are the
 * clearest possible signal that a nudge is wanted, not a reason to skip one.
 */
const AWAITING_REPLY_STATUSES = ['sent', 'no_response', 'follow_up_needed'];
/**
 * The student closed this contact out on purpose. It is neither a gap nor
 * evidence, and it is what a rule out on an outreach ask writes.
 *
 * It has to be named separately from UNSENT_STATUSES, which mean "not written
 * to yet". A contact closed cold was never written to, so counting it in
 * `outreachSent` would report a student as having written to somebody they
 * explicitly told us they would not write to, and `outreachSent` is part of the
 * evidence total this whole file exists to keep honest. `sent` checks
 * `date_contacted` first, so a contact who really was written to and then
 * closed still counts.
 */
const SETTLED_STATUSES = ['closed'];

/**
 * Whole days between two instants, clamped at 0. A future created_date is a
 * real thing here (clock skew, and a model writing a date it invented), and a
 * negative day count reads as nonsense in every downstream sentence.
 */
function daysBetween(fromValue, nowMs) {
  const t = entityTime(fromValue);
  if (!Number.isFinite(t) || !Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - t) / DAY));
}

/** Local calendar day of a timestamp, 'YYYY-MM-DD', or ''. */
function dayKey(value) {
  const d = entityDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** An ISO string for a value that may be a date-only day or a zoneless stamp. */
function iso(value) {
  const d = entityDate(value);
  return d ? d.toISOString() : null;
}

/**
 * The moment a mission was finished. `completed_at` is written once, at the
 * moment of completion, and never moves, so it is the only field here that can
 * date a mission. There is deliberately no fallback: `created_date` is when the
 * row appeared, `updated_date` is when anything touched it, and the 2026-08-01
 * backfill flipped every mission in the database to a new status inside one
 * second. A mission that says completed and carries no completed_at is a claim,
 * not evidence, so it counts in `claimed` and in `gap` and nowhere else.
 */
const missionDoneAt = (m) => m.completed_at;

/** Completed, and able to say when. Both halves are required. */
const missionCompleted = (m) => m.status === 'completed'
  && Number.isFinite(entityTime(missionDoneAt(m)));

const proofDoneAt = (p) => p.completed_at || p.created_date;
const contactDoneAt = (c) => c.last_contacted_date || c.date_contacted || c.created_date;
const eventAt = (e) => e.occurred_at || e.created_date;

/** When an experiment actually went in_progress, from its own status history. */
function inProgressSince(exp) {
  const history = Array.isArray(exp.status_history) ? exp.status_history : [];
  let best = null;
  for (const h of history) {
    if (!h || typeof h !== 'object' || h.to_status !== 'in_progress') continue;
    const t = entityTime(h.changed_at);
    if (!Number.isFinite(t)) continue;
    if (best === null || t > best) best = t;
  }
  if (best !== null) return new Date(best).toISOString();
  return exp.resumed_at || exp.created_date || null;
}

const settled = (c) => SETTLED_STATUSES.includes(c.response_status);

const sent = (c) => !!text(c.date_contacted)
  || (!!text(c.response_status)
    && !UNSENT_STATUSES.includes(c.response_status)
    && !settled(c));

const replied = (c) => REPLIED_STATUSES.includes(c.response_status);

/**
 * The experiments belonging to one PathRecommendations row.
 *
 * The join is by row id, and only by row id. `Experiments.path_id` and
 * `Experiments.path_recommendation_id` are both written with the
 * PathRecommendations row's `id` (path-selection.js writes the first,
 * path-generator.js writes the second). `PathRecommendations.path_id` is a
 * different thing entirely: a slug the model invented inside the generation
 * payload. Comparing an experiment's `path_id` against a recommendation's
 * `path_id` matches nothing, ever, which reads as "you picked a path and never
 * set anything up" for a student who did both.
 *
 * The name match is kept only for rows old enough to carry neither id. A row
 * that has an id belongs to whatever that id says, even when the names differ:
 * the generator tags experiments with the recommendation's generated name while
 * intake wrote a generic bucket like "Marketing / brand", so a mismatch there is
 * expected and is not evidence of anything.
 */
function experimentsUnderPath(exps, rec) {
  const recId = text(rec.id);
  const name = text(rec.path_name);
  return exps.filter((e) => {
    if (recId && (e.path_id === recId || e.path_recommendation_id === recId)) return true;
    if (name && !text(e.path_id) && !text(e.path_recommendation_id) && e.path_name === name) return true;
    return false;
  });
}

/**
 * Reads one student's whole history and says where they are.
 *
 * Every array is optional. A missing user is tolerated: the signed-out draft
 * flow can produce paths and an experiment with no account behind them yet.
 *
 * @param {{
 *   now: Date|string|number,
 *   user?: object|null, profile?: object|null,
 *   paths?: object[], experiments?: object[], missions?: object[], guides?: object[],
 *   proof?: object[], reflections?: object[], outreach?: object[], events?: object[],
 * }} input
 * @returns {object} Pulse
 */
export function readPulse(input = {}) {
  const {
    now, user = null, profile = null,
    paths, experiments, missions, guides, proof, reflections, outreach, events,
  } = input || {};

  const nowMs = entityTime(now);
  const hasNow = Number.isFinite(nowMs);

  const livePaths = rows(paths).filter(isLivePath);
  const liveExps = rows(experiments).filter(isLive);
  const liveMissions = rows(missions).filter(isLive);
  const liveGuides = rows(guides).filter(isLiveGuide);
  const liveProof = rows(proof).filter(isLive);
  const liveRefl = rows(reflections).filter(isLive);
  const liveOutreach = rows(outreach).filter(isLive);
  // PilotEvent has no deletion_status. Nothing ever deletes one.
  const liveEvents = rows(events);

  const doneMissions = liveMissions.filter(missionCompleted);
  const sentOutreach = liveOutreach.filter(sent);
  const repliedOutreach = liveOutreach.filter(replied);

  const evidence = {
    proof: liveProof.length,
    missionsCompleted: doneMissions.length,
    outreachSent: sentOutreach.length,
    outreachResponded: repliedOutreach.length,
    reflections: liveRefl.length,
    guides: liveGuides.length,
  };

  const claimed = {
    paths: livePaths.length,
    experiments: liveExps.length,
    experimentsInProgress: liveExps.filter((e) => e.status === 'in_progress').length,
    experimentsCompleted: liveExps.filter((e) => e.status === 'completed').length,
    missionsPlanned: liveMissions.filter((m) => m.status === 'planned').length,
  };

  const guidesFor = (expId) => liveGuides.filter((g) => expId && g.experiment_id === expId);
  const proofFor = (expId) => liveProof.filter((p) => expId && p.experiment_id === expId);
  const doneMissionsFor = (expId) => doneMissions.filter((m) => expId && m.experiment_id === expId);

  const gap = {
    experimentsWithoutGuide: liveExps.filter((e) => guidesFor(e.id).length === 0).length,
    experimentsWithoutProof: liveExps.filter((e) => proofFor(e.id).length === 0).length,
    // Skipped is a decision, not a gap. A student who looked at a mission and
    // dropped it on purpose has done the thing this product is for, so counting
    // it here would inflate the one number the whole file exists to report.
    missionsNeverCompleted: liveMissions.filter(
      (m) => m.status !== 'skipped' && !missionCompleted(m),
    ).length,
  };

  // Every timestamp that counts as a student having done something.
  const marks = [];
  const mark = (kind, value) => {
    const t = entityTime(value);
    if (Number.isFinite(t)) marks.push({ kind, t });
  };
  liveProof.forEach((p) => mark('proof', proofDoneAt(p)));
  doneMissions.forEach((m) => mark('mission', missionDoneAt(m)));
  sentOutreach.forEach((c) => mark('outreach', contactDoneAt(c)));
  liveRefl.forEach((r) => mark('reflection', r.created_date));
  liveGuides.forEach((g) => mark('guide', g.created_date));
  liveEvents.forEach((e) => mark('event', eventAt(e)));

  // Oldest first, and on an exact tie the weakest kind first, so the last entry
  // is the newest and strongest thing the student did. Ties are common: a guide
  // and the PilotEvent that records asking for it are written in the same
  // millisecond, and "asking for steps" is a worse answer to "what did they last
  // do" than anything else standing beside it.
  marks.sort((a, b) => (a.t - b.t) || (KIND_RANK[a.kind] - KIND_RANK[b.kind]));
  const latest = marks.length ? marks[marks.length - 1] : null;

  const lastEvidenceAt = latest ? new Date(latest.t).toISOString() : null;
  const lastEvidenceKind = latest ? latest.kind : null;
  const daysSinceEvidence = latest ? daysBetween(lastEvidenceAt, nowMs) : null;
  const daysSinceSignup = daysBetween(user?.created_date, nowMs);

  // Never came back: every mark, if there are any, lands on the calendar day
  // they signed up. With no signup day there is nothing to compare against, so
  // this stays false rather than asserting something unsupported.
  const signupDay = dayKey(user?.created_date);
  const neverReturned = signupDay
    ? marks.every((m) => dayKey(new Date(m.t)) <= signupDay)
    : false;

  const chosenPath = livePaths.find((p) => p.is_primary_focus)
    || livePaths.find((p) => p.status === 'active')
    || null;

  // Paths the student decided against on purpose, which is the one thing this
  // product exists to collect and the one state nothing downstream could see.
  // Kept separate from `livePaths`, which has them filtered out by design.
  const ruledOutPaths = rows(paths).filter((p) => p.status === 'deprioritized');

  const stalls = findStalls({
    nowMs, hasNow, user, chosenPath, livePaths, ruledOutPaths, liveExps, liveMissions, liveGuides,
    liveProof, liveRefl, liveOutreach, guidesFor, proofFor, doneMissionsFor,
    lastEvidenceAt, daysSinceEvidence, daysSinceSignup,
  });

  const state = resolveState({
    profile, livePaths, liveExps, chosenPath, evidence, marks,
    liveRefl, liveEvents, daysSinceEvidence, daysSinceSignup, stalls,
  });

  return {
    state,
    daysSinceSignup,
    lastEvidenceAt,
    daysSinceEvidence,
    lastEvidenceKind,
    neverReturned,
    evidence,
    claimed,
    gap,
    stalls,
    topStall: stalls[0] || null,
  };
}

// How much a piece of evidence is worth when two of them land on the same
// instant. Proof beats a finished mission beats a contact, and a PilotEvent row
// is the weakest thing here because clicking is not doing.
const KIND_RANK = { proof: 6, mission: 5, outreach: 4, reflection: 3, guide: 2, event: 1 };

// Base severities, nine apart, in the order the kinds are listed in the design.
// A stall gains at most 8 points for sitting there, so age sharpens a stall but
// never lets it jump a tier.
const BASE_SEVERITY = {
  no_path_selected: 99,
  path_without_experiment: 90,
  experiment_without_guide: 81,
  guide_never_acted_on: 72,
  mission_planned_stale: 63,
  outreach_never_sent: 54,
  outreach_no_followup: 45,
  experiment_no_proof: 36,
  reflection_overdue: 27,
  // Second from bottom on purpose, above only "gone quiet".
  //
  // It reads like the most urgent thing here and it is not. It is what is left
  // when a student has closed everything down, so it has to sit under every
  // stall about work they still have open, and it has to sit under whatever it
  // replaces: ruling a path out is the student answering us, and answering us
  // may never produce a louder email than the one before it. Ranked above
  // no_path_selected, a one path account that closed its path out would get a
  // more insistent email for having done the decisive thing. There is a test on
  // exactly that.
  all_paths_ruled_out: 18,
  dormant_account: 9,
};

function severityFor(kind, days) {
  const base = BASE_SEVERITY[kind] || 1;
  const bump = Math.min(8, Math.floor(num(days) / 7));
  return Math.max(1, Math.min(100, base + bump));
}

const quote = (s) => `“${s}”`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function findStalls(ctx) {
  const {
    nowMs, hasNow, user, chosenPath, livePaths, ruledOutPaths, liveExps, liveMissions, liveGuides,
    liveRefl, liveOutreach, guidesFor, proofFor, doneMissionsFor,
    lastEvidenceAt, daysSinceEvidence, daysSinceSignup,
  } = ctx;

  const out = [];
  // Without a usable `now` nothing here can say how long anything has sat, and a
  // stall with no age is not a stall. Every detector below already checks this;
  // the two path ones used to slip through and fire anyway.
  if (!hasNow) return out;

  // `subjectName` is the raw thing the stall is about: an experiment title, a
  // contact's name, a path name, exactly as the student typed or the model
  // wrote it. It is carried separately from `label` because anything reading a
  // name back out of a written sentence gets it wrong the moment the title has
  // a quote in it, and these names end up in a student's inbox.
  const add = (kind, { subjectId = null, subjectName = '', subjectType, label, since, days }) => {
    const d = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    out.push({
      kind,
      severity: severityFor(kind, d),
      subjectId: subjectId || null,
      subjectName: text(subjectName),
      subjectType,
      label,
      sinceISO: iso(since),
      days: d,
    });
  };

  // Paths exist and none of them was picked.
  if (livePaths.length > 0 && !chosenPath) {
    let newest = null;
    for (const p of livePaths) {
      const t = entityTime(p.generated_at || p.created_date);
      if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
    }
    const since = newest === null ? null : new Date(newest).toISOString();
    add('no_path_selected', {
      subjectType: 'path',
      subjectName: '',
      label: 'You have paths to compare, and you have not picked one to test yet.',
      since,
      days: daysBetween(since, nowMs),
    });
  }

  // A path was picked and nothing was ever set up under it.
  if (chosenPath) {
    const name = text(chosenPath.path_name);
    const under = experimentsUnderPath(liveExps, chosenPath);
    if (under.length === 0) {
      const since = chosenPath.started_at || chosenPath.created_date || null;
      add('path_without_experiment', {
        subjectId: chosenPath.id,
        subjectName: name,
        subjectType: 'path',
        label: name
          ? `You picked ${name} and there is still no experiment under it.`
          : 'You picked a path and there is still no experiment under it.',
        since,
        days: daysBetween(since, nowMs),
      });
    }
  }

  // `draft` is the Experiments default, so a row that exists because somebody
  // started filling a form in is a draft. Nagging a student about steps for
  // something they have not finished creating is the wrong end of the problem.
  const IGNORED_EXP_STATUSES = ['completed', 'skipped', 'draft'];
  const openExps = liveExps.filter((e) => !IGNORED_EXP_STATUSES.includes(e.status));

  // Every path they were given is behind them, at least one because they said
  // so, and there is nothing else in front of them.
  //
  // Before this existed the account fell through to `dormant_account`, whose
  // first ask is "pick this back up, and if the plan you made no longer fits,
  // change it rather than starting over." There is no plan left to change. A
  // student who ruled out all three did the most decisive thing this product
  // asks for and got told off for going quiet, which is the worst email in the
  // set landing on the best behaviour in the set.
  //
  // Gated on having no open experiment as well, because a live experiment under
  // a path they have since dropped is still real work with a real next step,
  // and this stall outranks everything.
  const rulesOut = rows(ruledOutPaths);
  if (livePaths.length === 0 && rulesOut.length > 0 && openExps.length === 0) {
    let newest = null;
    for (const p of rulesOut) {
      const t = entityTime(p.generated_at || p.created_date);
      if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
    }
    const since = newest === null ? null : new Date(newest).toISOString();
    add('all_paths_ruled_out', {
      subjectId: user?.id || null,
      subjectName: '',
      subjectType: 'account',
      label: rulesOut.length === 1
        ? 'You ruled out the one path you had and there is nothing else open.'
        : `You ruled out all ${rulesOut.length} of your paths and there is nothing else open.`,
      since,
      days: daysBetween(since, nowMs),
    });
  }

  // An experiment nobody ever generated steps for. This is the 252-of-265 case.
  for (const e of openExps) {
    if (guidesFor(e.id).length > 0) continue;
    const days = daysBetween(e.created_date, nowMs);
    if (days === null || days <= 3) continue;
    const title = text(e.title);
    add('experiment_without_guide', {
      subjectId: e.id,
      subjectName: title,
      subjectType: 'experiment',
      label: title
        ? `${quote(title)} has no steps yet, so there is nothing to start on.`
        : 'One of your experiments has no steps yet, so there is nothing to start on.',
      since: e.created_date,
      days,
    });
  }

  // Steps exist and nothing came of them. One stall per experiment, not one per
  // guide: regenerating leaves four guide rows on one experiment, and the
  // student is stuck once, not four times. The oldest live guide wins, because
  // that is how long they have actually been sitting on this.
  const ignoredGuides = new Map();
  for (const g of liveGuides) {
    const expId = text(g.experiment_id);
    if (doneMissionsFor(expId).length > 0 || proofFor(expId).length > 0) continue;
    const days = daysBetween(g.created_date, nowMs);
    if (days === null || days <= 5) continue;
    // A guide with no experiment behind it belongs to nothing, so it cannot
    // share a bucket with another one.
    const key = expId || `orphan:${g.id}`;
    const held = ignoredGuides.get(key);
    if (!held || days > held.days) ignoredGuides.set(key, { g, expId, days });
  }
  for (const { g, expId, days } of ignoredGuides.values()) {
    const title = text(g.guide_title);
    add('guide_never_acted_on', {
      subjectId: expId || null,
      subjectName: title,
      subjectType: 'experiment',
      label: title
        ? `You asked for the steps to ${quote(title)} ${plural(days, 'day')} ago and have not run any of them.`
        : `You asked for steps ${plural(days, 'day')} ago and have not run any of them.`,
      since: g.created_date,
      days,
    });
  }

  // A mission that has been sitting on the list.
  for (const m of liveMissions) {
    if (m.status !== 'planned' || m.completed_at) continue;
    const days = daysBetween(m.created_date, nowMs);
    if (days === null || days <= 7) continue;
    const title = text(m.title);
    add('mission_planned_stale', {
      subjectId: m.id,
      subjectName: title,
      subjectType: 'mission',
      label: title
        ? `${quote(title)} has been on your list for ${plural(days, 'day')} and has not been started.`
        : `A mission has been on your list for ${plural(days, 'day')} and has not been started.`,
      since: m.created_date,
      days,
    });
  }

  for (const c of liveOutreach) {
    // The written name is what the label needs, the raw one is what the copy
    // needs. A contact row with no name at all is common, and "someone" reads
    // as a name once it is lifted back out of a sentence.
    const rawName = text(c.name);
    const name = rawName || 'someone';
    // Closed out on purpose. Asking again about somebody the student has
    // already decided against is the same mistake as nagging about a path they
    // ruled out, and it is the one this product cannot afford to make.
    if (settled(c)) continue;
    if (!sent(c)) {
      const days = daysBetween(c.created_date, nowMs);
      if (days === null || days <= 5) continue;
      add('outreach_never_sent', {
        subjectId: c.id,
        subjectName: rawName,
        subjectType: 'outreach',
        label: `You saved ${name} ${plural(days, 'day')} ago and never sent anything.`,
        since: c.created_date,
        days,
      });
      continue;
    }
    if (!AWAITING_REPLY_STATUSES.includes(c.response_status)) continue;
    const sinceContact = daysBetween(c.date_contacted || c.created_date, nowMs);
    const followupDue = Number.isFinite(entityTime(c.followup_date))
      && entityTime(c.followup_date) <= nowMs;
    if (!followupDue && (sinceContact === null || sinceContact <= 7)) continue;
    add('outreach_no_followup', {
      subjectId: c.id,
      subjectName: rawName,
      subjectType: 'outreach',
      label: `You wrote to ${name} and have not heard back. A short nudge is normal here.`,
      since: c.followup_date || c.date_contacted || c.created_date,
      days: sinceContact,
    });
  }

  // Marked in_progress, which costs one click, with nothing to show for it.
  for (const e of liveExps) {
    if (e.status !== 'in_progress' || proofFor(e.id).length > 0) continue;
    const since = inProgressSince(e);
    const days = daysBetween(since, nowMs);
    if (days === null || days <= 10) continue;
    const title = text(e.title);
    add('experiment_no_proof', {
      subjectId: e.id,
      subjectName: title,
      subjectType: 'experiment',
      label: title
        ? `${quote(title)} has been open for ${plural(days, 'day')} with nothing logged against it.`
        : `An experiment has been open for ${plural(days, 'day')} with nothing logged against it.`,
      since,
      days,
    });
  }

  // Running for a week or more with no write-up. One stall, not one per row.
  const runningLong = liveExps
    .filter((e) => e.status === 'in_progress')
    .map((e) => ({ e, days: daysBetween(inProgressSince(e), nowMs) }))
    .filter((x) => x.days !== null && x.days > 7)
    .sort((a, b) => b.days - a.days)[0];
  if (runningLong) {
    let newestRefl = null;
    for (const r of liveRefl) {
      const t = entityTime(r.created_date);
      if (Number.isFinite(t) && (newestRefl === null || t > newestRefl)) newestRefl = t;
    }
    const reflDays = newestRefl === null ? null : daysBetween(new Date(newestRefl).toISOString(), nowMs);
    if (reflDays === null || reflDays > 7) {
      const title = text(runningLong.e.title);
      add('reflection_overdue', {
        subjectId: runningLong.e.id,
        subjectName: title,
        subjectType: 'experiment',
        label: title
          ? `You have not written down what ${quote(title)} is teaching you.`
          : 'You have not written down what any of this is teaching you.',
        since: newestRefl === null ? inProgressSince(runningLong.e) : new Date(newestRefl).toISOString(),
        days: reflDays === null ? runningLong.days : reflDays,
      });
    }
  }

  // Gone quiet, or never made a sound in the first place.
  const neverAny = lastEvidenceAt === null;
  const quietTooLong = daysSinceEvidence !== null && daysSinceEvidence > 14;
  const silentSinceSignup = neverAny && daysSinceSignup !== null && daysSinceSignup > 3;
  if (quietTooLong || silentSinceSignup) {
    const days = quietTooLong ? daysSinceEvidence : daysSinceSignup;
    add('dormant_account', {
      subjectId: user?.id || null,
      subjectName: '',
      subjectType: 'account',
      label: neverAny
        ? `You signed up ${plural(num(days), 'day')} ago and nothing has happened since.`
        : `Nothing has happened here in ${plural(num(days), 'day')}.`,
      since: lastEvidenceAt || user?.created_date || null,
      days,
    });
  }

  out.sort((a, b) => (b.severity - a.severity) || (b.days - a.days) || a.kind.localeCompare(b.kind));
  return out;
}

function resolveState(ctx) {
  const {
    profile, livePaths, liveExps, chosenPath, evidence, marks,
    liveRefl, liveEvents, daysSinceEvidence, daysSinceSignup, stalls,
  } = ctx;

  // Reached the end of a cycle on purpose. This is the only good terminal state
  // and it is read from what the student wrote, not from a status field.
  const concluded = liveRefl.some((r) => r.is_experiment_conclusion === true)
    || liveEvents.some((e) => e.event_name === 'final_decision_submitted' || e.event_name === 'cycle_completed');
  if (concluded) return 'decided';

  const hasAnything = livePaths.length > 0 || liveExps.length > 0 || marks.length > 0 || !!profile;
  if (!hasAnything) return 'never_started';

  const neverAny = marks.length === 0;
  if ((daysSinceEvidence !== null && daysSinceEvidence > 14)
    || (neverAny && daysSinceSignup !== null && daysSinceSignup > 14)) {
    return 'dormant';
  }

  if (!chosenPath && liveExps.length === 0) return 'no_path';

  const realWork = evidence.proof + evidence.missionsCompleted + evidence.outreachSent + evidence.reflections;
  if (realWork > 0 && daysSinceEvidence !== null && daysSinceEvidence <= 7) return 'working';

  if (stalls.length > 0) return 'stalled';
  return 'planning';
}

const STATE_WORDS = {
  never_started: 'has not started anything',
  no_path: 'has not picked a path to test',
  planning: 'has things set up and nothing done yet',
  working: 'is doing the work',
  stalled: 'has stopped partway',
  dormant: 'has gone quiet',
  decided: 'finished a test and made a call',
};

const LAST_KIND_WORDS = {
  proof: 'logging proof',
  mission: 'finishing a mission',
  outreach: 'writing to someone',
  reflection: 'writing a reflection',
  guide: 'asking for steps',
  event: 'clicking around',
};

/** Joins a short list without a trailing serial comma. */
function joinList(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Three or four plain sentences an operator can read in a log, and the seed for
 * the prompt that writes the nudge.
 *
 * @param {object} pulse the object readPulse returned
 * @returns {string}
 */
export function summarizePulse(pulse) {
  if (!pulse || typeof pulse !== 'object') return 'There is nothing to read yet.';

  const state = STATE_WORDS[pulse.state] || 'is somewhere unclear';
  const ev = pulse.evidence || {};
  const claimed = pulse.claimed || {};
  const gap = pulse.gap || {};
  const out = [];

  // "Signed up 0 days ago" is the kind of sentence that tells a reader a machine
  // wrote it, and day 1 is exactly when these get read.
  const signup = pulse.daysSinceSignup;
  if (!Number.isFinite(signup)) out.push(`This student ${state}.`);
  else if (signup === 0) out.push(`Signed up today and ${state}.`);
  else if (signup === 1) out.push(`Signed up yesterday and ${state}.`);
  else out.push(`Signed up ${plural(signup, 'day')} ago and ${state}.`);

  const done = [];
  if (num(ev.proof)) done.push(plural(num(ev.proof), 'piece') + ' of proof');
  if (num(ev.missionsCompleted)) done.push(`${plural(num(ev.missionsCompleted), 'mission')} finished`);
  if (num(ev.outreachSent)) {
    const n = num(ev.outreachSent);
    done.push(`${n} ${n === 1 ? 'person' : 'people'} written to`);
  }
  if (num(ev.reflections)) done.push(`${plural(num(ev.reflections), 'reflection')} written`);
  if (done.length) {
    out.push(`Real work so far: ${joinList(done)}.`);
  } else if (pulse.neverReturned) {
    out.push('Nothing real has ever been logged, and everything on the account happened the day they signed up.');
  } else {
    out.push('Nothing real has ever been logged.');
  }

  if (num(claimed.experiments) > 0) {
    out.push(`On paper there ${num(claimed.experiments) === 1 ? 'is' : 'are'} `
      + `${plural(num(claimed.experiments), 'experiment')}, `
      + `${num(gap.experimentsWithoutProof)} of them with nothing to show.`);
  } else if (num(claimed.paths) > 0) {
    out.push(`${plural(num(claimed.paths), 'path')} to compare and no experiment started.`);
  }

  const top = pulse.topStall;
  if (top && top.label) {
    out.push(`Most stuck right now: ${top.label}`);
  } else if (pulse.lastEvidenceKind) {
    out.push(`Last sign of life was ${LAST_KIND_WORDS[pulse.lastEvidenceKind] || 'activity'}, `
      + `${plural(num(pulse.daysSinceEvidence), 'day')} ago.`);
  }

  return out.join(' ');
}
