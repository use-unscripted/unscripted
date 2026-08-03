import { base44 } from '@/api/base44Client';
import { loadOwnedPaths, authoritativeSet, loadOnboardingSubmission } from '@/lib/path-set';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import { unwrapLLM } from '@/lib/llm';

const str = { type: 'string' };
const strArr = { type: 'array', items: { type: 'string' } };

const missionStepSchema = {
  type: 'object',
  properties: {
    order: { type: 'number' },
    title: { type: 'string' },
    description: { type: 'string' },
    estimated_minutes: { type: 'number' },
    status: { type: 'string' },
    proof_required: { type: 'string' },
  }
};

const pathRecSchema = {
  type: 'object',
  properties: {
    path_name: str,
    fit_reason: str,
    concern: str,
    lifestyle_implications: str,
    main_tradeoffs: str,
    readiness_score: { type: 'number' },
    confidence_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    current_gaps: strArr,
    first_experiment: str,
    path_fit_signals: strArr,
  }
};

const experimentSchema = {
  type: 'object',
  properties: {
    title: str,
    objective: str,
    why_recommended: str,
    expected_learning: str,
    estimated_hours: { type: 'number' },
    deliverable: str,
    completion_criteria: str,
    proof_required: str,
    mission_steps: { type: 'array', items: missionStepSchema },
    reflection_questions: strArr,
    common_mistakes: strArr,
    alternative_version: str,
  }
};

// Normalize a single mission step: if it's a string, convert to a valid object
function normalizeMissionStep(step, index) {
  if (typeof step === 'string') {
    return {
      order: index + 1,
      title: step,
      description: step,
      estimated_minutes: 30,
      status: 'not_started',
      proof_required: '',
    };
  }
  // It's already an object — fill in any missing required fields
  return {
    order: step.order ?? index + 1,
    title: step.title || `Step ${index + 1}`,
    description: step.description || step.title || `Step ${index + 1}`,
    estimated_minutes: step.estimated_minutes ?? 30,
    status: step.status || 'not_started',
    proof_required: step.proof_required || '',
  };
}

function normalizeExperiment(exp) {
  return {
    ...exp,
    mission_steps: Array.isArray(exp.mission_steps)
      ? exp.mission_steps.map(normalizeMissionStep)
      : [],
    reflection_questions: Array.isArray(exp.reflection_questions) ? exp.reflection_questions : [],
    common_mistakes: Array.isArray(exp.common_mistakes) ? exp.common_mistakes : [],
  };
}

/**
 * Generates the student's path set.
 *
 * Idempotent by default: if this student already owns a complete three-path set
 * it is returned untouched, so a refresh, a re-entered /claim-onboarding, or a
 * double-click cannot append a second set. Pass { force: true } only from an
 * explicit, user-confirmed retry — that writes a NEW set alongside the old one
 * and never overwrites it.
 */
