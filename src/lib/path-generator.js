import { base44 } from '@/api/base44Client';
import { loadOwnedPaths, authoritativeSet, loadOnboardingSubmission } from '@/lib/path-set';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { validatePathSet, READINESS_MIN, READINESS_MAX } from '@/lib/path-validation';

/**
 * The stage a generation reached before it failed.
 *
 * Attached to every error this module throws and written to the console, so a
 * failure report says which half of the pipeline broke instead of "path
 * generation failed". A model timeout, a response the validator rejected, and a
 * database write that was refused are three different problems and used to look
 * identical.
 *
 * Nothing here or in the logged detail is derived from the student's profile or
 * the model's output — see the two error channels in path-validation.js.
 */
export const STAGES = {
  LOAD_PROFILE: 'load_profile',
  INVOKE_LLM: 'invoke_llm',
  VALIDATE: 'validate',
  SAVE_PATHS: 'save_paths',
  SAVE_EXPERIMENTS: 'save_experiments',
  SAVE_ROADMAP: 'save_roadmap',
  SAVE_AMBITION: 'save_ambition',
  ROLLBACK: 'rollback',
};

export class PathGenerationError extends Error {
  constructor(message, stage, { cause, codes = [] } = {}) {
    super(message);
    this.name = 'PathGenerationError';
    this.stage = stage;
    this.codes = codes;
    if (cause) this.cause = cause;
  }
}

/**
 * Log a failure by stage and cause-code only.
 *
 * Never pass a model response, a profile field, or a raw server message in
 * here. A generated path name is built from the student's own answers about
 * their life; it is not console material.
 */
function logStage(stage, codes = []) {
  console.error(`[path-gen] failed at stage=${stage}${codes.length ? ` codes=${codes.join(',')}` : ''}`);
}

