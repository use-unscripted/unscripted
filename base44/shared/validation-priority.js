/**
 * Which EXISTING experiments to professionally validate next, and how well each
 * Path is actually covered.
 *
 * The point of this module is depth, not breadth. It never proposes a new career
 * and never proposes a new experiment: it ranks the experiments already on file
 * and says which of them are worth a professional's time first.
 *
 * Two readings come out of here:
 *
 *   queue          every validation record, scored on the seven factors below,
 *                  with the reason for each factor stated rather than implied.
 *   path_coverage  per supported Path: how many experiments are usable, how many
 *                  are source grounded, how many are professionally reviewed,
 *                  which decision dimensions are covered, and which major ones
 *                  are not covered yet.
 *
 * Usage counts come from PilotEvent and count REAL students only. Internal and
 * unclassified accounts are excluded and reported separately, because a founder
 * demoing an experiment twenty times must never make it look important.
 *
 * Nothing here writes, deletes or rewrites anything.
 */

/**
 * The decision dimensions, with the group each one belongs to.
 *
 * Duplicated deliberately from src/lib/career-dimensions.js: a backend shared
 * module cannot import from the frontend bundle. Only the id, a label and the
 * group are held here — the student-facing wording stays in one place, on the
 * frontend. `group` is what the diversity rule reads: three near-identical work
 * samples on one Path is worth less than a core task, a decision and a human
 * interaction on the same Path.
 */
export const DIMENSION_GROUPS = [
  { id: 'core_work', label: 'Core work task' },
  { id: 'decision_making', label: 'Decision making' },
  { id: 'human_interaction', label: 'Human interaction' },
  { id: 'conditions', label: 'Working conditions' },
];

export const PRIORITY_DIMENSIONS = [
  // Core work task
  { id: 'analytical_depth', label: 'Analytical depth', group: 'core_work', major: true, signals: ['analytical_intensity', 'problem_solving'] },
  { id: 'quantitative_intensity', label: 'Quantitative intensity', group: 'core_work', major: true, signals: ['quantitative_work'] },
  { id: 'writing', label: 'Writing', group: 'core_work', major: true, signals: ['writing'] },
  { id: 'research', label: 'Research', group: 'core_work', major: false, signals: ['research'] },
  { id: 'creativity', label: 'Creativity', group: 'core_work', major: false, signals: ['creativity'] },
  { id: 'detail_orientation', label: 'Detail orientation', group: 'core_work', major: true, signals: ['attention_to_detail'] },
  { id: 'repetitive_precision', label: 'Repetitive precision work', group: 'core_work', major: false, signals: ['repetitive_tolerance'] },
  { id: 'operational_execution', label: 'Operational execution', group: 'core_work', major: false, signals: ['operational_execution'] },
  // Decision making
  { id: 'ambiguity_tolerance', label: 'Ambiguity tolerance', group: 'decision_making', major: true, signals: ['ambiguity_tolerance'] },
  { id: 'autonomy', label: 'Autonomy', group: 'decision_making', major: true, signals: ['autonomy'] },
  { id: 'risk_tolerance', label: 'Risk tolerance', group: 'decision_making', major: false, signals: ['risk_tolerance'] },
  { id: 'building_orientation', label: 'Building vs advising', group: 'decision_making', major: false, signals: ['building_orientation'] },
  { id: 'structured_environments', label: 'Structured environments', group: 'decision_making', major: false, signals: ['structure'] },
  // Human interaction
  { id: 'client_interaction', label: 'Client interaction', group: 'human_interaction', major: true, signals: ['interpersonal', 'stakeholder_conflict'] },
  { id: 'presenting', label: 'Presenting', group: 'human_interaction', major: true, signals: ['presenting', 'communication'] },
  { id: 'persuasion', label: 'Persuasion', group: 'human_interaction', major: false, signals: ['persuasion'] },
  { id: 'teamwork', label: 'Teamwork', group: 'human_interaction', major: false, signals: ['teamwork'] },
  { id: 'leadership', label: 'Leadership', group: 'human_interaction', major: false, signals: ['leadership'] },
  // Working conditions
  { id: 'high_pressure_pace', label: 'High-pressure pace', group: 'conditions', major: true, signals: ['pace'] },
  { id: 'independent_work', label: 'Independent work', group: 'conditions', major: false, signals: ['independent_work'] },
  { id: 'competition', label: 'Competition', group: 'conditions', major: false, signals: ['competition'] },
  { id: 'long_project_cycles', label: 'Long project cycles', group: 'conditions', major: false, signals: ['long_project_cycles'] },
  { id: 'short_feedback_loops', label: 'Short feedback loops', group: 'conditions', major: false, signals: ['short_feedback_loops'] },
  { id: 'mission_orientation', label: 'Mission orientation', group: 'conditions', major: false, signals: ['mission_orientation'] },
];

