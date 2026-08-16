import { base44 } from '@/api/base44Client';
import { loadOwnedPaths, authoritativeSet, loadOnboardingSubmission } from '@/lib/path-set';
import { trackPilotEvent } from '@/lib/pilot-metrics';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import {
  validatePathSet, pathRecSchema, experimentSchema, str,
  READINESS_MIN, READINESS_MAX,
} from '@/lib/path-validation';
import { logAiFailure } from '@/lib/ai-failures';
import { loadSupportIndex, supportFor } from '@/lib/path-support';
import { CAREERS } from '@/lib/career-library/careers';

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
function logStage(stage, codes = [], extra = {}) {
  console.error(`[path-gen] failed at stage=${stage}${codes.length ? ` codes=${codes.join(',')}` : ''}`);
  // Fire and forget. Recording a failure must never add a second failure.
  logAiFailure('path_generation', { stage, codes, model: 'gemini_3_1_pro', ...extra });
}

/** How many times the model is asked, including the guided retry. */
const MAX_ATTEMPTS = 2;

/**
 * Cap on problems carried into a retry prompt, a log line, or an analytics
 * event. Without it a pathological response makes all three unbounded.
 */
const MAX_REPORTED_PROBLEMS = 8;

/**
 * Generates the student's path set.
 *
 * Idempotent by default: if this student already owns a complete three-path set
 * it is returned untouched, so a refresh, a re-entered /claim-onboarding, or a
 * double-click cannot append a second set. Pass { force: true } only from an
 * explicit, user-confirmed retry — that writes a NEW set alongside the old one
 * and never overwrites it.
 */
/**
 * One generation at a time, per browser session.
 *
 * The idempotency check below only helps once a set exists. A refresh, a React
 * double-mount, or a second click while the first call is still running all pass
 * that check simultaneously and each write their own set — which is exactly how
 * the duplicate hypotheses in the data were made. Concurrent callers now share
 * the first call's promise.
 */
let generationInFlight = null;

export function generatePathTest(opts = {}) {
  if (opts.force) return runGeneration(opts);
  if (generationInFlight) return generationInFlight;
  generationInFlight = runGeneration(opts).finally(() => { generationInFlight = null; });
  return generationInFlight;
}

