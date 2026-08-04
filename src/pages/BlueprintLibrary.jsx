import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList, isPlainObject } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';
import { reportAiFailure } from '@/lib/ai-failures';
import { Hammer, Rocket, Dumbbell, Bot, Zap, Newspaper, TrendingUp, Target } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BlueprintCard from '@/components/blueprints/BlueprintCard';
import BlueprintDetail from '@/components/blueprints/BlueprintDetail';

const BLUEPRINTS = [
  { id: 'builder-creator', label: 'Builder-Creator Path', Icon: Hammer, summary: 'Document your learning, build an audience, and turn online trust into career or startup opportunities.' },
  { id: 'student-founder', label: 'Student Founder Path', Icon: Rocket, summary: 'Validate and launch a startup while still in school using your network and academic access.' },
  { id: 'fitness-discipline', label: 'Fitness & Discipline Creator', Icon: Dumbbell, summary: 'Turn physical discipline into a personal brand, coaching business, or content career.' },
  { id: 'ai-tool-builder', label: 'AI Tool Builder Path', Icon: Bot, summary: 'Build and ship AI-powered tools and products to create proof of work and real revenue.' },
  { id: 'brand-to-startup', label: 'Personal Brand to Startup', Icon: Zap, summary: 'Grow an audience first, then launch a product or service your followers already want.' },
  { id: 'newsletter-media', label: 'Newsletter / Media Builder', Icon: Newspaper, summary: 'Build a niche media property (newsletter, podcast, or YouTube) that becomes a platform and business.' },
  { id: 'finance-business', label: 'Finance & Business Creator', Icon: TrendingUp, summary: 'Use finance and business knowledge to build credibility, a brand, and career leverage online.' },
  { id: 'high-agency-student', label: 'High-Agency Student Path', Icon: Target, summary: 'Maximize every year of college by stacking experiences, skills, and proof of work deliberately.' },
];

/**
 * Coerce a generated playbook into the shape the detail view renders.
 *
 * Nothing here is saved and no student data goes in, so there is nothing to
 * reject: the only real failure is a type that throws mid-render. Every list
 * the view calls `.map` on is forced to an array of strings, and the 30-day
 * plan's nested `actions` array gets the same treatment one level down.
 */
export function repairBlueprint(raw) {
  if (!isPlainObject(raw)) return null;
  return {
    what_this_path_means: toText(raw.what_this_path_means),
    who_it_fits: toText(raw.who_it_fits),
    skills_required: toTextList(raw.skills_required),
    content_strategy: toText(raw.content_strategy),
    weekly_actions: toTextList(raw.weekly_actions),
    first_project_idea: toText(raw.first_project_idea),
    networking_strategy: toText(raw.networking_strategy),
    monetization_paths: toTextList(raw.monetization_paths),
    mistakes_to_avoid: toTextList(raw.mistakes_to_avoid),
    thirty_day_plan: (Array.isArray(raw.thirty_day_plan) ? raw.thirty_day_plan : [])
      .filter(isPlainObject)
      .map(w => ({
        week: toText(w.week),
        focus: toText(w.focus),
        actions: toTextList(w.actions),
      })),
  };
}

export default function BlueprintLibrary() {
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openBlueprint = async (bp) => {
    setSelected(bp);
    setDetail(null);
    setError('');
    setLoading(true);
    try {
    // Generic reference content for six fixed blueprints — no student data goes
    // in and nothing is personalised. Cheap tier; see src/lib/llm.js.
      const { ok, data } = await generateValidated({
        feature: 'blueprint',
        model: 'gemini_3_flash',
        validate: (raw) => {
          const repaired = repairBlueprint(raw);
          if (repaired?.what_this_path_means || repaired?.weekly_actions.length) {
            return { ok: true, data: repaired, errors: [], codes: [] };
          }
          return {
            ok: false,
            data: null,
            errors: ['You returned no usable playbook. Every field in the schema must be filled in, and the list fields must be arrays of plain strings.'],
            codes: ['blueprint_empty'],
          };
        },
        call: async (correction) => unwrapLLM(await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `You are Unscripted, a life-design and execution platform for ambitious college students. Generate a detailed, actionable playbook for the "${bp.label}" path. Be specific and practical. No generic advice. Focus on what a college student can actually do today. Include honest tradeoffs.

Every list field must be an array of plain strings. An item returned as an object is a failure.
${PLAIN_PROSE_RULES}${correction}`,
      response_json_schema: {
        type: 'object',
        properties: {
          what_this_path_means: { type: 'string' },
          who_it_fits: { type: 'string' },
          skills_required: { type: 'array', items: { type: 'string' } },
          content_strategy: { type: 'string' },
          weekly_actions: { type: 'array', items: { type: 'string' } },
          first_project_idea: { type: 'string' },
          networking_strategy: { type: 'string' },
          monetization_paths: { type: 'array', items: { type: 'string' } },
          mistakes_to_avoid: { type: 'array', items: { type: 'string' } },
          thirty_day_plan: { type: 'array', items: { type: 'object', properties: { week: { type: 'string' }, focus: { type: 'string' }, actions: { type: 'array', items: { type: 'string' } } } } },
        }
      }
    })),
      });

      if (ok) setDetail(data);
      else setError('That playbook came back empty both times we asked. Try again in a moment.');
    } catch (e) {
      // Before this, a thrown call skipped setLoading(false) entirely and left
      // the student watching a skeleton that never resolved. The retry loop
      // already recorded the model call itself failing.
      reportAiFailure('blueprint', { stage: 'render', codes: ['unexpected_error'], model: 'gemini_3_flash' });
      setError('We could not build that playbook just now. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => { setSelected(null); setDetail(null); setError(''); };

  if (selected) {
    return <BlueprintDetail bp={selected} detail={detail} loading={loading} error={error} onBack={close} />;
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader
        title="Study the path. Build your own."
        description="Real strategies extracted from high-agency students, creators, and founders. Pick a path, understand the playbook, and take the first step."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {BLUEPRINTS.map(bp => (
          <BlueprintCard key={bp.id} bp={bp} onClick={() => openBlueprint(bp)} />
        ))}
      </div>
    </main>
  );
}