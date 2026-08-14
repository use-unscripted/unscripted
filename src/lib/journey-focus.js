/**
 * The view model behind My Journey's redesigned focus: what is being tested,
 * what we know, what is still unknown, and how the student's thinking has moved.
 *
 * Read-only, and deliberately thin. The Career Hypothesis layer, the Career
 * Uncertainty Map and the shared dimension evidence are already the source of
 * truth, so nothing here derives a second, slightly different version of them —
 * it selects and orders what those already say.
 *
 * Rules held here:
 *  - A "known" statement must come from something the student did. Stated
 *    preferences from onboarding are not promoted into conclusions.
 *  - Unknowns are the highest-relevance untested characteristics, 2 to 4 of them.
 *  - Clarity is reported, never scored. More completion is not framed as better.
 *  - A path the student stopped pursuing is a thing they learned, not a failure.
 */
import { base44 } from '@/api/base44Client';
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { loadOwnedPaths } from '@/lib/path-set';
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/career-hypothesis';
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';

/** Confidence is reported in words on this screen. The number stays underneath. */
export function confidenceBand(score) {
  if (typeof score !== 'number') return 'Low';
  if (score >= 65) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

const ELIMINATED = new Set(['archived', 'deprioritized']);
const isEliminated = (p) => ELIMINATED.has(p.status) || p.hypothesis_status === 'eliminated';

/** Only evidence produced by something the student did. */
function knownFrom(hypothesis) {
  return (hypothesis.what_we_know || [])
    .filter(k => k?.text && !/onboarding|you said|you told us/i.test(k.source || ''))
    .slice(0, 4);
}

/** The 2 to 4 unknowns that matter most on this career. */
function unknownsFrom(hypothesis) {
  const fromMap = (hypothesis.uncertainty?.top_unknowns || [])
    .map(v => ({ key: v.variable, question: v.question, label: v.label }));
  const fallback = (hypothesis.unresolved_questions || [])
    .map((q, i) => ({ key: `q${i}`, question: q.question, label: q.why_it_matters }));
  const seen = new Set();
  return [...fromMap, ...fallback]
    .filter(u => u.question && !seen.has(u.question) && seen.add(u.question))
    .slice(0, 4);
}

function shape({ path, hypothesis }, signals) {
  const progress = dimensionProgress({ hypothesis, signals });
  return {
    id: path.id,
    name: path.path_name,
    status: hypothesis.hypothesis_status,
    statusLabel: HYPOTHESIS_STATUS_LABELS[hypothesis.hypothesis_status] || 'Testing',
    confidence: hypothesis.fit_confidence_score,
    confidenceBand: confidenceBand(hypothesis.fit_confidence_score),
    fit: hypothesis.career_fit_score,
    why: hypothesis.why_this_may_fit || '',
    known: knownFrom(hypothesis),
    unknowns: unknownsFrom(hypothesis),
    progress,
    nextTest: progress ? nextTestForPath({ path, hypothesis, progress }) : null,
  };
}

/**
 * Career clarity, reported as a record rather than a score to grow.
 * `current` is the most recent clarity reading the student gave in a reflection;
 * absent one, it stays null rather than reusing the baseline as if it had moved.
 */
function clarityFrom({ profile, reflections, hypotheses, completedExperiments }) {
  const rated = reflections
    .filter(r => typeof r.clarity_score === 'number')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const resolved = new Set();
  hypotheses.forEach(h => (h.progress?.tested || []).forEach(t => resolved.add(t.id)));

  return {
    baseline: typeof profile?.baseline_career_clarity === 'number' ? profile.baseline_career_clarity : null,
    current: rated.length ? rated[0].clarity_score : null,
    hypothesesTested: hypotheses.filter(h => (h.progress?.testedCount || 0) > 0).length,
    unknownsResolved: resolved.size,
    experimentsCompleted: completedExperiments,
  };
}

/**
 * Everything the focused dashboard needs, in one pass.
 * `currentPathName` is the path the journey resolver already decided is being
 * tested, so this screen and the stage spine can never disagree about it.
 */
export async function loadJourneyFocus({ currentPathName } = {}) {
  const [p, owned, refs] = await Promise.all([
    loadEvidenceProfile(),
    loadOwnedPaths().catch(() => ({ paths: [] })),
    base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
  ]);

  const shaped = p.hypotheses.map(h => shape(h, p.signals || []));
  const focus = shaped.find(h => h.name === currentPathName) || null;
  const others = shaped.filter(h => h !== focus).slice(0, 2);

  const eliminated = (owned?.paths || [])
    .filter(isEliminated)
    .map(path => ({
      id: path.id,
      name: path.path_name,
      learned: path.hypothesis_modification_note || path.why_it_may_not_fit || path.concern || '',
    }))
    .slice(0, 4);

  return {
    focus,
    others,
    eliminated,
    clarity: clarityFrom({
      profile: p.profile,
      reflections: Array.isArray(refs) ? refs.filter(r => r.deletion_status !== 'deleted') : [],
      hypotheses: shaped,
      completedExperiments: p.counts.completedExperiments,
    }),
  };
}