const DIM_BY_ID = new Map(PRIORITY_DIMENSIONS.map(d => [d.id, d]));
const DIM_BY_SIGNAL = new Map();
PRIORITY_DIMENSIONS.forEach(d => d.signals.forEach(s => DIM_BY_SIGNAL.set(s, d)));

export const MAJOR_DIMENSIONS = PRIORITY_DIMENSIONS.filter(d => d.major);

/** The seven ranking factors, in the order they were asked for. */
export const PRIORITY_FACTORS = [
  { key: 'recommendation_frequency', label: 'Recommended to real students', weight: 20 },
  { key: 'selection_frequency', label: 'Selected by real students', weight: 20 },
  { key: 'path_importance', label: 'Supported Path importance', weight: 15 },
  { key: 'dimension_fill', label: 'Fills an important dimension', weight: 15 },
  { key: 'validation_weakness', label: 'Current validation weakness', weight: 15 },
  { key: 'repeat_support', label: 'Supports repeated cycles', weight: 10 },
  { key: 'strategic', label: 'Strategic importance', weight: 5 },
];

const WEIGHT = Object.fromEntries(PRIORITY_FACTORS.map(f => [f.key, f.weight]));

const RECOMMENDED_EVENTS = ['experiment_recommended', 'experiment_card_viewed', 'experiment_detail_viewed', 'next_experiment_recommended'];
const SELECTED_EVENTS = ['experiment_selected', 'experiment_started'];

const arr = (v) => (Array.isArray(v) ? v : []);
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Dimension ids an experiment or validation record actually claims to test. */
export function dimensionsOf(record = {}) {
  const tags = [
    ...arr(record.decision_dimension_ids),
    ...arr(record.work_characteristics_tested),
    ...arr(record.work_characteristic_ids),
  ].map(t => String(t).toLowerCase().replace(/\s+/g, '_'));
  const out = new Set();
  tags.forEach(t => {
    if (DIM_BY_ID.has(t)) out.add(t);
    else if (DIM_BY_SIGNAL.has(t)) out.add(DIM_BY_SIGNAL.get(t).id);
  });
  return [...out];
}

export const dimensionMeta = (id) => DIM_BY_ID.get(id) || { id, label: id, group: 'core_work', major: false };
const groupsOf = (ids = []) => [...new Set(ids.map(id => dimensionMeta(id).group))];

/**
 * Which validation record a real student's Experiments row belongs to.
 *
 * Three links, strongest first: the validation's own experiment_id, a
 * blueprint_key recorded on an ExperimentFeedback row for that experiment, and
 * finally a normalised title match. When none of the three connect, the usage is
 * left unattributed rather than guessed, and the count says so.
 */
