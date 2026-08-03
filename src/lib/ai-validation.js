/**
 * Shared coercions for anything that came back from a model.
 *
 * The app has twelve places that call `InvokeLLM`. Until now exactly two of
 * them checked what came back, and the rest wrote it to an entity or rendered
 * it directly. The failure that costs the most is not a wrong answer, it is a
 * wrong *type*: React throws when handed an object as a child, and there is one
 * error boundary in the whole app, so a single array of objects where the code
 * expected strings unmounts the page a student is looking at.
 *
 * These are deliberately small and total: every one of them accepts anything,
 * including null and undefined, and returns something safe to render. They
 * never throw. A call site that needs to REJECT rather than repair should test
 * the result (an empty list, an empty string) and decide for itself.
 *
 * `path-validation.js` is the worked example of the fuller pattern, where
 * structural problems fail and cosmetic ones are repaired.
 */

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Describe a value by shape only, never by content. Safe to log. */
export function describeShape(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'an array';
  const t = typeof value;
  // These strings end up inside a retry prompt, so "a object" reads as noise
  // in the one place the wording has to be an instruction.
  return `${'aeiou'.includes(t[0]) ? 'an' : 'a'} ${t}`;
}

/**
 * The keys a model reaches for when it returns an object where the schema said
 * string. Checked in this order, so `{ step: "Send the email", note: "..." }`
 * yields the step rather than the note.
 */
const TEXT_KEYS = ['step', 'text', 'title', 'name', 'label', 'description', 'value', 'content', 'question'];

/**
 * Coerce anything to a trimmed display string.
 *
 * An object is mined for a likely text key rather than being dropped: a model
 * that returns `{ step: "Email three alumni" }` instead of `"Email three
 * alumni"` still wrote the sentence, and throwing it away costs the student
 * real content. `[object Object]` and raw JSON are never returned, because both
 * are worse than nothing on a page.
 */
export function toText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (isPlainObject(value)) {
    for (const key of TEXT_KEYS) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
  }
  return '';
}

/** Coerce anything to an array of non-empty display strings. */
export function toTextList(value) {
  if (typeof value === 'string') {
    const single = value.trim();
    return single ? [single] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean);
}

/**
 * A finite number inside [min, max], or `fallback` when it is unusable.
 *
 * Numeric strings are accepted because models return them constantly. Out of
 * range values are NOT clamped: a step claiming 600 minutes and a step claiming
 * 60 are different mistakes, and quietly rewriting one as the other hides that
 * the model ignored the brief. The caller gets the fallback and can say so.
 */
export function toBoundedNumber(value, min, max, fallback = null) {
  const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
  if (!Number.isFinite(n)) return fallback;
  return n >= min && n <= max ? n : fallback;
}

/** One of `allowed`, matched case-insensitively, or `fallback`. */
export function toEnum(value, allowed, fallback = null) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(v) ? v : fallback;
}

/** The three level enums used across paths, risk and confidence. */
export const LEVELS = ['low', 'medium', 'high'];
