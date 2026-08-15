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

export const normalizeTitle = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
 * The de-duplication plan for one student.
 *
 * Identity is "same owner, same normalized career title". That is deliberately
 * narrow: two genuinely different hypotheses never share a normalized title,
 * and a student who intentionally created a second hypothesis about the same
 * career will have work attached to it, which sends the pair to review rather
 * than merging it away.
 *
 * @returns {{ merges: Array, review: Array }}
 */
export function planPathDedupe(rows = [], counts = new Map()) {
  const groups = new Map();
  for (const row of rows) {
    if (row.integrity_status === 'merged') continue;
    const key = normalizeTitle(row.path_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const merges = [];
  const review = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(olderFirst);
    const keep = ordered[0];
    const keepLinks = totalLinks(counts, keep.id);

    for (const dup of ordered.slice(1)) {
      const dupLinks = totalLinks(counts, dup.id);
      const differentSubmission =
        keep.onboarding_submission_id && dup.onboarding_submission_id
        && keep.onboarding_submission_id !== dup.onboarding_submission_id;

      if (differentSubmission) {
        review.push({
          title: key, keep_id: keep.id, duplicate_id: dup.id,
          reason: 'Both rows came from different onboarding submissions, so they may be intentionally separate hypotheses.',
        });
        continue;
      }
      if (dupLinks > 0 && keepLinks > 0) {
        review.push({
          title: key, keep_id: keep.id, duplicate_id: dup.id,
          reason: `Both rows carry work (${keepLinks} and ${dupLinks} linked records), so which one is authoritative is a judgement call.`,
        });
        continue;
      }
      merges.push({
        title: key,
        keep_id: keep.id,
        keep_name: keep.path_name,
        duplicate_id: dup.id,
        remap: dupLinks > 0,
        linked_records: dupLinks,
        reason: dupLinks > 0
          ? 'Duplicate title; the surviving row has no work of its own, so the duplicate\u2019s records are remapped onto it.'
          : 'Duplicate title with no records attached, produced by a repeated generation.',
      });
    }
  }

  return { merges, review };
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