export function usageIndex({ validations = [], experiments = [], feedback = [] } = {}) {
  const keyByExperimentId = new Map();
  arr(feedback).forEach(f => {
    if (f.experiment_id && f.blueprint_key) keyByExperimentId.set(f.experiment_id, f.blueprint_key);
  });

  const byValidationId = new Map(arr(validations).map(v => [v.id, new Set()]));
  const byOwnId = new Map(arr(validations).filter(v => v.experiment_id).map(v => [v.experiment_id, v.id]));
  const byKey = new Map(arr(validations).filter(v => v.blueprint_key).map(v => [v.blueprint_key, v.id]));
  const byTitle = new Map(arr(validations).filter(v => v.experiment_title).map(v => [norm(v.experiment_title), v.id]));

  let unattributed = 0;
  arr(experiments).forEach(e => {
    const key = keyByExperimentId.get(e.id);
    const validationId = byOwnId.get(e.id)
      || (key ? byKey.get(key) : null)
      || byTitle.get(norm(e.title))
      || null;
    if (!validationId) { unattributed += 1; return; }
    byValidationId.get(validationId)?.add(e.id);
  });

  return { byValidationId, unattributed };
}

/**
 * The validation level a record's stored evidence supports: 0 draft, 1 source
 * grounded, 2 professionally reviewed, 3 multi-professional, 4 field calibrated.
 *
 * The same rule as validationLevelFrom in src/lib/experiment-strength.js, held
 * here because a backend shared module cannot import the frontend bundle. If the
 * rule changes, it changes in both places. Both read the same records, so the
 * two can be compared rather than trusted.
 */
export function validationLevel({ validation, sources = [], reviews = [] } = {}) {
  const verified = arr(sources).filter(s => s.active_status !== 'retired' && s.source_verified_at);
  if (!validation?.role_blueprint_id || verified.length < 1) return 0;
  const version = Number(validation.experiment_version || 1);
  const approved = arr(reviews).filter(r => r.approval_status === 'approved'
    && (r.experiment_version == null || Number(r.experiment_version) === version));
  if (validation.field_calibrated && approved.length >= 2) return 4;
  if (approved.length >= 2) return 3;
  if (approved.length >= 1) return 2;
  return 1;
}

/**
 * The ranked queue.
 *
 * @param strength  optional ({ validation, sources, reviews }) => { validation_level }.
 *                  Defaults to validationLevel above.
 */
