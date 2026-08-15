/**
 * What a scenario has to carry before students see it, and what counts as a
 * change big enough to make it a different scenario.
 *
 * The publish rules exist so nothing in the library can quietly claim more than
 * it has: a workstyle scenario with a correct answer, or one option that is
 * obviously the good one, is not publishable. Neither is a performance question
 * without recorded scoring.
 */
import { DIMENSION_BY_ID } from '@/lib/career-dimensions';
import { isWorkstyle, isPerformance } from '@/lib/scenarios/scenario-signals';
import { hasValidatedScoring } from '@/lib/scenarios/scenario-performance';

/** Options that would tell a student which answer "belongs" to which career. */
const LEADING = /\b(consult(ing|ant)|banking|banker|the right answer|best answer|obviously|correct approach|give up|do nothing|ignore it)\b/i;

export function validateScenario(scenario, options = []) {
  const problems = [];

  if (!scenario?.title || !scenario?.scenario_text) problems.push('Needs a title and the scenario text.');
  if (!scenario?.source_type) problems.push('Needs a source it was grounded in.');
  if (!(scenario?.dimensions_intended || []).length) problems.push('Needs the decision dimensions it is meant to test.');
  (scenario?.dimensions_intended || []).forEach(d => {
    if (!DIMENSION_BY_ID.has(d)) problems.push(`Unknown decision dimension: ${d}`);
  });
  if (!scenario?.what_this_does_not_tell_us) problems.push('Needs a note on what this scenario does not tell us.');

  if (isWorkstyle(scenario)) {
    if (options.length < 3 || options.length > 5) problems.push('A workstyle scenario needs three to five plausible options.');
    if (options.some(o => o.is_correct === true)) problems.push('A workstyle scenario must not mark an option correct.');
    if (scenario.answer_key_option_id) problems.push('A workstyle scenario must not carry an answer key.');
    options.forEach((o, i) => {
      if (!(o.dimension_signal_mapping || []).length) problems.push(`Option ${i + 1} maps to no dimension.`);
      (o.dimension_signal_mapping || []).forEach(m => {
        if (!DIMENSION_BY_ID.has(m.dimension)) problems.push(`Option ${i + 1} maps to unknown dimension ${m.dimension}.`);
        if (m.signal_strength && !['weak', 'moderate'].includes(m.signal_strength)) {
          problems.push(`Option ${i + 1} claims signal strength "${m.signal_strength}". A scenario answer can only be weak or moderate.`);
        }
      });
      if (LEADING.test(o.option_text || '')) problems.push(`Option ${i + 1} gives away the intended answer or names a career.`);
    });
  }

  if (isPerformance(scenario) && !hasValidatedScoring(scenario, options)) {
    problems.push('A performance question needs its scoring recorded: an answer key or accepted range with an explanation, or rubric criteria with levels and an evaluation version.');
  }

  return { publishable: problems.length === 0, problems };
}

/** Fields whose change makes the old answers no longer comparable. */
const MATERIAL_FIELDS = [
  ['scenario_text', 'Scenario text'],
  ['scenario_type', 'Scenario type'],
  ['dimensions_intended', 'Dimensions tested'],
  ['answer_key_option_id', 'Answer key'],
  ['rubric_criteria', 'Rubric'],
];

const norm = (v) => (Array.isArray(v) || (v && typeof v === 'object') ? JSON.stringify(v) : String(v ?? ''));

/**
 * What changed between the published version and the edit in front of us, and
 * whether it is material. An option's text or dimension mapping changing counts:
 * a stored response points at an option id, and if that option now means
 * something else the response no longer means what it did.
 */
export function diffScenario({ before, after, beforeOptions = [], afterOptions = [] }) {
  const changes = [];

  MATERIAL_FIELDS.forEach(([field, label]) => {
    if (norm(before?.[field]) !== norm(after?.[field])) {
      changes.push({ field, label, before: norm(before?.[field]).slice(0, 200), after: norm(after?.[field]).slice(0, 200), material: true });
    }
  });

  const beforeById = new Map(beforeOptions.map(o => [o.id, o]));
  afterOptions.forEach(o => {
    const prev = beforeById.get(o.id);
    if (!prev) {
      changes.push({ field: 'options', label: 'Option added', before: '', after: (o.option_text || '').slice(0, 200), material: true });
      return;
    }
    if ((prev.option_text || '') !== (o.option_text || '')) {
      changes.push({ field: 'option_text', label: 'Option text', before: prev.option_text, after: o.option_text, material: true });
    }
    if (norm(prev.dimension_signal_mapping) !== norm(o.dimension_signal_mapping)) {
      changes.push({ field: 'dimension_signal_mapping', label: 'Option signals', before: norm(prev.dimension_signal_mapping).slice(0, 200), after: norm(o.dimension_signal_mapping).slice(0, 200), material: true });
    }
  });
  beforeOptions.forEach(o => {
    if (!afterOptions.some(a => a.id === o.id)) {
      changes.push({ field: 'options', label: 'Option removed', before: (o.option_text || '').slice(0, 200), after: '', material: true });
    }
  });

  const material = changes.some(c => c.material);
  return {
    changes,
    material,
    next_version: material ? (before?.version || 1) + 1 : (before?.version || 1),
    validation_status_after: material ? 'needs_rereview' : (before?.validation_status || 'draft'),
  };
}