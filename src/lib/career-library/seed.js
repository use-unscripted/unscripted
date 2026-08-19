/**
 * Publishing the validated career library.
 *
 * Idempotent: every write is an upsert keyed on something stable (career title
 * for a blueprint, source name for a source, blueprint_key for a template and
 * its validation record), so this can be re-run whenever the content files
 * change without duplicating anything.
 *
 * What it deliberately never does:
 *  - It never creates ProfessionalExperimentReview rows. There are no reviews on
 *    file, so every experiment lands at validation level 1, Source Grounded, and
 *    Experiment Strength reflects that honestly.
 *  - It never writes a strength score. Strength is calculated at read time from
 *    the stored blueprint, sources, mapping and reviews.
 *
 * Admin only in practice: the RoleBlueprint, CareerSource, ExperimentTemplate
 * and ExperimentValidation entities all restrict writes to admins.
 */
import { base44 } from '@/api/base44Client';
import { CAREERS } from '@/lib/career-library/careers';
import { TEMPLATES } from '@/lib/career-library/templates';
import { purposeOf, convictionCoverage } from '../../../base44/shared/career-library/conviction-purposes.js';

export const LIBRARY_VERSION = 1;

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 };
const label = (id) => String(id).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

function blueprintFields(career) {
  return {
    career_title: career.title,
    career_family: career.family,
    seniority_scope: career.seniority_scope,
    blueprint_version: LIBRARY_VERSION,
    status: 'source_grounded',
    source_count: career.sources.length,
    professional_reviewer_count: 0,
    core_tasks: career.core_tasks,
    common_work_activities: career.core_tasks,
    typical_decisions: career.typical_decisions,
    common_deliverables: career.common_deliverables,
    tools_used: career.tools_used,
    skills_used: career.skills_used,
    work_environment: career.work_environment,
    work_schedule_notes: career.work_schedule_notes,
    entry_level_responsibilities: career.entry_level_responsibilities,
    common_misconceptions: career.common_misconceptions,
    cannot_be_simulated: career.cannot_be_simulated,
    characteristics: [...career.characteristics]
      .sort((a, b) => IMPORTANCE_ORDER[a[1]] - IMPORTANCE_ORDER[b[1]])
      .map(([dimension, importance, note, simulatable]) => ({
        dimension,
        dimension_label: label(dimension),
        importance,
        note,
        simulatable: simulatable !== false,
      })),
  };
}

/** Which important characteristics of the career this experiment does and does not cover. */
export function coverage(career, template) {
  const tested = new Set(template.dims);
  const important = career.characteristics.filter(c => c[1] !== 'low');
  return {
    represented: important.filter(c => tested.has(c[0])).map(c => c[0]),
    notRepresented: [
      ...important.filter(c => !tested.has(c[0])).slice(0, 6).map(c => label(c[0])),
      ...(template.cannot_simulate || []),
    ],
  };
}

