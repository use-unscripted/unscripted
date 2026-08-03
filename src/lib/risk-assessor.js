import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toEnum, LEVELS } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';

/** Thrown when the model's answer is not one of the two levels we asked for. */
export class RiskAssessmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RiskAssessmentError';
  }
}

/**
 * Auto-assess risk_level and confidence_level for a path using the user's profile.
 * Returns the updated PathRecommendation record.
 *
 * Both fields are enums on the entity and are read as enums everywhere: the
 * badges on the compare screen, the sort and filter controls, and the path
 * summary. "moderate" or "Medium" either gets refused by the entity or lands as
 * a value nothing matches, and the student sees a blank badge on a path that
 * had a correct one a moment earlier. So the write only happens when both
 * values are one of the three we asked for.
 */
export async function autoAssessPathRisk(path) {
  const [profiles, schedules] = await Promise.all([
    base44.entities.StudentProfile.list('-created_date', 1),
    base44.entities.Schedule.list('-created_date', 1),
  ]);

  const profile = profiles[0] || {};
  const schedule = schedules[0] || {};
  const availableHours = profile.available_hours_per_week || schedule.available_hours_per_week || 8;

  const buildPrompt = (correction = '') => `You are a career path advisor for college students. Based on this student's profile and the path details, assign a risk level and confidence level.

Student profile:
- Major: ${profile.major || 'Unknown'}
- Year: ${profile.school_year || 'Unknown'}
- Available hours/week: ${availableHours}
- Career interests: ${profile.career_interests || 'Not specified'}
- Desired lifestyle: ${profile.desired_lifestyle || 'Not specified'}
- Willing to take financial risk: ${profile.willing_financial_risk ? 'yes' : 'no'}
- Willing to work long hours early: ${profile.willing_long_hours ? 'yes' : 'no'}
- Priority scores: autonomy=${profile.priority_autonomy || 3}, stability=${profile.priority_stability || 3}, impact=${profile.priority_impact || 3}, creativity=${profile.priority_creativity || 3}, ownership=${profile.priority_ownership || 3}
${profile.current_skills ? `- Current skills: ${profile.current_skills}` : ''}
${profile.biggest_blocker ? `- Biggest blocker: ${profile.biggest_blocker}` : ''}

Path being assessed:
- Name: ${path.path_name}
- Category: ${path.path_category || 'Unknown'}
- Why it fits: ${path.why_it_fits || path.fit_reason || ''}
- Concern: ${path.why_it_may_not_fit || path.concern || ''}
- Skill gaps: ${(path.skill_gaps || path.current_gaps || []).join(', ') || 'None listed'}
- Lifestyle implications: ${path.lifestyle_implications || 'Not specified'}

Assess:
- risk_level: How risky is this path FOR THIS STUDENT given their profile, financial tolerance, time constraints, and skill gaps? (low/medium/high)
- confidence_level: How strongly does this student's profile align with success on this path? (low/medium/high)

Both values must be exactly one of: low, medium, high. Nothing else.
${PLAIN_PROSE_RULES}${correction}`;

  // Two enum labels plus reasoning the app never reads back: a classification,
  // not a piece of writing. Cheap tier; see src/lib/llm.js.
  const { ok, data } = await generateValidated({
    feature: 'risk_assessment',
    model: 'gemini_3_flash',
    context: { path_id: path.id },
    call: (correction) => unwrapLLM(base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt(correction),
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk_reasoning: { type: 'string' },
          confidence_reasoning: { type: 'string' },
        }
      }
    })),
    validate: (raw) => {
      const risk = toEnum(raw?.risk_level, LEVELS);
      const confidence = toEnum(raw?.confidence_level, LEVELS);
      if (risk && confidence) return { ok: true, data: { risk, confidence }, errors: [], codes: [] };

      // Which field, never the value. The value is generated from the
      // student's own profile answers.
      const errors = [];
      const codes = [];
      if (!risk) {
        errors.push('"risk_level" must be exactly one of: low, medium, high.');
        codes.push('risk_level_not_enum');
      }
      if (!confidence) {
        errors.push('"confidence_level" must be exactly one of: low, medium, high.');
        codes.push('confidence_level_not_enum');
      }
      return { ok: false, data: null, errors, codes };
    },
  });

  if (!ok) {
    throw new RiskAssessmentError('The assessment came back in a form we could not use. Nothing was changed.');
  }

  return base44.entities.PathRecommendations.update(path.id, {
    risk_level: data.risk,
    confidence_level: data.confidence,
  });
}