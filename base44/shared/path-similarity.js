/**
 * Near-duplicate detection for career path names.
 *
 * The exact-title rule this replaces missed the case that actually happens:
 * "Healthcare-focused boutique investment banking" and "Healthcare boutique
 * investment banking" are one hypothesis stored twice, but they do not
 * normalise to the same string. So a title is reduced to the words that carry
 * meaning before it is compared:
 *
 *   1. punctuation and case go
 *   2. abbreviations and short forms expand to their full term (ib →
 *      investment banking, pm → product management, vc → venture capital)
 *   3. filler and qualifier words go (focused, based, oriented, general, path,
 *      career, role, industry, the, of, in …), because they describe how a
 *      student phrased the path rather than which career it is
 *   4. plurals are folded, the remaining words are deduplicated and sorted
 *
 * What is left is the canonical key. Two rows with the same key are the same
 * career. Rows that are close but not identical are scored with the Dice
 * coefficient over their word sets, which is deliberately conservative: a high
 * score merges, a middling score goes to human review, and anything lower is
 * left alone. Two genuinely different careers ("Consulting" and "Educational
 * Consulting") share one word out of two or three and never reach the merge
 * threshold.
 */

/** Same as the exact normaliser: lowercase, letters and digits only. */
export const normalizeTitle = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Words that describe phrasing rather than the career itself. */
const FILLER = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'for', 'with', 'to', 'my', 'as',
  'path', 'paths', 'career', 'careers', 'role', 'roles', 'job', 'jobs', 'position',
  'work', 'working', 'industry', 'sector', 'field', 'space', 'world', 'track', 'area',
  'focused', 'focus', 'focussed', 'oriented', 'orientated', 'centered', 'centred',
  'based', 'related', 'adjacent', 'style', 'type', 'kind', 'side', 'driven', 'heavy',
  'general', 'generalist', 'specific', 'specialist', 'specialised', 'specialized',
  'traditional', 'classic', 'modern', 'entry', 'level', 'junior', 'graduate',
]);

/** Short forms and near-synonyms, expanded before comparison. */
const SYNONYMS = new Map(Object.entries({
  ib: 'investment banking',
  ibd: 'investment banking',
  pe: 'private equity',
  vc: 'venture capital',
  pm: 'product management',
  fpa: 'financial planning analysis',
  ma: 'mergers acquisitions',
  crm: 'customer relationship management',
  cre: 'commercial real estate',
  pr: 'public relations',
  swe: 'software engineering',
  sde: 'software engineering',
  dev: 'software engineering',
  developer: 'software engineering',
  engineer: 'engineering',
  mgmt: 'management',
  mgr: 'management',
  admin: 'administration',
  ops: 'operations',
  biz: 'business',
  bd: 'business development',
  hc: 'healthcare',
  health: 'healthcare',
  medical: 'medicine',
  med: 'medicine',
  physician: 'medicine',
  doctor: 'medicine',
  nurse: 'nursing',
  attorney: 'law',
  lawyer: 'law',
  legal: 'law',
  marketer: 'marketing',
  comms: 'communications',
  nonprofit: 'non profit',
  edtech: 'education technology',
  ai: 'artificial intelligence',
  ml: 'machine learning',
  saas: 'software',
  tech: 'technology',
  consultant: 'consulting',
  consultancy: 'consulting',
  banker: 'banking',
  bank: 'banking',
  founder: 'entrepreneurship',
  startup: 'entrepreneurship',
  startups: 'entrepreneurship',
  entrepreneur: 'entrepreneurship',
  research: 'research',
  researcher: 'research',
  teacher: 'teaching',
  educator: 'teaching',
  education: 'teaching',
}));

const singular = (w) => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};

/** The meaning-carrying words of a title, expanded, filtered and folded. */
export function titleTokens(title) {
  const words = normalizeTitle(title).split(' ').filter(Boolean);
  const expanded = [];
  for (const word of words) {
    const syn = SYNONYMS.get(word);
    if (syn) expanded.push(...syn.split(' '));
    else expanded.push(word);
  }
  return [...new Set(expanded.map(singular).filter(w => w && !FILLER.has(w)))].sort();
}

/** The canonical key. Identical keys mean the same career. */
export function canonicalTitle(title) {
  const tokens = titleTokens(title);
  return tokens.length ? tokens.join(' ') : normalizeTitle(title);
}

/** Dice coefficient over the two word sets: 0 (nothing shared) to 1 (same). */
export function titleSimilarity(a, b) {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (!A.length || !B.length) return 0;
  const setB = new Set(B);
  const shared = A.filter(t => setB.has(t)).length;
  return (2 * shared) / (A.length + B.length);
}

/** At or above this, two titles are the same career. */
export const MERGE_THRESHOLD = 0.8;
/** At or above this but below the merge threshold, a person decides. */
export const REVIEW_THRESHOLD = 0.6;

/**
 * How two titles relate: 'same' (identical canonical key), 'duplicate' (close
 * enough to merge), 'review' (close, but a judgement call) or 'different'.
 */
export function compareTitles(a, b) {
  if (canonicalTitle(a) === canonicalTitle(b)) return { verdict: 'same', similarity: 1 };
  const similarity = titleSimilarity(a, b);
  if (similarity >= MERGE_THRESHOLD) return { verdict: 'duplicate', similarity };
  if (similarity >= REVIEW_THRESHOLD) return { verdict: 'review', similarity };
  return { verdict: 'different', similarity };
}