/** How many times the model is asked, including the guided retry. */
const MAX_ATTEMPTS = 2;

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
    // Bounded here as well as in the validator. The schema is the cheap ask —
    // it costs a retry only when the model ignores it — and 261 live rows were
    // written before anything stated the scale at all.
    readiness_score: { type: 'number', minimum: READINESS_MIN, maximum: READINESS_MAX },
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
  let user, profile, primaryPath, comparisonPath, availableHours;

  try {
    user = await base44.auth.me();

    if (!force) {
      const { paths: ownedPaths } = await loadOwnedPaths();
      const existing = authoritativeSet(ownedPaths);
      if (existing && existing.paths.length === 3) return existing.paths;
    }

    const [profiles, schedules] = await Promise.all([
      base44.entities.StudentProfile.list('-created_date', 1),
      base44.entities.Schedule.list('-created_date', 1),
    ]);

    const schedule = schedules[0] || {};
    profile = profiles[0] || {};
    primaryPath = user.primary_path || profile.career_interests || 'undecided';
    comparisonPath = user.comparison_path || '';
    availableHours = profile.available_hours_per_week || schedule.available_hours_per_week || 8;
  } catch (e) {
    logStage(STAGES.LOAD_PROFILE);
    throw new PathGenerationError(
      'We could not load your answers. Please try again.',
      STAGES.LOAD_PROFILE,
      { cause: e }
    );
  }

  const hasPersonalNotes = profile.personal_notes || profile.long_term_ambitions || profile.responsibilities_constraints || profile.things_to_avoid || profile.priorities_for_recommendations;
  const personalNotesSection = hasPersonalNotes ? `

Additional context provided by the student (treat as context, not verified fact; do not override structured answers above):
${profile.personal_notes ? `- Personal notes: ${profile.personal_notes}` : ''}
${profile.long_term_ambitions ? `- Long-term ambitions: ${profile.long_term_ambitions}` : ''}
${profile.responsibilities_constraints ? `- Responsibilities/constraints: ${profile.responsibilities_constraints}` : ''}
${profile.things_to_avoid ? `- Things to avoid: ${profile.things_to_avoid}` : ''}
${profile.priorities_for_recommendations ? `- Priorities for recommendations: ${profile.priorities_for_recommendations}` : ''}` : '';

  const stageGuidance = `This student is an undergraduate (typically first-year or sophomore). Experiments may assume campus resources, alumni networks, coursework, clubs, and internship-adjacent access.`;

  const buildPrompt = (correction = '') => `You are Unscripted, a path-experimentation platform for undergraduate students. Your only job is to help this student test whether their chosen paths actually fit them.

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
- Future vision (5-10 years): ${profile.desired_lifestyle || 'Not specified'}${profile.vision_timeframe ? ` (timeframe: ${profile.vision_timeframe.replace('_', ' ')})` : ''}${Array.isArray(profile.vision_themes) && profile.vision_themes.length ? ` [themes: ${profile.vision_themes.join(', ')}]` : ''}
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

All three are required, all three must have a distinct path_name, and each needs a fit_reason.

The pressured path and the privately curious path are the two answers that make
the contrarian recommendation worth reading. Where a student named both, the
contrarian option should engage with the gap between them rather than ignore it.
Where they named neither, treat this as a normal contrarian pick.

"readiness_score" is on a ${READINESS_MIN}-${READINESS_MAX} scale, where ${READINESS_MAX} means the student could credibly pursue this path today and ${READINESS_MIN} means they are starting from nothing. It is not a fraction and not a percentage. A student who is roughly half-ready scores 5, never 0.5.

Then generate exactly 3 experiments for the PRIMARY path: "${primaryPath}". Every experiment must respect the education stage guidance above. Each experiment must be one of:
- Talk to people doing the work (informational interviews)
- Simulate or perform part of the work
- Build one tangible proof-of-work output

Every mission step must be an object with a title, a description and estimated_minutes as a number. A step written as a bare sentence is a failure.

Be honest about fit AND misfit. Do not claim any path is objectively correct. Fit the experiments to ${availableHours} available hours per week over 30 days. Each experiment should take no more than 8-12 hours total.${correction}
${PLAIN_PROSE_RULES}`;

  const responseSchema = {
    type: 'object',
    properties: {
      path_recommendations: {
        type: 'array',
        items: pathRecSchema,
        minItems: 3,
        maxItems: 3,
      },
      experiments: {
        type: 'array',
        items: experimentSchema,
      },
      feasibility_note: str,
      identity_statement: str,
      archetype: str,
    }
  };

  // The core Discover step — the 3 paths and first 3 experiments a student sees.
  // Highest-quality tier the app can afford to wait on; see src/lib/llm.js.
  //
  // Validated before anything is written, with one guided retry: the model
  // never sees its own previous output, so the rejection reasons are fed back
  // as instructions. Nothing partial is saved between attempts — a rejected
  // response costs a second model call and nothing else, which is the whole
  // point of validating before the first `create` rather than after it.
  let validation = null;
  let correction = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(correction),
        model: 'gemini_3_1_pro',
        response_json_schema: responseSchema,
      }));
    } catch (e) {
      logStage(STAGES.INVOKE_LLM);
      throw new PathGenerationError(
        'We could not reach the model that builds your paths. Please try again.',
        STAGES.INVOKE_LLM,
        { cause: e }
      );
    }

    validation = validatePathSet(raw);

    if (import.meta.env?.DEV && validation.warnings.length) {
      console.warn('[path-gen] repaired:', validation.warnings);
    }
    if (validation.ok) break;

    correction = `\n\nYour previous attempt was rejected for these reasons:\n${validation.errors
      .map(e => `- ${e}`)
      .join('\n')}\nFix every one of them.`;
  }

  if (!validation.ok) {
    // Only the codes are logged. The prose reasons can quote generated text,
    // which is derived from what the student told us about their life.
    logStage(STAGES.VALIDATE, validation.codes);
    throw new PathGenerationError(
      'Your results came back incomplete. Your answers are saved. Please try again.',
      STAGES.VALIDATE,
      { codes: validation.codes }
    );
  }

  const result = validation.data;

  // Save all records; track IDs so we can roll back on failure
  const savedRecIds = [];
  const savedExpIds = [];
  let savedRoadmapId = null;
  let savedAmbitionId = null;
  let stage = STAGES.SAVE_PATHS;

  try {
    // Stamp every row with the identifiers that let it be found again later:
    // the owner, the onboarding submission it came from, and the generation
    // event itself. Without these a returning student's set is unidentifiable.
    const submission = await loadOnboardingSubmission();
    const pathSetId = `ps_${user.id}_${Date.now()}`;
    const generatedAt = new Date().toISOString();
    // Exactly three, guaranteed by the validator — a set that reached here is
    // complete by definition, so nothing is ever written as "incomplete" again.
    const incoming = result.path_recommendations;

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
        generation_status: 'complete',
      }))
    );
    savedRecs.forEach(r => savedRecIds.push(r.id));

    stage = STAGES.SAVE_EXPERIMENTS;
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
      result.experiments.map(e => ({
        ...e,
        user_id: user.id,
        path_name: experimentPathName,
        path_recommendation_id: primaryRec?.id,
        status: 'planned',
        deadline: deadlineStr,
      }))
    );
    savedExps.forEach(e => savedExpIds.push(e.id));

    stage = STAGES.SAVE_ROADMAP;
    const roadmap = await base44.entities.Roadmap.create({
      title: `30-Day Path Test: ${primaryPath}`,
      // profile_id references the StudentProfile this roadmap was generated from.
      // Omit it rather than writing null when the student has no profile yet.
      ...(profile.id ? { profile_id: profile.id } : {}),
      thirty_day_plan: result.experiments.map((e, i) => ({
        week: `Week ${Math.floor(i * 10 / 7) + 1}`,
        focus: e.title,
        outcome: e.deliverable,
      })),
      feasibility_assessment: result.feasibility_note,
    });
    savedRoadmapId = roadmap.id;

    stage = STAGES.SAVE_AMBITION;
    const ambition = await base44.entities.AmbitionProfile.create({
      archetype: result.archetype || 'Path Explorer',
      identity_statement: result.identity_statement || `Testing ${primaryPath} to find the right fit.`,
      best_fit_paths: result.path_recommendations.map(r => r.path_name),
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
    logStage(stage);

    // Roll back any partially saved records to avoid duplicates on retry. A
    // rollback that itself fails leaves orphans the next attempt would sit
    // beside, so it gets its own line in the log rather than disappearing into
    // allSettled — the student sees the same message either way, but the two
    // states need different fixes.
    const undone = await Promise.allSettled([
      ...savedRecIds.map(id => base44.entities.PathRecommendations.delete(id)),
      ...savedExpIds.map(id => base44.entities.Experiments.delete(id)),
      savedRoadmapId ? base44.entities.Roadmap.delete(savedRoadmapId) : Promise.resolve(),
      savedAmbitionId ? base44.entities.AmbitionProfile.delete(savedAmbitionId) : Promise.resolve(),
    ]);
    const stuck = undone.filter(r => r.status === 'rejected').length;
    if (stuck) logStage(STAGES.ROLLBACK, [`orphans_${stuck}`]);

    throw new PathGenerationError(
      'We could not save your results. Your answers are saved. Please try again.',
      stage,
      { cause: saveError }
    );
  }
}