export function validationQueue({
  validations = [], sources = [], reviews = [], paths = [], experiments = [],
  feedback = [], events = [], blueprints = [], realUserIds = new Set(), strength,
} = {}) {
  const real = (row) => realUserIds.has(row?.created_by_id) || realUserIds.has(row?.user_id);
  const realExperiments = arr(experiments).filter(e =>
    real(e) && e.deletion_status !== 'deleted' && e.deletion_status !== 'permanently_deleted');
  const realEvents = arr(events).filter(real);
  const realPaths = arr(paths).filter(real);

  const { byValidationId, unattributed } = usageIndex({
    validations, experiments: realExperiments, feedback,
  });

  // Per-experiment event counts, deduplicated per student: one student clicking
  // the same card nine times is one student, not nine.
  const studentsByExperiment = new Map(); // experiment_id → { recommended:Set, selected:Set, cyclesByStudent:Map }
  realEvents.forEach(e => {
    if (!e.experiment_id) return;
    if (!studentsByExperiment.has(e.experiment_id)) {
      studentsByExperiment.set(e.experiment_id, { recommended: new Set(), selected: new Set() });
    }
    const bucket = studentsByExperiment.get(e.experiment_id);
    const student = e.created_by_id || e.user_id;
    if (RECOMMENDED_EVENTS.includes(e.event_name)) bucket.recommended.add(student);
    if (SELECTED_EVENTS.includes(e.event_name)) bucket.selected.add(student);
  });

  // Path importance: how many real students carry this career as a live path,
  // and how many of them made it their primary focus.
  const pathStudents = (careerTitle) => {
    const want = norm(careerTitle);
    if (!want) return { students: 0, primary: 0 };
    const matches = realPaths.filter(p => {
      const name = norm(p.path_name);
      return name && (name === want || name.includes(want) || want.includes(name));
    });
    return {
      students: new Set(matches.map(p => p.created_by_id || p.user_id)).size,
      primary: new Set(matches.filter(p => p.is_primary_focus).map(p => p.created_by_id || p.user_id)).size,
    };
  };

  const maxOf = (xs) => Math.max(1, ...xs);

  const base = arr(validations).map(v => {
    const blueprint = arr(blueprints).find(b => b.id === v.role_blueprint_id) || null;
    const rowSources = arr(sources).filter(s => s.role_blueprint_id === v.role_blueprint_id);
    const matches = (r) => (v.experiment_id && r.experiment_id === v.experiment_id)
      || (v.blueprint_key && r.blueprint_key === v.blueprint_key);
    const rowReviews = arr(reviews).filter(matches);
    const level = strength
      ? strength({ validation: v, sources: rowSources, reviews: rowReviews }).validation_level
      : validationLevel({ validation: v, sources: rowSources, reviews: rowReviews });

    const usedExperimentIds = [...(byValidationId.get(v.id) || [])];
    const recommended = new Set();
    const selected = new Set();
    const runsPerStudent = new Map();
    usedExperimentIds.forEach(id => {
      const bucket = studentsByExperiment.get(id);
      bucket?.recommended.forEach(s => recommended.add(s));
      bucket?.selected.forEach(s => selected.add(s));
      const owner = realExperiments.find(e => e.id === id);
      const student = owner?.created_by_id || owner?.user_id;
      if (student) runsPerStudent.set(student, (runsPerStudent.get(student) || 0) + 1);
    });

    const careerTitle = blueprint?.career_title || null;
    const path = pathStudents(careerTitle);
    const dimensions = dimensionsOf(v);

    return {
      validation_id: v.id,
      experiment_id: v.experiment_id || null,
      blueprint_key: v.blueprint_key || null,
      title: v.experiment_title || v.experiment_id || 'Untitled experiment',
      experiment_version: Number(v.experiment_version || 1),
      validation_status: v.validation_status || 'draft',
      validation_level: level,
      path_id: blueprint?.path_id || null,
      career_title: careerTitle,
      role_blueprint_id: v.role_blueprint_id || null,
      dimensions,
      dimension_groups: groupsOf(dimensions),
      strategic_priority: Boolean(v.strategic_priority),
      priority_note: v.priority_note || null,
      counts: {
        recommended_students: recommended.size,
        selected_students: selected.size,
        runs: usedExperimentIds.length,
        students_who_ran_it_twice: [...runsPerStudent.values()].filter(n => n >= 2).length,
        path_students: path.students,
        path_primary_students: path.primary,
        verified_sources: rowSources.filter(s => s.active_status !== 'retired' && s.source_verified_at).length,
        approved_reviews: rowReviews.filter(r => r.approval_status === 'approved'
          && Number(r.experiment_version || 1) === Number(v.experiment_version || 1)).length,
      },
      usable: (v.validation_status || 'draft') !== 'retired',
    };
  });

  // Which major dimensions are already professionally covered on each Path, so
  // "fills an important dimension" means fills a GAP rather than repeats.
  const coveredByPath = new Map();
  base.forEach(r => {
    const key = r.career_title || 'unassigned';
    if (!coveredByPath.has(key)) coveredByPath.set(key, new Set());
    if (r.validation_level >= 2) r.dimensions.forEach(d => coveredByPath.get(key).add(d));
  });
  const experimentsPerPath = new Map();
  base.forEach(r => {
    const key = r.career_title || 'unassigned';
    if (r.usable) experimentsPerPath.set(key, (experimentsPerPath.get(key) || 0) + 1);
  });

  const maxRecommended = maxOf(base.map(r => r.counts.recommended_students));
  const maxSelected = maxOf(base.map(r => r.counts.selected_students));
  const maxPathStudents = maxOf(base.map(r => r.counts.path_students));

  const rows = base.map(r => {
    const key = r.career_title || 'unassigned';
    const covered = coveredByPath.get(key) || new Set();
    const majorGaps = r.dimensions.filter(d => dimensionMeta(d).major && !covered.has(d));

    const factors = {
      recommendation_frequency: clamp01(r.counts.recommended_students / maxRecommended),
      selection_frequency: clamp01(r.counts.selected_students / maxSelected),
      path_importance: clamp01(
        0.7 * (r.counts.path_students / maxPathStudents)
        + 0.3 * (r.counts.path_students ? r.counts.path_primary_students / r.counts.path_students : 0)),
      // A major dimension nothing reviewed on this Path covers yet is the whole
      // reason to spend a professional's hour here.
      dimension_fill: clamp01(
        (majorGaps.length ? 0.7 : 0)
        + 0.3 * clamp01(r.dimensions.length / 3)),
      // Distance from Multi-Professional Validated, with a retired or unusable
      // record scoring nothing: there is no point strengthening it.
      validation_weakness: r.usable ? clamp01((3 - Math.min(3, r.validation_level)) / 3) : 0,
      repeat_support: clamp01(
        0.5 * clamp01((experimentsPerPath.get(key) || 0) / 3)
        + 0.5 * clamp01(r.counts.students_who_ran_it_twice / 2)),
      strategic: r.strategic_priority ? 1 : 0,
    };

    const contributions = Object.fromEntries(
      Object.entries(factors).map(([k, value]) => [k, Math.round(value * WEIGHT[k])]));
    const score = Object.values(contributions).reduce((a, b) => a + b, 0);

    return {
      ...r,
      major_dimension_gaps: majorGaps,
      factors,
      factor_contributions: contributions,
      priority_score: score,
      // Already at the top of the ladder, so it is not a candidate.
      at_target: r.validation_level >= 3,
      next_target: r.validation_level >= 3 ? null : r.validation_level >= 2 ? 'multi_professional' : 'professional_reviewed',
      reasons: [
        r.counts.recommended_students
          ? `Recommended to ${r.counts.recommended_students} real student${r.counts.recommended_students === 1 ? '' : 's'}`
          : 'Not yet recommended to a real student',
        r.counts.selected_students
          ? `Selected by ${r.counts.selected_students} real student${r.counts.selected_students === 1 ? '' : 's'}`
          : 'Not yet selected by a real student',
        r.counts.path_students
          ? `${r.counts.path_students} real student${r.counts.path_students === 1 ? '' : 's'} carry this Path`
          : 'No real student currently carries this Path',
        majorGaps.length
          ? `Would cover ${majorGaps.map(d => dimensionMeta(d).label).join(', ')} on this Path for the first time`
          : 'Its dimensions are already professionally covered on this Path',
        r.validation_level >= 3
          ? 'Already multi-professional validated'
          : `Currently at validation level ${r.validation_level}, ${r.counts.approved_reviews} approved review${r.counts.approved_reviews === 1 ? '' : 's'}`,
        r.counts.students_who_ran_it_twice
          ? `${r.counts.students_who_ran_it_twice} student${r.counts.students_who_ran_it_twice === 1 ? '' : 's'} ran it more than once`
          : 'No repeat runs recorded yet',
      ],
    };
  }).sort((a, b) => b.priority_score - a.priority_score || a.title.localeCompare(b.title));

  return { rows, unattributed_experiments: unattributed };
}

