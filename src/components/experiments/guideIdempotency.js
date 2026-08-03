/**
 * Idempotency for Mission Guide writes.
 *
 * `MissionGuides.create()` can succeed on the server while the response never
 * reaches the browser — a dropped connection, a proxy timeout, a tab that goes
 * to sleep mid-request. The student sees a failure, retries, and a second row
 * lands at the same version_number. There is no transaction and no unique
 * constraint to lean on, so identity has to travel with the write: one key per
 * intended row, minted when that row's content is produced, reused by every
 * retry of the same save and by nothing else.
 *
 * Where the key's lifetime begins and ends is the whole mechanism:
 *   - begins the moment a guide's content exists (the generator's pending
 *     guide, the history screen's first Duplicate click on a given guide)
 *   - ends the moment a row for it exists — created here, or found here and
 *     adopted
 * A key that started earlier would block a legitimate second save; a key minted
 * per attempt would be no key at all.
 */

/**
 * A v4 UUID. `crypto.randomUUID` covers every browser the app supports (over
 * https, and over http on localhost) and Node 19+, so no dependency is needed;
 * the two fallbacks only exist so a stray non-secure context degrades instead
 * of breaking the save outright.
 */
export function newIdempotencyKey() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return `k-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

/**
 * The row previously written under `key`, or null.
 *
 * Read-only, so it never disturbs the write ordering of whatever calls it.
 */
export async function findByIdempotencyKey(entity, key) {
  // An empty key must never reach the backend as a filter clause: every guide
  // written before this field existed has no key, and `{ idempotency_key: '' }`
  // is exactly the query that could match one of them.
  if (!key) return null;
  const rows = await entity.filter({ idempotency_key: key }, '-created_date', 2);
  // Re-check the match in JS rather than trusting the clause to have been
  // honoured. A backend that quietly drops a filter on a field it does not yet
  // know would otherwise hand back an unrelated guide for us to adopt.
  return (Array.isArray(rows) ? rows : []).find(r => r?.idempotency_key === key) || null;
}

/**
 * Create a guide row at most once for `key`.
 *
 * Returns `{ row, adopted }` — `adopted: true` means a row for this key already
 * existed and no second row was written.
 *
 * `reconcile` is an optional set of fields to force onto an adopted row when
 * they differ from what the caller is now asking for. The retry after a lost
 * response is allowed to pick a different option than the attempt that
 * disappeared ("make this active" the first time, "save as draft" the second),
 * and the newer choice should win with an update rather than a new row.
 *
 * The residual race is real and not closed here: the lookup and the create are
 * two round trips, so two saves that both miss the lookup before either create
 * lands still produce two rows. That window is milliseconds wide and needs both
 * attempts in flight at once; the lost-response retry this exists for is
 * seconds-to-minutes wide and is fully covered.
 */
export async function createGuideOnce(entity, key, payload, { reconcile } = {}) {
  const existing = await findByIdempotencyKey(entity, key);

  if (!existing) {
    // Key last, deliberately: the history screen's Duplicate spreads a source
    // guide that already carries its own key, and copying that key would make
    // every copy adopt the original.
    const row = await entity.create(key ? { ...payload, idempotency_key: key } : { ...payload });
    return { row, adopted: false };
  }

  const drift = Object.entries(reconcile || {}).filter(([field, want]) => existing[field] !== want);
  if (!drift.length) return { row: existing, adopted: true };

  const patch = Object.fromEntries(drift);
  try {
    const updated = await entity.update(existing.id, patch);
    return { row: { ...existing, ...patch, ...(updated || {}) }, adopted: true };
  } catch (err) {
    // A failed reconcile is not a failed save. The row the student asked for
    // exists, and reporting failure here would invite the retry this whole
    // mechanism exists to make unnecessary.
    console.error('[MissionGuide] adopted an existing row but could not reconcile it:', err);
    return { row: existing, adopted: true, reconcileFailed: true };
  }
}
