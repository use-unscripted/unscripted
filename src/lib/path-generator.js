import { base44 } from '@/api/base44Client';

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

export async function generatePathTest() {
  const user = await base44.auth.me();
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

  const stage = profile.education_stage || user.education_stage || 'college';
  const isHighSchool = stage === 'high_school';

  const stageGuidance = isHighSchool
    ? `This student is in HIGH SCHOOL. Adapt accordingly:
- Assume no college coursework, professional network, or work experience.
- Experiments must be safe, legal for a minor, low-cost or free, and doable without a car or a workplace — e.g. interviewing adults with a parent/teacher aware, shadowing, school clubs, online research, small self-directed builds, volunteering.
- Never require internships, corporate access, professional certifications, or paid tools.
- Frame paths in terms of what to explore before choosing a college, major, or trade — not career commitments.`
    : `This student is in COLLEGE. Experiments may assume campus resources, alumni networks, coursework, clubs, and internship-adjacent access.`;

  const prompt = `You are Unscripted, a path-experimentation platform for high school and college students. Your only job is to help this student test whether their chosen paths actually fit them.

${stageGuidance}

Student profile:
- Name: ${profile.name || user.full_name || 'Student'}
- Education stage: ${isHighSchool ? 'High school student' : 'College student'}
- ${isHighSchool ? 'High school' : 'College'}: ${profile.college || user.college || 'Unknown'}
- ${isHighSchool ? 'Subjects of interest' : 'Major'}: ${profile.major || user.major || 'Unknown'}
- ${isHighSchool ? 'Grade' : 'Year'}: ${profile.school_year || user.school_year || 'Unknown'}
- Primary path to test: ${primaryPath}
- Comparison path: ${comparisonPath || 'none specified'}
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

Then generate exactly 3 experiments for the PRIMARY path: "${primaryPath}". Every experiment must respect the education stage guidance above. Each experiment must be one of:
- Talk to people doing the work (informational interviews)
- Simulate or perform part of the work  
- Build one tangible proof-of-work output

Be honest about fit AND misfit. Do not claim any path is objectively correct. Fit the experiments to ${availableHours} available hours per week over 30 days. Each experiment should take no more than 8–12 hours total.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
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
  });

  // Save all records; track IDs so we can roll back on failure
  const savedRecIds = [];
  const savedExpIds = [];
  let savedRoadmapId = null;
  let savedAmbitionId = null;

  try {
    const savedRecs = await base44.entities.PathRecommendations.bulkCreate(
      (result.path_recommendations || []).slice(0, 3).map(r => ({
        ...r,
        status: 'exploring',
      }))
    );
    savedRecs.forEach(r => savedRecIds.push(r.id));

    const experimentDeadline = new Date();
    experimentDeadline.setDate(experimentDeadline.getDate() + 30);
    const deadlineStr = experimentDeadline.toISOString().split('T')[0];

    const savedExps = await base44.entities.Experiments.bulkCreate(
      (result.experiments || []).slice(0, 3).map(e => ({
        ...normalizeExperiment(e),
        path_name: primaryPath,
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