import { base44 } from '@/api/base44Client';
import { unwrapLLM } from '@/lib/llm';

const stringArray = { type: 'array', items: { type: 'string' } };

const profileProps = {
  archetype: { type: 'string' },
  motivations: stringArray,
  best_fit_paths: stringArray,
  traditional_paths: stringArray,
  non_traditional_paths: stringArray,
  strengths: stringArray,
  weaknesses: stringArray,
  biggest_risk: { type: 'string' },
  biggest_opportunity: { type: 'string' },
  stop_doing: { type: 'string' },
  start_doing: { type: 'string' },
  identity_statement: { type: 'string' },
  primary_values: stringArray,
  risk_profile: { type: 'string' },
  decision_biases: stringArray,
  suggested_paths: stringArray,
  paths_to_deprioritize: stringArray,
};

const roadmapProps = {
  title: { type: 'string' },
  thirty_day_plan: {
    type: 'array',
    items: { type: 'object', properties: { week: { type: 'string' }, focus: { type: 'string' }, outcome: { type: 'string' } } }
  },
  semester_plan: {
    type: 'array',
    items: { type: 'object', properties: { phase: { type: 'string' }, goal: { type: 'string' } } }
  },
  skill_plan: stringArray,
  networking_plan: stringArray,
  personal_brand_plan: {
    type: 'object',
    properties: {
      niche: { type: 'string' },
      bio: { type: 'string' },
      audience: { type: 'string' },
      content_pillars: stringArray,
      post_ideas: stringArray,
      posting_schedule: { type: 'string' },
    }
  },
  startup_project_plan: {
    type: 'object',
    properties: {
      first_project: { type: 'string' },
      ideas: stringArray,
      communities: stringArray,
      skills: stringArray,
    }
  },
  wellness_plan: stringArray,
  feasibility_assessment: { type: 'string' },
  goal_conflicts: stringArray,
  goals_to_defer: stringArray,
  weekly_tasks: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        task_title: { type: 'string' },
        task_type: { type: 'string', enum: ['career', 'networking', 'content', 'project', 'skill', 'wellness', 'reflection'] },
        day: { type: 'string', enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        time: { type: 'string' }
      }
    }
  }
};

export async function generateAmbitionPlan() {
  const [profiles, schedules, goals] = await Promise.all([
    base44.entities.StudentProfile.list('-created_date', 1),
    base44.entities.Schedule.list('-created_date', 1),
    base44.entities.Goals.list('-created_date', 20),
  ]);

  const availableHours = schedules[0]?.available_hours_per_week || 8;

  const prompt = `You are Unscripted, a life-design and execution platform for ambitious college students. Your job is to help students determine which paths are worth exploring and build a realistic execution plan.

IMPORTANT PRINCIPLES:
- The student is the final decision-maker. You recommend and explain — you do not prescribe.
- Be honest about tradeoffs. Include both traditional and non-traditional paths where appropriate.
- A traditional career may be the right recommendation if it genuinely fits the student.
- Do not replace one script with another. Reveal options, clarify tradeoffs, recommend experiments.
- Fit the weekly plan to exactly ${availableHours} available hours. Do not over-assign.
- Generate a BRUTALLY HONEST feasibility assessment of their goals — name conflicts, unrealistic timelines, vague goals, and what should be deferred.
- Give 6-10 specific weekly tasks at specific available times that fit around their schedule.

Student profile: ${JSON.stringify(profiles[0])}
Schedule: ${JSON.stringify(schedules[0])}
Goals: ${JSON.stringify(goals)}`;

  // Summarises answers the student already gave into a profile and roadmap.
  // Stays in the app; nobody outside reads it. Cheap tier; see src/lib/llm.js.
  const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        profile: { type: 'object', properties: profileProps },
        roadmap: { type: 'object', properties: roadmapProps }
      }
    }
  }));

  const profile = await base44.entities.AmbitionProfile.create(result.profile);
  const roadmap = await base44.entities.Roadmap.create({ ...result.roadmap, profile_id: profile.id });
  await base44.entities.Task.bulkCreate(
    (result.roadmap.weekly_tasks || []).map(task => ({ ...task, roadmap_id: roadmap.id, completed: false }))
  );

  // Update goals with feasibility assessments
  if (result.roadmap.goals_to_defer?.length && goals.length) {
    const deferGoalTexts = result.roadmap.goals_to_defer;
    for (const goal of goals) {
      if (deferGoalTexts.some(d => goal.goal_text?.toLowerCase().includes(d.toLowerCase().slice(0, 20)))) {
        await base44.entities.Goals.update(goal.id, { feasibility_status: 'unrealistic', feasibility_note: 'Flagged by feasibility assessment' });
      }
    }
  }

  return roadmap;
}