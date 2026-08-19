/**
 * What could change your mind about this path.
 *
 * The Lab's other blocks describe where a path stands. This one deliberately
 * works the other way round: it names the assumption most likely to WEAKEN the
 * leading path if it were tested, so the next test challenges the current
 * picture rather than decorating it.
 *
 * It invents nothing. The belief half is read off the dimensions that already
 * have evidence, and the assumption half is the most important thing on the same
 * path with no reading, an unsettled reading, a contradiction, or a tradeoff the
 * student has not met. Where the path's next test already points at that
 * dimension, this block hands the student straight to it.
 */

const lower = (s) => String(s || '').trim().replace(/\?$/, '').replace(/^./, c => c.toLowerCase());
const RELEVANCE = { high: 2, medium: 1, low: 0 };

/**
 * @returns {object|null} { belief, assumption, why, to } or null when there is
 *          nothing untested left to challenge.
 */
export function buildChangeOfMind({ progress, tensions = [], tradeoffs = null, nextTest = null }) {
  if (!progress) return null;

  const believed = (progress.tested || []).filter(t => !t.contradicted).map(t => lower(t.label));
  const belief = believed.length
    ? `You currently have evidence on ${believed.slice(0, 2).join(' and ')}`
    : 'You have told us what you want from this path, and little yet has been tested';

  const target = pickTarget({ progress, tensions, tradeoffs });
  if (!target) return null;

  return {
    belief,
    assumption: `${belief}, but ${target.gap}.`,
    why: target.why,
    // The same destination the path's next test already uses, so the two agree.
    to: target.to || nextTest?.to || null,
    dimension: target.dimension || null,
  };
}

/** Contradiction first, then an unmet tradeoff, then untested, then unsettled. */
function pickTarget({ progress, tensions, tradeoffs }) {
  const contradicted = (progress.tested || []).find(t => t.contradicted);
  if (contradicted) {
    return {
      dimension: contradicted.label,
      gap: `your readings on ${lower(contradicted.label)} have gone both ways, so you do not yet know which one holds`,
      why: 'A reading that has gone both ways is the fastest way this path could turn out to be different from what you think it is.',
    };
  }

  const tension = (tensions || [])[0];
  if (tension) {
    return {
      dimension: tension.variable || null,
      gap: `two things you have recorded disagree: ${lower(tension.title)}`,
      why: 'Testing where your own evidence disagrees with itself is what stops a path resting on the half of it you happened to see first.',
    };
  }

  const tradeoff = (tradeoffs?.unresolvedImportant || [])[0];
  if (tradeoff) {
    return {
      dimension: null,
      gap: `you have not tested whether you can live with ${lower(tradeoff.label)}`,
      why: 'A cost you have not met is the most common reason a path that looked right stops being right.',
      to: tradeoff.simulatable === false ? '/human-reality' : null,
    };
  }

  const untested = [...(progress.untested || [])]
    .sort((a, b) => (RELEVANCE[b.relevance] || 0) - (RELEVANCE[a.relevance] || 0))[0]
    || (progress.partial || [])[0];
  if (!untested) return null;

  return {
    dimension: untested.label,
    gap: `you have not tested whether you tolerate ${lower(untested.label)}`,
    why: `${untested.question || 'This is one of the parts of the work that matters most here.'} An answer either way would move this path, which is exactly why it is worth testing next.`,
  };
}

export default buildChangeOfMind;