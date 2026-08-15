/**
 * Reading the validated experiment library for one student and one hypothesis.
 *
 * Two separate questions are answered here, and they are allowed to disagree:
 *
 *   Experiment Strength      how well validated the experiment is, for anyone.
 *                            Calculated from stored records only.
 *   Personal Learning Value  how much it would teach THIS student right now,
 *                            calculated from their remaining uncertainty.
 *
 * Low-data behaviour is explicit. A student with no completed experiments has no
 * behavioural evidence, so learning value is computed from their open dimensions,
 * their onboarding self-report and what the hypothesis itself turns on, and the
 * result is labelled as an early recommendation rather than presented as settled.
 *
 * A career with no blueprint in the library degrades honestly: `supported` comes
 * back false and the caller says so instead of inventing an experiment.
 */
import { base44 } from '@/api/base44Client';
import { experimentStrength } from '@/lib/experiment-strength';
import { personalLearningValue, bestNextTest } from '@/lib/personal-learning-value';
import { loadValidationContext, loadStudentEvidence } from '@/lib/experiment-validation-load';
import { CAREER_DIMENSIONS } from '@/lib/career-dimensions';

const list = (rows) => (Array.isArray(rows) ? rows : []);
const norm = (s) => String(s || '').toLowerCase();

/** Every published library template. */
export async function loadPublishedTemplates() {
  const rows = await base44.entities.ExperimentTemplate.filter({ status: 'published' }, '-created_date', 300).catch(() => []);
  return list(rows);
}

/**
 * The templates that belong to a career hypothesis, matched on the stored match
 * terms rather than on anything generated at read time.
 */
export function matchTemplates(templates, pathName) {
  const name = norm(pathName);
  if (!name) return [];
  const scored = templates
    .map(t => {
      const terms = [...(t.match_terms || []), norm(t.career_title)].map(norm).filter(Boolean);
      const hit = terms.filter(term => name.includes(term) || term.includes(name));
      const best = hit.sort((a, b) => b.length - a.length)[0] || null;
      return { t, score: best ? best.length : 0 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  // One career wins: the longest matched term decides, so "Healthcare Boutique
  // Investment Banking" does not pull in every career whose name is a substring.
  const winner = scored[0].t.career_key;
  return scored.filter(x => x.t.career_key === winner).map(x => x.t);
}

/** The dimensions the career itself turns on, from its blueprint. */
function blueprintDimensionIds(blueprint) {
  const ids = new Set(CAREER_DIMENSIONS.map(d => d.id));
  return (blueprint?.characteristics || [])
    .filter(c => c.importance !== 'low' && ids.has(c.dimension))
    .map(c => c.dimension);
}

/**
 * Everything needed to compare the library's experiments for one hypothesis.
 * Returns `{ supported, careerTitle, rows, best, early, evidence }`.
 */
export async function loadLibraryOptions({ pathName } = {}) {
  const [templates, evidence, validations] = await Promise.all([
    loadPublishedTemplates(),
    loadStudentEvidence(),
    base44.entities.ExperimentValidation.list('-created_date', 400).catch(() => []),
  ]);

  const matched = matchTemplates(templates, pathName);
  if (!matched.length) {
    return { supported: false, careerTitle: null, rows: [], best: null, early: null, evidence };
  }

  const byKey = new Map(list(validations).filter(v => v.blueprint_key).map(v => [v.blueprint_key, v]));

  const rows = await Promise.all(matched.map(async (template) => {
    const validation = byKey.get(template.blueprint_key) || null;
    const ctx = await loadValidationContext(validation, template);
    const strength = experimentStrength({ validation, ...ctx });

    // What this hypothesis turns on: the blueprint's own important
    // characteristics, plus whatever the student's live paths already signalled.
    const hypothesisDimensionIds = [
      ...new Set([...blueprintDimensionIds(ctx.blueprint), ...evidence.hypothesisDimensionIds]),
    ];
    const minutes = template.estimated_minutes_high || validation?.estimated_minutes_high || null;
    const value = personalLearningValue({
      validation,
      experiment: template,
      dimensions: evidence.dimensions,
      hypothesisDimensionIds,
      estimatedMinutes: minutes,
    });

    const important = (ctx.blueprint?.characteristics || []).filter(c => c.importance !== 'low').length;
    const covered = validation?.career_characteristics_represented?.length || 0;

    return {
      id: template.id,
      template,
      validation,
      ...ctx,
      strength,
      value,
      minutes,
      minutesLow: template.estimated_minutes_low || null,
      coverage: important ? Math.round((covered / important) * 100) : null,
      coveredCount: covered,
      importantCount: important,
      notRepresented: validation?.career_characteristics_not_represented || template.cannot_simulate || [],
      reviewerCount: strength.reviewer_count,
    };
  }));

  // bestNextTest keys on `experiment.id`; the template row carries its own id.
  const best = bestNextTest(rows.map(r => ({ ...r, experiment: { id: r.id, title: r.template.title } })));

  const behavioural = evidence.dimensions.reduce((n, d) => n + (d.behavioral_evidence_count || 0), 0);
  const stated = evidence.dimensions.filter(d => d.self_reported_preference).length;
  const early = behavioural === 0
    ? {
        label: 'Early recommendation',
        note: stated
          ? 'You have not completed an experiment yet, so this ranking is based on what this career turns on and what you told us during onboarding. It will change as soon as you have real evidence.'
          : 'You have not completed an experiment yet, so this ranking is based on what this career turns on rather than on anything you have tested. It will change as soon as you have real evidence.',
      }
    : null;

  return {
    supported: true,
    careerTitle: matched[0].career_title,
    careerKey: matched[0].career_key,
    rows,
    best,
    early,
    evidence,
    behaviouralEvidenceCount: behavioural,
  };
}

/**
 * Turn a library template into this student's own experiment, linked to the
 * hypothesis and the active cycle. The blueprint_key is what keeps the stored
 * validation record attached to it afterwards.
 */
export async function startExperimentFromTemplate(template, { path, cycle } = {}) {
  const me = await base44.auth.me().catch(() => null);
  return base44.entities.Experiments.create({
    user_id: me?.id || undefined,
    cycle_id: cycle?.id || undefined,
    path_id: path?.id || undefined,
    path_recommendation_id: path?.id || undefined,
    path_name: path?.path_name || undefined,
    career_name: template.career_title,
    blueprint_key: template.blueprint_key,
    career_key: template.career_key,
    template_id: template.id,
    design_source: 'validated_library',
    title: template.title,
    objective: template.what_it_tests,
    test_question: template.test_question,
    why_this_test_matters: template.why_it_matters,
    expected_learning: template.what_it_tests,
    decision_dimension_ids: template.decision_dimension_ids,
    work_characteristic_ids: template.decision_dimension_ids,
    work_characteristics_tested: template.work_characteristics_tested,
    evidence_requirements: template.evidence_required,
    evaluation_criteria: template.evaluation_criteria,
    realistic_scenario: template.realistic_scenario,
    instructions: template.instructions,
    deliverable: template.deliverable,
    proof_required: template.deliverable,
    effort: template.effort,
    estimated_hours: template.estimated_minutes_high ? Math.round((template.estimated_minutes_high / 60) * 10) / 10 : undefined,
    status: 'planned',
  });
}

export default loadLibraryOptions;