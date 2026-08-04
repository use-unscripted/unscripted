/**
 * Turning the path a student typed into a fixed label, for the funnel event.
 *
 * The intake asks for the path in a plain text box on purpose. A grid of
 * fifteen options fills the screen, reads as a menu of the only acceptable
 * answers, and quietly tells a student that whatever they were actually
 * thinking of is wrong.
 *
 * The funnel event still has to report something, and the rule for this
 * instrumentation is that no free text a student typed ever leaves the browser.
 * So the only values this can ever return are a member of KNOWN_PATHS, 'other'
 * or 'none'. Nothing derived from the input, ever.
 *
 * KNOWN_PATHS is never shown to anyone. It exists only for this.
 */
export const KNOWN_PATHS = [
  'Investment banking / finance',
  'Management consulting',
  'Tech / software engineering',
  'Venture capital / private equity',
  'Startup operations or founding',
  'Medicine / healthcare',
  'Law',
  'Graduate school / academia',
  'Marketing / brand',
  'Personal brand / content',
  'Freelancing / consulting',
  'Real estate / investing',
  'Nonprofit / mission-driven work',
  'Creative industries (film, design, music)',
  'Government / policy',
];

/**
 * Shorter than this and a fragment matches half the list by accident: a bare
 * "a" is inside "academia", so a student who had typed one letter would be
 * counted under graduate school.
 */
const MIN_MATCH = 3;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matching has to start at a word boundary in both directions. Plain substring
 * matching put "art" inside "marketing" and reported a student who wants to
 * work in the arts as marketing.
 */
const startsAtWord = (haystack, needle) =>
  new RegExp(`\\b${escapeRe(needle)}`).test(haystack);

export function bucketPath(value) {
  const typed = String(value ?? '').trim().toLowerCase();
  if (!typed) return 'none';
  if (typed.length < MIN_MATCH) return 'other';

  const hit = KNOWN_PATHS.find((label) => {
    const known = label.toLowerCase();
    // "banking" against "Investment banking / finance", and the other way
    // round for "I want to do investment banking somewhere".
    return startsAtWord(known, typed) || startsAtWord(typed, known.split(' /')[0]);
  });

  return hit || 'other';
}
