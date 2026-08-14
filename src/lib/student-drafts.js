/**
 * The private writing a student has not saved yet, held on their device.
 *
 * Two forms keep a local draft so a failed save or a closed tab never costs a
 * student their words: the weekly reflection, and the end-of-experiment
 * conclusion. Both hold the most private text in the product. Career doubts,
 * what they avoided, what they got wrong, whether a path is turning out worse
 * than they hoped.
 *
 * The weekly draft used to sit under one fixed key with no owner and no
 * expiry. On a shared machine (a library PC, a lab, a friend's laptop) that
 * meant the next person to sign in was offered "You started a reflection and
 * didn't save it. Pick it up", loaded with someone else's answers. The
 * conclusion draft was keyed per experiment, which made a collision unlikely,
 * but it too outlived the session that wrote it.
 *
 * Four rules, and every one of them is load bearing:
 *
 *   1. A draft is written under a key carrying the signed-in user's id, and
 *      the id is stored inside the record as well. The key alone is not
 *      trusted, so a stale or hand-edited key cannot hand a draft to the wrong
 *      person.
 *   2. No signed-in user, no draft. There is no shared fallback key to fall
 *      back to.
 *   3. Signing out deletes every draft on the machine, not only the one
 *      belonging to whoever is leaving. That is the shared-computer case and
 *      it is the whole point.
 *   4. A draft expires after seven days. A week is the unit this product works
 *      in: past that, a weekly draft describes a week that has already closed
 *      and been reflected on, and a conclusion draft describes an experiment
 *      the student has moved on from.
 *
 * Anything unreadable, unowned or expired is deleted on the way out rather
 * than returned, so a bad record cannot sit on the device indefinitely.
 */

// Both prefixes cover the older unscoped keys as well
// (`unscripted_reflection_draft_v1`, `unscripted_conclusion_draft_<id>`), so a
// sign-out clears what previous versions left behind.
const REFLECTION_PREFIX = 'unscripted_reflection_draft_';
const CONCLUSION_PREFIX = 'unscripted_conclusion_draft_';
const DRAFT_PREFIXES = [REFLECTION_PREFIX, CONCLUSION_PREFIX];

/** Seven days. See rule 4 above. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ids go into a storage key, so anything that is not a plain identifier is
 * stripped. Without this a value containing the separator could be arranged to
 * build another user's key.
 */
function safeId(value) {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '');
}

function drop(key) {
  try { localStorage.removeItem(key); } catch { /* private mode, nothing to do */ }
}

/** '' when there is no signed-in user, which every writer treats as "do not store". */
export function reflectionDraftKey(userId) {
  const owner = safeId(userId);
  return owner ? `${REFLECTION_PREFIX}v2_${owner}` : '';
}

export function conclusionDraftKey(userId, experimentId) {
  const owner = safeId(userId);
  const experiment = safeId(experimentId);
  return owner && experiment ? `${CONCLUSION_PREFIX}v2_${owner}_${experiment}` : '';
}

function readEnvelope(key, userId, now) {
  if (!key) return null;
  let box;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    box = JSON.parse(raw);
  } catch {
    drop(key);
    return null;
  }

  if (!box || typeof box !== 'object' || !box.data || typeof box.data !== 'object') {
    drop(key);
    return null;
  }
  // The owner recorded inside the draft has to match the person asking for it.
  // This is the check that holds when a key does not.
  if (!box.owner || box.owner !== safeId(userId)) {
    drop(key);
    return null;
  }
  if (!Number.isFinite(box.at) || now - box.at > DRAFT_MAX_AGE_MS) {
    drop(key);
    return null;
  }
  return box.data;
}

function writeEnvelope(key, userId, data, now) {
  if (!key || !data || typeof data !== 'object') return false;
  try {
    localStorage.setItem(key, JSON.stringify({ v: 2, owner: safeId(userId), at: now, data }));
    return true;
  } catch {
    // A full or unavailable localStorage costs the student a safety net, not
    // their session. Nothing here is worth an error on screen.
    return false;
  }
}

// ── Weekly reflection ─────────────────────────────────────────────────────────

export function readReflectionDraft(userId, { now = Date.now() } = {}) {
  return readEnvelope(reflectionDraftKey(userId), userId, now);
}

export function writeReflectionDraft(userId, data, { now = Date.now() } = {}) {
  return writeEnvelope(reflectionDraftKey(userId), userId, data, now);
}

export function clearReflectionDraft(userId) {
  const key = reflectionDraftKey(userId);
  if (key) drop(key);
}

// ── Experiment conclusion ─────────────────────────────────────────────────────

export function readConclusionDraft(userId, experimentId, { now = Date.now() } = {}) {
  return readEnvelope(conclusionDraftKey(userId, experimentId), userId, now);
}

export function writeConclusionDraft(userId, experimentId, data, { now = Date.now() } = {}) {
  return writeEnvelope(conclusionDraftKey(userId, experimentId), userId, data, now);
}

export function clearConclusionDraft(userId, experimentId) {
  const key = conclusionDraftKey(userId, experimentId);
  if (key) drop(key);
}

// ── Sign-out ──────────────────────────────────────────────────────────────────

/**
 * Every unsaved draft on this machine, gone. Called on sign-out, where the
 * question is not "whose was this" but "is the next person at this keyboard
 * going to see it". Returns how many keys were removed, which is what the
 * tests assert on.
 */
export function clearStudentDrafts() {
  let removed = 0;
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && DRAFT_PREFIXES.some(prefix => key.startsWith(prefix))) doomed.push(key);
    }
    doomed.forEach(key => { drop(key); removed += 1; });
  } catch {
    // No usable localStorage means there was nothing stored to begin with.
  }
  return removed;
}
