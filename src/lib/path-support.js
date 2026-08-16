/**
 * The Supported Path Gate.
 *
 * A student must never be shown a career direction as equally testable when the
 * infrastructure behind it cannot carry a full Unscripted cycle. Support is
 * DERIVED, never stored on the path: every input below is an existing record
 * (ExperimentTemplate, ExperimentValidation, RoleBlueprint, CareerSource,
 * ProfessionalExperimentReview), so a direction becomes supported the moment
 * those records exist and nothing about the student's own history is rewritten.
 *
 * Four states:
 *   fully_supported        can complete the cycle, professionally validated
 *   developing_validation  can complete the cycle, validation still developing
 *   developing             library covers it, but not enough to run a cycle on
 *   unsupported            no library coverage at all (includes legacy paths)
 *
 * Only the first two are testable. The other two are disclosed plainly and never
 * given a strength or learning-value reading they have not earned.
 */
import { base44 } from '@/api/base44Client';
import { matchTemplates } from '@/lib/experiment-library';
import { countingReviews } from '@/lib/experiment-strength';
import { CAREER_DIMENSIONS } from '@/lib/career-dimensions';
import { CAREERS } from '@/lib/career-library/careers';

const list = (rows) => (Array.isArray(rows) ? rows : []);
const norm = (s) => String(s || '').toLowerCase().trim();
const DIMENSION_IDS = new Set(CAREER_DIMENSIONS.map(d => d.id));

/** How many approved professional reviews a Fully Supported direction needs. */
export const REVIEW_THRESHOLD = 2;
/** Meaningfully different usable experiments required to run a cycle. */
export const MIN_USABLE_EXPERIMENTS = 2;
/** Important decision dimensions a blueprint must map. */
export const MIN_MAPPED_DIMENSIONS = 3;

export const SUPPORT_STATES = {
  fully_supported: {
    id: 'fully_supported',
    testable: true,
    badge: 'Ready to Test',
    detail: 'Verified sources, mapped work dimensions, and professional review on file.',
  },
  developing_validation: {
    id: 'developing_validation',
    testable: true,
    badge: 'Ready to Test',
    detail: 'You can run a full cycle on this. Professional validation of the experiments is still developing.',
  },
  developing: {
    id: 'developing',
    testable: false,
    badge: 'Experiment Library Developing',
    detail: 'Our library covers part of this direction, but not enough yet to run a full test cycle on it.',
  },
  unsupported: {
    id: 'unsupported',
    testable: false,
    badge: 'Experiment Library Developing',
    detail: 'We do not have experiments for this direction yet.',
  },
};

/** The one sentence shown when a student's strongest direction is unsupported. */
export const UNSUPPORTED_HEADLINE =
  'This direction looks worth exploring, but Unscripted\u2019s experiment library for it is still developing.';

/** A template that can actually carry a cycle end to end. */
function cycleCapable(t) {
  return Boolean(
    (t.instructions || []).length
    && t.deliverable
    && (t.evidence_required || []).length
    && (t.evaluation_criteria || []).length
    && (t.decision_dimension_ids || []).length,
  );
}

/** Dimensions a template claims, restricted to the evidence model's own ids. */
function templateDimensions(t) {
  return [...new Set([...(t.decision_dimension_ids || []), ...(t.work_characteristics_tested || [])]
    .map(x => norm(x).replace(/\s+/g, '_'))
    .filter(x => DIMENSION_IDS.has(x)))];
}

/**
 * Every stored record the gate reads, loaded once. Cheap enough to hold for a
 * session: it is library content, not student data.
 */
export async function loadSupportIndex() {
  const [templates, validations, blueprints, sources, reviews] = await Promise.all([
    base44.entities.ExperimentTemplate.filter({ status: 'published' }, '-created_date', 400).catch(() => []),
    base44.entities.ExperimentValidation.list('-created_date', 400).catch(() => []),
    base44.entities.RoleBlueprint.list('-created_date', 200).catch(() => []),
    base44.entities.CareerSource.list('-source_verified_at', 400).catch(() => []),
    base44.entities.ProfessionalExperimentReview.list('-review_date', 400).catch(() => []),
  ]);

  const validationByKey = new Map(list(validations).filter(v => v.blueprint_key).map(v => [v.blueprint_key, v]));
  const blueprintById = new Map(list(blueprints).map(b => [b.id, b]));
  const blueprintByTitle = new Map(list(blueprints).map(b => [norm(b.career_title), b]));

  const sourcesByBlueprint = new Map();
  list(sources).forEach(s => {
    if (s.active_status === 'retired' || !s.source_verified_at) return;
    const arr = sourcesByBlueprint.get(s.role_blueprint_id) || [];
    arr.push(s);
    sourcesByBlueprint.set(s.role_blueprint_id, arr);
  });

  const reviewsByKey = new Map();
  list(reviews).forEach(r => {
    if (!r.blueprint_key) return;
    const arr = reviewsByKey.get(r.blueprint_key) || [];
    arr.push(r);
    reviewsByKey.set(r.blueprint_key, arr);
  });

  return {
    templates: list(templates),
    validationByKey,
    blueprintById,
    blueprintByTitle,
    sourcesByBlueprint,
    reviewsByKey,
  };
}

/**
 * The support reading for one career direction, with every requirement stated so
 * the detail view can show what is present and what is missing.
 */