export async function seedLibrary({ dryRun = false } = {}) {
  const [blueprints, sources, templates, validations, reviews] = await Promise.all([
    base44.entities.RoleBlueprint.list('-created_date', 500),
    base44.entities.CareerSource.list('-created_date', 1000),
    base44.entities.ExperimentTemplate.list('-created_date', 500),
    base44.entities.ExperimentValidation.list('-created_date', 500),
    base44.entities.ProfessionalExperimentReview.list('-created_date', 500).catch(() => []),
  ]);

  const blueprintByTitle = new Map((blueprints || []).map(b => [b.career_title, b]));
  const templateByKey = new Map((templates || []).map(t => [t.blueprint_key, t]));
  const validationByKey = new Map((validations || []).map(v => [v.blueprint_key, v]));
  const now = new Date().toISOString();

  const report = { careers: [], professional_reviews_on_file: (reviews || []).length, dryRun };

  // Careers run in parallel batches, and each career's sources and templates are
  // written together. Sequentially this is ~150 round trips and slow enough that
  // a single click could not finish it.
  const seedCareer = async (career) => {
    const mine = TEMPLATES.filter(t => t.career_key === career.key);
    const fields = blueprintFields(career);
    const existing = blueprintByTitle.get(career.title) || null;

    let blueprint = existing;
    if (!dryRun) {
      blueprint = existing
        ? await base44.entities.RoleBlueprint.update(existing.id, fields)
        : await base44.entities.RoleBlueprint.create(fields);
    }
    const blueprintId = blueprint?.id || null;

    await Promise.all(career.sources.map(async (s) => {
      const found = (sources || []).find(x => x.role_blueprint_id === blueprintId && x.source_name === s.source_name);
      const payload = {
        role_blueprint_id: blueprintId,
        source_type: s.source_type,
        source_name: s.source_name,
        source_url: s.source_url,
        source_verified_at: found?.source_verified_at || now,
        publicly_viewable: true,
        active_status: 'active',
        relevant_sections: ['Tasks', 'Work Activities', 'Work Context'],
      };
      if (dryRun) return;
      return found
        ? base44.entities.CareerSource.update(found.id, payload)
        : base44.entities.CareerSource.create(payload);
    }));
    const sourceCount = career.sources.length;

    const careerReport = {
      career_key: career.key,
      career_title: career.title,
      blueprint_id: blueprintId,
      blueprint_status: 'source_grounded',
      sources: sourceCount,
      professional_reviews: 0,
      /* Which conviction purposes this career's tests cover, and which are
         still open. An open purpose is reported rather than filled: a generic
         test would raise the count and teach nothing. */
      conviction_coverage: convictionCoverage(mine),
      experiments: [],
    };

    for (const t of mine) {
      const { represented, notRepresented } = coverage(career, t);

      const templatePayload = {
        blueprint_key: t.key,
        library_version: LIBRARY_VERSION,
        career_key: career.key,
        career_title: career.title,
        match_terms: career.match_terms,
        role_blueprint_id: blueprintId,
        title: t.title,
        // Which part of conviction this test can move. Never inferred.
        conviction_purpose: purposeOf(t) || undefined,
        test_question: t.test_question,
        why_it_matters: t.why_it_matters,
        what_it_tests: t.what_it_tests,
        cannot_simulate: t.cannot_simulate,
        decision_dimension_ids: t.dims,
        work_characteristics_tested: t.dims,
        estimated_minutes_low: t.minutes[0],
        estimated_minutes_high: t.minutes[1],
        effort: t.effort,
        realistic_scenario: t.realistic_scenario,
        instructions: t.instructions,
        deliverable: t.deliverable,
        evidence_required: t.evidence_required,
        human_component: t.human_component || null,
        evaluation_criteria: t.evaluation_criteria,
        status: 'published',
      };

      const validationPayload = {
        // A library template has no single student experiment row, so the
        // template key is its identity on both sides of the lookup.
        experiment_id: t.key,
        blueprint_key: t.key,
        experiment_title: t.title,
        experiment_version: LIBRARY_VERSION,
        role_blueprint_id: blueprintId,
        role_blueprint_version: LIBRARY_VERSION,
        decision_dimension_ids: t.dims,
        work_characteristics_tested: t.dims,
        career_characteristics_represented: represented,
        career_characteristics_not_represented: notRepresented,
        validation_scope: 'Mapped by the Unscripted team against a role blueprint grounded in published occupational sources. No professional reviewer has assessed this experiment yet.',
        what_it_does: t.what_it_tests,
        best_for: t.why_it_matters,
        estimated_minutes_low: t.minutes[0],
        estimated_minutes_high: t.minutes[1],
        mapping_reviewed: true,
        field_calibrated: false,
        validation_status: 'published',
        last_validated_at: now,
        validation_level: 1,
        source_version: LIBRARY_VERSION,
      };

      if (!dryRun) {
        const foundT = templateByKey.get(t.key);
        foundT
          ? await base44.entities.ExperimentTemplate.update(foundT.id, templatePayload)
          : await base44.entities.ExperimentTemplate.create(templatePayload);
        const foundV = validationByKey.get(t.key);
        foundV
          ? await base44.entities.ExperimentValidation.update(foundV.id, validationPayload)
          : await base44.entities.ExperimentValidation.create(validationPayload);
      }

      careerReport.experiments.push({
        blueprint_key: t.key,
        title: t.title,
        conviction_purpose: purposeOf(t),
        dimensions_tested: t.dims,
        estimated_minutes: t.minutes,
        validation_level: 1,
        validation_label: 'Source Grounded',
        professional_reviews: 0,
        human_component: Boolean(t.human_component),
        not_represented: notRepresented.length,
      });
    }

    report.careers.push(careerReport);
  };

  // Small batches: enough parallelism to finish inside one click, not enough to
  // hammer the API.
  for (let i = 0; i < CAREERS.length; i += 5) {
    await Promise.all(CAREERS.slice(i, i + 5).map(seedCareer));
  }

  report.totals = {
    careers: report.careers.length,
    experiments: report.careers.reduce((n, c) => n + c.experiments.length, 0),
    sources: report.careers.reduce((n, c) => n + c.sources, 0),
    professional_reviews_created: 0,
    balanced_careers: report.careers.filter(c => c.conviction_coverage.balanced).length,
    careers_with_open_purposes: report.careers.filter(c => !c.conviction_coverage.balanced).length,
  };
  return report;
}

export default seedLibrary;