/**
 * The shortlist: 5–8 experiments to validate first.
 *
 * The diversity rule is applied here rather than in the score, because it is a
 * rule about the SET rather than about any one experiment. Within one Path, an
 * experiment that repeats a dimension group already picked is skipped in the
 * first pass, so a Path contributes a core task, a decision and a human
 * interaction before it contributes a second work sample.
 */
export function validationShortlist(rows = [], { min = 5, max = 8, perPath = 3 } = {}) {
  const candidates = rows.filter(r => r.usable && !r.at_target && r.priority_score > 0);
  const picked = [];
  const groupsTaken = new Map(); // path → Set(group)
  const countByPath = new Map();

  const take = (row, reason) => {
    picked.push({ ...row, shortlist_reason: reason });
    const key = row.career_title || 'unassigned';
    countByPath.set(key, (countByPath.get(key) || 0) + 1);
    if (!groupsTaken.has(key)) groupsTaken.set(key, new Set());
    row.dimension_groups.forEach(g => groupsTaken.get(key).add(g));
  };

  // Pass one: highest scoring, but only where it adds a dimension group this
  // Path has not contributed yet.
  candidates.forEach(row => {
    if (picked.length >= max) return;
    const key = row.career_title || 'unassigned';
    if ((countByPath.get(key) || 0) >= perPath) return;
    const taken = groupsTaken.get(key) || new Set();
    const fresh = row.dimension_groups.filter(g => !taken.has(g));
    if (!row.dimension_groups.length || fresh.length) {
      take(row, fresh.length
        ? `Adds ${fresh.map(g => DIMENSION_GROUPS.find(x => x.id === g)?.label || g).join(' and ').toLowerCase()} coverage on this Path`
        : 'This Path has no reviewed coverage yet');
    }
  });

  // Pass two: fill up to the minimum with the next highest scoring, duplicate
  // groups allowed, so a small library still produces a working shortlist.
  candidates.forEach(row => {
    if (picked.length >= min) return;
    if (picked.some(p => p.validation_id === row.validation_id)) return;
    const key = row.career_title || 'unassigned';
    if ((countByPath.get(key) || 0) >= perPath) return;
    take(row, 'Next highest priority once distinct dimensions were covered');
  });

  return picked;
}