export async function generatePathTest({ force = false } = {}) {
  const user = await base44.auth.me();

  if (!force) {
    const { paths: ownedPaths } = await loadOwnedPaths();
    const existing = authoritativeSet(ownedPaths);
    if (existing && existing.paths.length === 3) return existing.paths;
  }

  const [profiles, schedules] = await Promise.all([
    base44.entities.StudentProfile.list('-created_date', 1),
    base44.entities.Schedule.list('-created_date', 1),
  ]);

  const profile = profiles[0] || {};
  const schedule = schedules[0] || {};
  const primaryPath = user.primary_path || profile.career_interests || 'undecided';
  const comparisonPath = user.comparison_path || '';
  const availableHours = profile.available_hours_per_week || schedule.available_hours_per_week || 8;

  const hasPersonalNotes = profile.personal_notes || profile.long_term_ambitions || profile.responsibilities_constraints || profile.things_to_avoid || profile.priorities_for_recommendations;
  const personalNotesSection = hasPersonalNotes ? `

Additional context provided by the student (treat as context, not verified fact — do not override structured answers above):
${profile.personal_notes ? `- Personal notes: ${profile.personal_notes}` : ''}
${profile.long_term_ambitions ? `- Long-term ambitions: ${profile.long_term_ambitions}` : ''}
${profile.responsibilities_constraints ? `- Responsibilities/constraints: ${profile.responsibilities_constraints}` : ''}
${profile.things_to_avoid ? `- Things to avoid: ${profile.things_to_avoid}` : ''}
${profile.priorities_for_recommendations ? `- Priorities for recommendations: ${profile.priorities_for_recommendations}` : ''}` : '';

  const stageGuidance = `This student is an undergraduate (typically first-year or sophomore). Experiments may assume campus resources, alumni networks, coursework, clubs, and internship-adjacent access.`;

  const prompt = `You are Unscripted, a path-experimentation platform for undergraduate students. Your only job is to help this student test whether their chosen paths actually fit them.

${stageGuidance}

Student profile:
- Name: ${profile.name || user.full_name || 'Student'}
- College: ${profile.college || user.college || 'Unknown'}
- Major: ${profile.major || user.major || 'Unknown'}
- Year: ${profile.school_year || user.school_year || 'Unknown'}
- Primary path to test: ${primaryPath}
- Comparison path: ${comparisonPath || 'none specified'}
- Path they feel most pressure to pursue: ${profile.pressured_paths || 'Not specified'}
- Path they are privately curious about: ${profile.secret_paths || 'Not specified'}
- Future vision (5–10 years): ${profile.desired_lifestyle || 'Not specified'}${profile.vision_timeframe ? ` (timeframe: ${profile.vision_timeframe.replace('_', ' ')})` : ''}${Array.isArray(profile.vision_themes) && profile.vision_themes.length ? ` [themes: ${profile.vision_themes.join(', ')}]` : ''}
- Biggest blocker: ${profile.biggest_blocker || 'Not specified'}
- Fixed commitments: ${profile.commitments || 'Not specified'}
- Available hours/week: ${availableHours}
- Priority scores: autonomy=${profile.priority_autonomy || 3}, stability=${profile.priority_stability || 3}, impact=${profile.priority_impact || 3}, creativity=${profile.priority_creativity || 3}, ownership=${profile.priority_ownership || 3}
- Willing to take financial risk: ${profile.willing_financial_risk ? 'yes' : 'no'}
- Willing to work long hours early: ${profile.willing_long_hours ? 'yes' : 'no'}${personalNotesSection}

TASK: Generate exactly 3 path recommendations:
1. Best apparent fit (based on their profile)
2. Strong alternative (different but viable)
3. Contrarian option (challenges their default assumptions)

The pressured path and the privately curious path are the two answers that make
the contrarian recommendation worth reading. Where a student named both, the
contrarian option should engage with the gap between them rather than ignore it.
Where they named neither, treat this as a normal contrarian pick.

Then generate exactly 3 experiments for the PRIMARY path: "${primaryPath}". Every experiment must respect the education stage guidance above. Each experiment must be one of:
- Talk to people doing the work (informational interviews)
- Simulate or perform part of the work  
- Build one tangible proof-of-work output

Be honest about fit AND misfit. Do not claim any path is objectively correct. Fit the experiments to ${availableHours} available hours per week over 30 days. Each experiment should take no more than 8–12 hours total.`;

  // The core Discover step — the 3 paths and first 3 experiments a student sees.
  // Highest-quality tier the app can afford to wait on; see src/lib/llm.js.
  const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'gemini_3_1_pro',
    response_json_schema: {
      type: 'object',
      properties: {
        path_recommendations: {
          type: 'array',
          items: pathRecSchema,
        },
        experiments: {
          type: 'array',
          items: experimentSchema,
        },
        feasibility_note: str,
        identity_statement: str,
        archetype: str,
      }
    }
  }));

  // Save all records; track IDs so we can roll back on failure
  const savedRecIds = [];
  const savedExpIds = [];
  let savedRoadmapId = null;
  let savedAmbitionId = null;

  try {
    // Stamp every row with the identifiers that let it be found again later:
    // the owner, the onboarding submission it came from, and the generation
    // event itself. Without these a returning student's set is unidentifiable.
    const submission = await loadOnboardingSubmission();
    const pathSetId = `ps_${user.id}_${Date.now()}`;
    const generatedAt = new Date().toISOString();
    const incoming = (result.path_recommendations || []).slice(0, 3);
    const setStatus = incoming.length === 3 ? 'complete' : 'incomplete';

    // The first recommendation is the best-fit slot by construction — the prompt asks for
    // best fit, strong alternative, contrarian, in that order. Mark it as the primary
    // focus: nothing else in the generate flow does, and the dashboard reads its headline
    // straight off is_primary_focus, so without this every student who has just finished
    // generating lands on "No primary path set / No path selected yet".
    const savedRecs = await base44.entities.PathRecommendations.bulkCreate(
      incoming.map((r, i) => ({
        ...r,
        status: 'exploring',
        is_primary_focus: i === 0,
        user_id: user.id,
        onboarding_submission_id: submission?.id || profile.id || '',
        path_set_id: pathSetId,
        generated_at: generatedAt,
        generation_status: setStatus,
      }))
    );
    savedRecs.forEach(r => savedRecIds.push(r.id));

    const experimentDeadline = new Date();
    experimentDeadline.setDate(experimentDeadline.getDate() + 30);
    const deadlineStr = experimentDeadline.toISOString().split('T')[0];

    // Tag the experiments with the primary recommendation's own name, not the intake label.
    // Every path-to-experiment linkage in the app is a `path_name` string match against
    // PathRecommendations (dashboard, path comparison, missions, outreach, reflection,
    // proof). The intake label is a generic bucket — "Marketing / brand" — while the
    // recommendation carries a generated name like "Digital Brand Strategist for Boutique
    // Agencies", so the two have never matched and none of those views ever linked up.
    const primaryRec = savedRecs[0];
    const experimentPathName = primaryRec?.path_name || primaryPath;

    const savedExps = await base44.entities.Experiments.bulkCreate(
      (result.experiments || []).slice(0, 3).map(e => ({
        ...normalizeExperiment(e),
        user_id: user.id,
        path_name: experimentPathName,
        path_recommendation_id: primaryRec?.id,
        status: 'planned',
        deadline: deadlineStr,
      }))
    );
    savedExps.forEach(e => savedExpIds.push(e.id));

    const roadmap = await base44.entities.Roadmap.create({
      title: `30-Day Path Test: ${primaryPath}`,
      // profile_id references the StudentProfile this roadmap was generated from.
      // Omit it rather than writing null when the student has no profile yet.
      ...(profile.id ? { profile_id: profile.id } : {}),
      thirty_day_plan: (result.experiments || []).map((e, i) => ({
        week: `Week ${Math.floor(i * 10 / 7) + 1}`,
        focus: e.title,
        outcome: e.deliverable,
      })),
      feasibility_assessment: result.feasibility_note || '',
    });
    savedRoadmapId = roadmap.id;

    const ambition = await base44.entities.AmbitionProfile.create({
      archetype: result.archetype || 'Path Explorer',
      identity_statement: result.identity_statement || `Testing ${primaryPath} to find the right fit.`,
      best_fit_paths: (result.path_recommendations || []).map(r => r.path_name),
      motivations: [],
      strengths: [],
    });
    savedAmbitionId = ambition.id;

    // Keep the one-primary invariant the rest of the app assumes. Only runs for a student
    // who already had paths (an explicit forced regeneration) — done last, so a failure
    // above rolls back without having touched anything they already had.
    const newIds = new Set(savedRecIds);
    const stalePrimaries = (await base44.entities.PathRecommendations.list('-created_date', 100)
      .catch(() => []))
      .filter(p => p.is_primary_focus && !newIds.has(p.id));
    await Promise.allSettled(
      stalePrimaries.map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false }))
    );

    await trackPilotEvent('paths_generated', { value: savedRecs.length, dedupe_key: pathSetId });

    return savedRecs;
  } catch (saveError) {
    // Roll back any partially saved records to avoid duplicates on retry
    await Promise.allSettled([
      ...savedRecIds.map(id => base44.entities.PathRecommendations.delete(id)),
      ...savedExpIds.map(id => base44.entities.Experiments.delete(id)),
      savedRoadmapId ? base44.entities.Roadmap.delete(savedRoadmapId) : Promise.resolve(),
      savedAmbitionId ? base44.entities.AmbitionProfile.delete(savedAmbitionId) : Promise.resolve(),
    ]);
    throw saveError;
  }
}