export function supportFor(pathName, index) {
  // Nothing on file is still an answer: every requirement is listed as unmet, so
  // the detail view says what is missing rather than showing an empty panel.
  const empty = {
    state: SUPPORT_STATES.unsupported,
    testable: false,
    careerTitle: null,
    usableCount: 0,
    reviewedCount: 0,
    requirements: [
      { id: 'blueprint', label: 'Role blueprint on file', met: false },
      { id: 'sources', label: 'Verified sources behind it', met: false, count: 0 },
      { id: 'dimensions', label: 'Important work dimensions mapped', met: false, count: 0 },
      { id: 'experiments', label: 'Two meaningfully different experiments', met: false, count: 0 },
      { id: 'cycle', label: 'An experiment that completes the full cycle', met: false },
      { id: 'strength', label: 'Experiment strength readable', met: false },
      { id: 'value', label: 'Learning value readable for you', met: false },
      { id: 'review', label: `Professional review (${REVIEW_THRESHOLD} needed)`, met: false, count: 0 },
    ],
    missing: ['Role blueprint on file'],
  };
  if (!index || !pathName) return empty;

  const matched = matchTemplates(index.templates, pathName);
  if (!matched.length) return empty;

  const careerTitle = matched[0].career_title;
  const validations = matched.map(t => index.validationByKey.get(t.blueprint_key) || null);
  const blueprint = validations.map(v => v?.role_blueprint_id && index.blueprintById.get(v.role_blueprint_id))
    .find(Boolean) || index.blueprintByTitle.get(norm(careerTitle)) || null;

  const verifiedSources = blueprint ? (index.sourcesByBlueprint.get(blueprint.id) || []) : [];
  const mappedDimensions = (blueprint?.characteristics || [])
    .filter(c => c.importance !== 'low' && DIMENSION_IDS.has(c.dimension)).length;

  // Meaningfully different: two templates testing the same dimension set are one
  // usable experiment for this purpose, not two.
  const usable = matched.filter(t => cycleCapable(t) && templateDimensions(t).length);
  const signatures = new Set(usable.map(t => templateDimensions(t).slice().sort().join('|')));
  const usableCount = signatures.size;
  const cycleReady = usable.length >= 1;

  const reviewedCount = Math.max(0, ...matched.map((t, i) =>
    countingReviews(index.reviewsByKey.get(t.blueprint_key) || [], validations[i]?.experiment_version).length));

  // Strength is only readable with a blueprint mapping plus a verified source or
  // an approved review; learning value needs mapped dimensions to compare against.
  const strengthAvailable = Boolean(blueprint) && (verifiedSources.length >= 1 || reviewedCount >= 1);
  const valueAvailable = usable.length >= 1;

  const requirements = [
    { id: 'blueprint', label: 'Role blueprint on file', met: Boolean(blueprint) },
    { id: 'sources', label: 'Verified sources behind it', met: verifiedSources.length >= 1, count: verifiedSources.length },
    { id: 'dimensions', label: 'Important work dimensions mapped', met: mappedDimensions >= MIN_MAPPED_DIMENSIONS, count: mappedDimensions },
    { id: 'experiments', label: 'Two meaningfully different experiments', met: usableCount >= MIN_USABLE_EXPERIMENTS, count: usableCount },
    { id: 'cycle', label: 'An experiment that completes the full cycle', met: cycleReady },
    { id: 'strength', label: 'Experiment strength readable', met: strengthAvailable },
    { id: 'value', label: 'Learning value readable for you', met: valueAvailable },
    { id: 'review', label: `Professional review (${REVIEW_THRESHOLD} needed)`, met: reviewedCount >= REVIEW_THRESHOLD, count: reviewedCount },
  ];

  const cycleRequirementsMet = Boolean(blueprint)
    && verifiedSources.length >= 1
    && mappedDimensions >= MIN_MAPPED_DIMENSIONS
    && usableCount >= MIN_USABLE_EXPERIMENTS
    && cycleReady
    && strengthAvailable
    && valueAvailable;

  const state = cycleRequirementsMet
    ? (reviewedCount >= REVIEW_THRESHOLD ? SUPPORT_STATES.fully_supported : SUPPORT_STATES.developing_validation)
    : SUPPORT_STATES.developing;

  return {
    state,
    testable: state.testable,
    careerTitle,
    usableCount,
    reviewedCount,
    verifiedSourceCount: verifiedSources.length,
    mappedDimensions,
    requirements,
    missing: requirements.filter(r => !r.met).map(r => r.label),
  };
}

/** Directions that ARE testable, closest in kind first. Never a forced switch. */
export function relatedSupportedCareers(path, index, { limit = 3 } = {}) {
  if (!index) return [];
  const family = norm(index.blueprintByTitle.get(norm(path?.path_name))?.career_family || path?.path_category);
  const supported = CAREERS
    .map(c => ({ career: c, support: supportFor(c.title, index) }))
    .filter(x => x.support.testable && norm(x.career.title) !== norm(path?.path_name));
  const sameFamily = supported.filter(x => family && norm(x.career.family) === family);
  const rest = supported.filter(x => !sameFamily.includes(x));
  return [...sameFamily, ...rest].slice(0, limit);
}

/** Counts by state across a set of paths, for reporting. */
export function supportCounts(paths = [], index) {
  const counts = { fully_supported: 0, developing_validation: 0, developing: 0, unsupported: 0 };
  paths.forEach(p => { counts[supportFor(p.path_name, index).state.id] += 1; });
  return counts;
}

export default supportFor;