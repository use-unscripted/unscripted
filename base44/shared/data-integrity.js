/**
 * Data-integrity planning: pure logic, no writes.
 *
 * Two problems live here, both of them "the same real thing is stored twice":
 *
 *  1. Duplicate Career Hypotheses (PathRecommendations). A refresh or a repeated
 *     submission during generation wrote a second set, so a student can own two
 *     rows describing the same career. The pool the recommendation engine and
 *     the Decision Matrix read then double-counts them.
 *
 *  2. More than one active CareerCycle. The reader used to keep the OLDEST
 *     active row, which is a guess: the oldest row is not the one the student
 *     has been working in.
 *
 * Nothing here decides anything it cannot justify from the records. Where two
 * rows are equally plausible the pair is returned as REVIEW, never merged.
 * Nothing is ever deleted: a merged duplicate is archived and stamped with the
 * row it was merged into, so every merge is reversible by hand.
 */

export const CYCLE_STAGES = [
  'onboarding',
  'path_comparison',
  'path_selected',
  'experiment_active',
  'evidence_required',
  'reflection_ready',
  'decision_required',
  'completed',
];

export { normalizeTitle } from './path-similarity.js';
import { canonicalTitle, compareTitles, normalizeTitle } from './path-similarity.js';

const ownerOf = (row) => row?.created_by_id || row?.user_id || null;
const olderFirst = (a, b) => String(a.created_date || '').localeCompare(String(b.created_date || ''));

/** Group any rows by the user that owns them. */
export function byOwner(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const owner = ownerOf(row);
    if (!owner) continue;
    if (!map.has(owner)) map.set(owner, []);
    map.get(owner).push(row);
  }
  return map;
}

// ── Duplicate hypotheses ────────────────────────────────────────────────────

/**
 * How many records point at a given path row. A duplicate carrying real work is
 * never silently archived: either its work moves to the surviving row, or the
 * pair goes to review.
 */
export function linkIndex({ experiments = [], proof = [], reflections = [], updates = [], cycles = [] } = {}) {
  const counts = new Map();
  const bump = (id, kind) => {
    if (!id) return;
    if (!counts.has(id)) counts.set(id, { experiments: 0, proof: 0, reflections: 0, updates: 0, cycles: 0 });
    counts.get(id)[kind] += 1;
  };
  experiments.forEach(e => {
    if (e.deletion_status === 'deleted') return;
    bump(e.path_id, 'experiments');
    if (e.path_recommendation_id !== e.path_id) bump(e.path_recommendation_id, 'experiments');
  });
  proof.forEach(p => { if (p.deletion_status !== 'deleted') bump(p.path_id, 'proof'); });
  reflections.forEach(r => { if (r.deletion_status !== 'deleted') bump(r.path_id, 'reflections'); });
  updates.forEach(u => bump(u.path_id, 'updates'));
  cycles.forEach(c => bump(c.selected_path_id, 'cycles'));
  return counts;
}

export function totalLinks(counts, id) {
  const c = counts.get(id);
  if (!c) return 0;
  return c.experiments + c.proof + c.reflections + c.updates + c.cycles;
}

/**
 * One decision about a keeper and a candidate duplicate of it. The keeper is
 * always the older row, because that is the one the student's work points at.
 */
function decidePair(keep, dup, counts, match) {
  const keepLinks = totalLinks(counts, keep.id);
  const dupLinks = totalLinks(counts, dup.id);
  const wording = match.verdict === 'same'
    ? `"${keep.path_name}" and "${dup.path_name}" describe the same career once wording is set aside.`
    : `"${keep.path_name}" and "${dup.path_name}" match on ${Math.round(match.similarity * 100)}% of their meaningful words.`;
  const common = {
    title: canonicalTitle(keep.path_name),
    keep_id: keep.id,
    keep_name: keep.path_name,
    duplicate_id: dup.id,
    duplicate_name: dup.path_name,
    similarity: Math.round(match.similarity * 100) / 100,
  };

  // Close but not clearly the same: a person decides, nothing is touched.
  if (match.verdict === 'review') {
    return { kind: 'review', row: { ...common, reason: `${wording} That is close enough to check by hand, but not close enough to merge automatically.` } };
  }

  const differentSubmission =
    keep.onboarding_submission_id && dup.onboarding_submission_id
    && keep.onboarding_submission_id !== dup.onboarding_submission_id;
  if (differentSubmission) {
    return { kind: 'review', row: { ...common, reason: `${wording} They came from different onboarding submissions, so they may be intentionally separate hypotheses.` } };
  }
  if (dupLinks > 0 && keepLinks > 0) {
    return { kind: 'review', row: { ...common, reason: `${wording} Both carry work (${keepLinks} and ${dupLinks} linked records), so which one is authoritative is a judgement call.` } };
  }

  return {
    kind: 'merge',
    row: {
      ...common,
      remap: dupLinks > 0,
      linked_records: dupLinks,
      reason: dupLinks > 0
        ? `${wording} The surviving row has no work of its own, so the duplicate\u2019s records are remapped onto it.`
        : `${wording} The duplicate has no records attached.`,
    },
  };
}

