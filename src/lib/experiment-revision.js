/**
 * Material change detection for experiments, and the versioning decision that
 * follows from it.
 *
 * The rule this file exists to enforce: a professional review approved a
 * SPECIFIC version of an experiment's wording. If the wording changes in a way
 * that changes what the student actually does, that approval no longer describes
 * the thing on screen, so it must stop counting rather than quietly carry
 * forward. If the change is a typo, a reformat, or a wording tidy that leaves
 * the task identical, the review stands.
 *
 * Nothing here writes anything or calls a model. It compares two content
 * objects and returns what changed, so the same judgement can be shown to an
 * admin, shown to a reviewer, and used to decide the version bump.
 */

/**
 * The fields that define what an experiment IS. A change to any of these is
 * material by definition — this list is the product rule, written down.
 *
 * `kind` decides how two values are compared:
 *   text  — prose, so near-identical wording is treated as a tidy
 *   list   — a set of items; adding or removing one is material
 *   sequence — an ordered list; reordering is material too (mission steps)
 *   value  — a number, boolean or id; any change is material
 */
export const MATERIAL_FIELDS = [
  { key: 'core_task', label: 'Core task', kind: 'text' },
  { key: 'test_question', label: 'Test question', kind: 'text' },
  { key: 'decision_dimension_ids', label: 'Career dimensions tested', kind: 'list' },
  { key: 'work_characteristics_tested', label: 'Work characteristics tested', kind: 'list' },
  { key: 'evidence_required', label: 'Evidence requirement', kind: 'list' },
  { key: 'deliverable', label: 'Evidence requirement (deliverable)', kind: 'text' },
  { key: 'instructions', label: 'Mission sequence', kind: 'sequence' },
  { key: 'outreach_required', label: 'Professional outreach requirement', kind: 'value' },
  { key: 'human_component', label: 'Professional outreach requirement', kind: 'text' },
  { key: 'difficulty_level', label: 'Difficulty', kind: 'value' },
  { key: 'estimated_minutes_low', label: 'Expected time', kind: 'value' },
  { key: 'estimated_minutes_high', label: 'Expected time', kind: 'value' },
  { key: 'role_blueprint_id', label: 'Role Blueprint mapping', kind: 'value' },
  { key: 'role_blueprint_version', label: 'Role Blueprint mapping', kind: 'value' },
  { key: 'realistic_scenario', label: 'Important instructions', kind: 'text' },
  { key: 'evaluation_criteria', label: 'Scoring or evaluation rubric', kind: 'sequence' },
];

/** Fields that describe presentation only. A change here is never material. */
export const COSMETIC_FIELDS = ['title', 'why_it_matters', 'what_it_tests'];

/** How similar two pieces of prose must be to count as a tidy rather than a rewrite. */
export const TIDY_SIMILARITY = 0.9;

const TEXT_CAP = 600;

/**
 * Strips everything that carries no meaning: case, punctuation, and the
 * difference between one space, three spaces and a line break. Two strings that
 * normalize to the same thing differ only in formatting.
 */
export const normalizeText = (v) => String(v ?? '')
  .toLowerCase()
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[^a-z0-9'"]+/g, ' ')
  .trim();

const normalizeItem = (v) => normalizeText(v);
const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map(normalizeItem).filter(Boolean);

/** Levenshtein distance, bounded so a long instruction block stays cheap. */
function distance(a, b) {
  const s = a.slice(0, TEXT_CAP);
  const t = b.slice(0, TEXT_CAP);
  if (s === t) return 0;
  if (!s.length || !t.length) return Math.max(s.length, t.length);
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    for (let j = 1; j <= t.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[t.length];
}

/** 1 = identical after normalization, 0 = nothing in common. */
export function similarity(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (s === t) return 1;
  const longest = Math.max(s.length, t.length, 1);
  return Math.max(0, 1 - distance(s, t) / longest);
}

const listChange = (before, after, ordered) => {
  const a = asList(before);
  const b = asList(after);
  if (ordered) return a.join('\u0000') !== b.join('\u0000');
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return true;
  return [...setA].some(x => !setB.has(x));
};

const valueChange = (before, after) => {
  const norm = (v) => (v === undefined || v === null || v === '' ? null : typeof v === 'boolean' ? v : String(v));
  return norm(before) !== norm(after);
};

/**
 * What changed between two versions of an experiment's content.
 *
 * Returns every field that moved, each classified as material or a tidy, plus
 * `material` — the single answer to "does this invalidate the reviews?".
 */
export function diffExperimentVersions(previous = {}, next = {}) {
  const changes = [];

  MATERIAL_FIELDS.forEach(({ key, label, kind }) => {
    const before = previous?.[key];
    const after = next?.[key];
    let changed = false;
    let material = false;
    let detail = null;

    if (kind === 'text') {
      const sim = similarity(before, after);
      changed = normalizeText(before) !== normalizeText(after) || String(before ?? '') !== String(after ?? '');
      if (changed) {
        // Same words after normalization = a reformat. Near-identical wording =
        // a typo fix or a tidy. Anything further apart is a rewrite.
        material = sim < TIDY_SIMILARITY;
        detail = { similarity: Math.round(sim * 100) / 100 };
      }
    } else if (kind === 'list' || kind === 'sequence') {
      changed = listChange(before, after, kind === 'sequence');
      material = changed;
    } else {
      changed = valueChange(before, after);
      material = changed;
    }

    if (changed) {
      changes.push({
        field: key,
        label,
        kind: material ? 'material' : 'minor',
        before: Array.isArray(before) ? before.join(' | ') : before ?? null,
        after: Array.isArray(after) ? after.join(' | ') : after ?? null,
        ...detail,
      });
    }
  });

  COSMETIC_FIELDS.forEach(key => {
    if (valueChange(previous?.[key], next?.[key])) {
      changes.push({ field: key, label: 'Presentation', kind: 'minor', before: previous?.[key] ?? null, after: next?.[key] ?? null });
    }
  });

  const material = changes.filter(c => c.kind === 'material');
  return {
    material: material.length > 0,
    changes,
    material_changes: material,
    minor_changes: changes.filter(c => c.kind === 'minor'),
    summary: material.length
      ? `Material change to ${[...new Set(material.map(c => c.label))].join(', ')}.`
      : changes.length
        ? 'Wording and formatting only. No change to what the student does.'
        : 'No change.',
  };
}

/**
 * The versioning decision, given a diff and the validation record in play.
 * Pure on purpose — the writer in validation-admin.js applies exactly this.
 */
export function revisionPlan({ validation, diff }) {
  const currentVersion = Number(validation?.experiment_version || 1);
  if (!diff?.material) {
    return {
      material: false,
      next_version: currentVersion,
      supersede_reviews: false,
      validation_status: validation?.validation_status || 'draft',
      summary: diff?.summary || 'No change.',
    };
  }
  return {
    material: true,
    next_version: currentVersion + 1,
    supersede_reviews: true,
    validation_status: 'needs_rereview',
    summary: diff.summary,
  };
}

/** Student-facing wording. Honest about what the badge currently means. */
export const REREVIEW_LABEL = 'Recently Updated: Professional Re-Review Pending';
export const REREVIEW_NOTE = 'This experiment was materially updated, so the professional reviews of the previous version no longer apply to it. A professional re-review is pending.';

export default diffExperimentVersions;