async function runGeneration({ force = false } = {}) {
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

  // Everything the intake collects about uncertainty and self-report. Named as
  // self-report in the prompt too, so the model cannot treat a stated
  // preference as demonstrated behaviour.
  const list = (v) => (Array.isArray(v) ? v : []);
  const drains = list(profile.self_reported_drains)
    .map(d => `${d.activity} (${String(d.response || '').replace(/_/g, ' ')})`);
  const values = list(profile.values_importance)
    .map(v => `${v.factor}: ${v.importance}/4`);
  const priors = list(profile.prior_experiences)
    .map(p => [p.kind, p.enjoyed && `enjoyed: ${p.enjoyed}`, p.disliked && `disliked: ${p.disliked}`, p.again && `would do again: ${p.again}`]
      .filter(Boolean).join('; '));

  const uncertaintySection = `
Where this student actually is (self-reported at intake, not measured):
- Certainty about what they want to do: ${profile.baseline_career_clarity ?? 'not recorded'}/10${typeof profile.baseline_confidence === 'number' ? ` (confidence in that answer: ${profile.baseline_confidence}/10)` : ''}
- Careers they are considering: ${list(profile.current_careers_considered).join(', ') || 'none named, which is normal and supported'}
- Careers they have ruled out: ${list(profile.careers_ruled_out).join(', ') || 'none named'}
- What they say they are most unsure about: ${list(profile.major_uncertainties).join(', ') || 'not recorded'}${profile.major_uncertainties_other ? ` (also: ${profile.major_uncertainties_other})` : ''}
- Decisions pressing on them now: ${list(profile.current_decision_pressure).join(', ') || 'not recorded'}
- Work setting they think they want: ${profile.work_setting_preference ? String(profile.work_setting_preference).replace(/_/g, ' ') : 'not recorded'}

Stated preferences (self-report, weak evidence, never treat as proven):
- Says these give energy: ${list(profile.self_reported_energizers).join(', ') || 'not recorded'}
- Reaction to specific activities: ${drains.join(' | ') || 'not recorded'}
- What they say matters, 1 to 4: ${values.join(', ') || 'not recorded'}
- Prior experience they have described: ${priors.join(' || ') || 'none described'}

Where an activity is marked "never experienced", that is an UNKNOWN, not a dislike.`;

  /* The Supported Path Gate, at generation time. Directions the library can
     actually carry a cycle on are PREFERRED, never forced: a genuinely poor-fit
     supported career is a worse recommendation than a well-fitting one whose
     experiment library is still developing, and the screens disclose the
     difference either way. Derived from stored records only. */
  let supportedTitles = [];
  try {
    const index = await loadSupportIndex();
    supportedTitles = CAREERS.filter(c => supportFor(c.title, index).testable).map(c => c.title);
  } catch { supportedTitles = []; }

  const supportedSection = supportedTitles.length ? `
Unscripted can currently run a full, validated test cycle on these directions:
${supportedTitles.map(t => `- ${t}`).join('\n')}

Prefer these where one genuinely fits what this student told us, because the
student can start testing immediately. Do NOT force a poor fit from that list:
if the strongest direction for this student is not on it, recommend the strong
direction anyway. The product tells the student plainly when the experiment
library for a direction is still developing.` : '';

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
- Willing to work long hours early: ${profile.willing_long_hours ? 'yes' : 'no'}${uncertaintySection}${personalNotesSection}${supportedSection}

TASK: Generate exactly 3 CAREER HYPOTHESES. A career hypothesis is a direction
worth testing, never a prediction of what this student should become.

Synthesise all of it: interests, apparent strengths, stated values, dislikes,
lifestyle preferences, constraints, prior experience, how uncertain they are, and
what they do not know about themselves yet.

The three must offer real contrast. Vary them along at least two of these:
work style, working environment, level of structure, people-facing versus
analytical orientation, risk profile. Three variations on the same job title is a
failed answer, even when the student's answers all point one way. Use
"contrast_role" to state the contrast each one provides in a few words.

Every hypothesis needs BOTH:
- "fit_reason": why this may fit, tied to specific things they told us.
- "concern": why this may NOT fit. Never omit it and never soften it.

Also for every hypothesis:
- "what_we_know": 2 to 4 things their own answers establish. Say where each comes
  from in the sentence itself. Never state anything they did not tell us.
- "assumptions": 2 to 4 untested beliefs this hypothesis rests on.
- "unknowns": 3 to 6 questions that can only be answered by real experience, not
  by another questionnaire. Each needs "question" and "why_it_matters". Write
  them about this student ("Do you actually enjoy…"), about the specific work,
  and make each one testable in a few hours.
- "confidence_level" plus "confidence_explanation". Confidence means HOW MUCH
  EVIDENCE currently supports this hypothesis, not how likely they are to
  succeed. Nothing has been tested yet, so use "low" unless their prior
  experience genuinely covers this work, in which case "medium". Never "high".

Banned, because none of it is defensible before any evidence exists: perfect
career, best career, ideal profession, guaranteed fit, and any percentage match.

Where they named a pressured path and a privately curious path, one hypothesis
should engage with the gap between them rather than ignore it. Where they named
no career at all, that is a normal starting point: build all three from their
energy, values, dislikes and unknowns instead.

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
  const rejectedCodes = [];

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
    if (validation.ok) {
      if (attempt > 0) {
        // The student never saw this. It is still the model drifting, and this
        // is the highest-volume generation in the app, so without this row the
        // "recovered on retry" signal would be blind exactly where it matters.
        logAiFailure('path_generation', {
          stage: STAGES.VALIDATE,
          codes: rejectedCodes,
          attempts: attempt + 1,
          recovered: true,
          model: 'gemini_3_1_pro',
        });
      }
      break;
    }

    rejectedCodes.push(...validation.codes);

    // Capped. Nothing bounds how many problems one response can have, and an
    // uncapped list would put the whole of a bad response back into the retry
    // prompt. The first few are what a retry actually needs.
    correction = `\n\nYour previous attempt was rejected for these reasons:\n${validation.errors
      .slice(0, MAX_REPORTED_PROBLEMS)
      .map(e => `- ${e}`)
      .join('\n')}\nFix every one of them.`;
  }

  if (!validation.ok) {
    // Only the codes are logged, and only the first few. The prose reasons can
    // quote generated text, which is derived from what the student told us
    // about their life.
    const codes = [...new Set([...rejectedCodes, ...validation.codes])].slice(0, MAX_REPORTED_PROBLEMS);
    logStage(STAGES.VALIDATE, codes, { attempts: MAX_ATTEMPTS, recovered: false });
    throw new PathGenerationError(
      'Your results came back incomplete. Your answers are saved, please try again.',
      STAGES.VALIDATE,
      { codes }
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
    // Last check before writing. The model call takes ~30 seconds; another tab
    // or a retry could have completed a set in that window, and appending a
    // second one is the duplicate this whole pass exists to prevent.
    if (!force) {
      const { paths: nowOwned } = await loadOwnedPaths();
      const raced = authoritativeSet(nowOwned);
      if (raced && raced.paths.length === 3) return raced.paths;
    }
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
      incoming.map(({ unknowns, ...r }, i) => ({
        ...r,
        // The hypothesis view of the same row: why it may and may not fit, and
        // the questions testing is meant to answer. Stored once, at generation,
        // so a returning student sees the hypotheses they were given.
        why_this_may_fit: r.fit_reason,
        why_it_may_not_fit: r.concern,
        // The model returns plain sentences; the field stores each one with the
        // source it came from, which is the intake in every case here.
        what_we_know: (r.what_we_know || []).map(text => ({ text, source: 'Your onboarding answers' })),
        unresolved_questions: unknowns,
        hypothesis_status: 'untested',
        hypothesis_status_changed_at: generatedAt,
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