/**
 * The de-duplication plan for one student.
 *
 * Two rows are the same hypothesis when their titles reduce to the same
 * canonical career wording, or when they share enough meaningful words to pass
 * the merge threshold ("Healthcare-focused boutique investment banking" and
 * "Healthcare boutique investment banking"). Titles that are close without
 * clearing that bar are reported for review rather than merged, and so is any
 * pair where both rows carry real work.
 *
 * @returns {{ merges: Array, review: Array }}
 */
export function planPathDedupe(rows = [], counts = new Map()) {
  const live = rows
    .filter(r => r.integrity_status !== 'merged' && normalizeTitle(r.path_name))
    .sort(olderFirst);

  const merges = [];
  const review = [];
  // Each cluster is led by the oldest row that started it. Later rows are
  // compared against that leader, so a chain of loose matches can never drag
  // two different careers into one cluster.
  const clusters = [];

  for (const row of live) {
    let placed = false;
    for (const cluster of clusters) {
      const match = compareTitles(cluster.keep.path_name, row.path_name);
      if (match.verdict === 'different') continue;
      const decision = decidePair(cluster.keep, row, counts, match);
      if (decision.kind === 'merge') merges.push(decision.row);
      else review.push(decision.row);
      // A row sent to review stays its own hypothesis, so it can lead a cluster
      // of its own; a merged row cannot.
      placed = decision.kind === 'merge';
      // First cluster it resembles is the only one it is judged against, so a
      // row is never reported twice.
      break;
    }
    if (!placed) clusters.push({ keep: row });
  }

  return { merges, review };
}

/**
 * Look-alike pairs among ONE student's own paths, for the student to resolve in
 * the app. Unlike planPathDedupe this decides nothing: it reports every pair
 * whose titles are not clearly different, in both a "review" and a "same" case,
 * with how much work hangs off each side so the student can see what would
 * move. The student picks which row survives.
 */
export function findLookalikePairs(rows = [], counts = new Map()) {
  const live = rows
    .filter(r => r.integrity_status !== 'merged' && normalizeTitle(r.path_name))
    .sort(olderFirst);

  const pairs = [];
  const seen = new Set();
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      const match = compareTitles(a.path_name, b.path_name);
      if (match.verdict === 'different') continue;
      const key = [a.id, b.id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        similarity: Math.round(match.similarity * 100) / 100,
        certain: match.verdict === 'same' || match.verdict === 'duplicate',
        options: [a, b].map(row => ({
          id: row.id,
          path_name: row.path_name,
          created_date: row.created_date || null,
          is_primary_focus: Boolean(row.is_primary_focus),
          status: row.status || null,
          linked_records: totalLinks(counts, row.id),
        })),
      });
    }
  }
  return pairs;
}

// ── One authoritative active cycle ──────────────────────────────────────────

const stageRank = (c) => Math.max(0, CYCLE_STAGES.indexOf(c.current_stage || 'onboarding'));

function cycleScore(cycle, liveExperimentIds) {
  const hasLiveExperiment = cycle.experiment_id && liveExperimentIds.has(cycle.experiment_id) ? 1 : 0;
  return { hasLiveExperiment, stage: stageRank(cycle), touched: String(cycle.updated_date || cycle.created_date || '') };
}

/**
 * Which active cycle is authoritative, and what to do with the rest.
 *
 * Order: a cycle with a live linked experiment beats one without (that is the
 * cycle the student has actually been working in), then the furthest stage
 * reached, then the most recently touched record. Nothing here reads created
 * order first, which is what used to hand authority to an abandoned row.
 *
 * Ambiguity is real and is not resolved: when the leaders tie on all three
 * signals and point at different hypotheses, every row is returned for review
 * and none is superseded. The reader still has to show one cycle, so the
 * highest-scoring row is named — but it is flagged, not quietly cleaned up.
 */
export function resolveCycleAuthority(activeCycles = [], liveExperimentIds = new Set()) {
  const rows = [...activeCycles];
  if (rows.length <= 1) return { authoritative: rows[0] || null, supersede: [], review: [], ambiguous: false };

  const scored = rows
    .map(c => ({ cycle: c, score: cycleScore(c, liveExperimentIds) }))
    .sort((a, b) =>
      (b.score.hasLiveExperiment - a.score.hasLiveExperiment)
      || (b.score.stage - a.score.stage)
      || b.score.touched.localeCompare(a.score.touched));

  const [top, second] = scored;
  const tie = second
    && second.score.hasLiveExperiment === top.score.hasLiveExperiment
    && second.score.stage === top.score.stage
    && second.score.touched === top.score.touched;
  const differentPaths = tie && (second.cycle.selected_path_id || null) !== (top.cycle.selected_path_id || null);
  const ambiguous = Boolean(tie && differentPaths);

  if (ambiguous) {
    return {
      authoritative: top.cycle,
      supersede: [],
      review: scored.map(s => s.cycle),
      ambiguous: true,
      reason: 'Several active cycles were created at the same moment with different hypotheses and no experiment, so none can be shown to be the one the student meant.',
    };
  }

  return {
    authoritative: top.cycle,
    supersede: scored.slice(1).map(s => s.cycle),
    review: [],
    ambiguous: false,
    reason: top.score.hasLiveExperiment
      ? 'This cycle is the one with a live experiment attached.'
      : 'This cycle reached the furthest stage and was touched most recently.',
  };
}