/**
 * Path Validation Coverage: the depth-before-breadth table.
 *
 * Everything counted here is a stored record. "Covered" means an experiment that
 * has reached Professionally Reviewed maps to that dimension — a draft claiming
 * to test something is not coverage.
 */
export function pathCoverage(rows = []) {
  const byPath = new Map();
  rows.forEach(r => {
    const key = r.career_title || 'Unassigned (no role blueprint)';
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(r);
  });

  return [...byPath.entries()].map(([career_title, group]) => {
    const usable = group.filter(r => r.usable);
    const sourceGrounded = usable.filter(r => r.validation_level >= 1);
    const reviewed = usable.filter(r => r.validation_level >= 2);
    const multi = usable.filter(r => r.validation_level >= 3);

    const coveredIds = [...new Set(reviewed.flatMap(r => r.dimensions))];
    const claimedIds = [...new Set(usable.flatMap(r => r.dimensions))];
    const missingMajor = MAJOR_DIMENSIONS.filter(d => !coveredIds.includes(d.id));
    const groups = groupsOf(coveredIds);

    return {
      career_title,
      path_id: group.find(r => r.path_id)?.path_id || null,
      students_on_path: Math.max(0, ...group.map(r => r.counts.path_students)),
      usable_experiments: usable.length,
      source_grounded: sourceGrounded.length,
      professionally_reviewed: reviewed.length,
      multi_professional_validated: multi.length,
      dimensions_covered: coveredIds.map(id => ({ id, label: dimensionMeta(id).label, group: dimensionMeta(id).group })),
      dimensions_claimed_not_reviewed: claimedIds
        .filter(id => !coveredIds.includes(id))
        .map(id => ({ id, label: dimensionMeta(id).label })),
      major_dimensions_missing: missingMajor.map(d => ({ id: d.id, label: d.label, group: d.group })),
      groups_covered: DIMENSION_GROUPS.filter(g => groups.includes(g.id)).map(g => ({ id: g.id, label: g.label })),
      groups_missing: DIMENSION_GROUPS.filter(g => !groups.includes(g.id)).map(g => ({ id: g.id, label: g.label })),
      // Depth before breadth, in one sentence per Path.
      verdict: reviewed.length === 0
        ? 'No professionally reviewed experiment on this Path yet.'
        : missingMajor.length > MAJOR_DIMENSIONS.length / 2
          ? 'Reviewed, but most major dimensions are still uncovered.'
          : groups.length >= 3
            ? 'Reviewed across several kinds of work.'
            : 'Reviewed, but the reviewed experiments test similar things.',
    };
  }).sort((a, b) => b.students_on_path - a.students_on_path
    || b.usable_experiments - a.usable_experiments
    || a.career_title.localeCompare(b.career_title));
}

export default validationQueue;