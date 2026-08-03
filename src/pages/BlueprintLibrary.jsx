import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM } from '@/lib/llm';
import PageHeader from '@/components/PageHeader';
import BlueprintCard from '@/components/blueprints/BlueprintCard';
import BlueprintDetail from '@/components/blueprints/BlueprintDetail';

const BLUEPRINTS = [
  { id: 'builder-creator', label: 'Builder-Creator Path', icon: '🔨', summary: 'Document your learning, build an audience, and turn online trust into career or startup opportunities.' },
  { id: 'student-founder', label: 'Student Founder Path', icon: '🚀', summary: 'Validate and launch a startup while still in school using your network and academic access.' },
  { id: 'fitness-discipline', label: 'Fitness & Discipline Creator', icon: '💪', summary: 'Turn physical discipline into a personal brand, coaching business, or content career.' },
  { id: 'ai-tool-builder', label: 'AI Tool Builder Path', icon: '🤖', summary: 'Build and ship AI-powered tools and products to create proof of work and real revenue.' },
  { id: 'brand-to-startup', label: 'Personal Brand to Startup', icon: '⚡', summary: 'Grow an audience first, then launch a product or service your followers already want.' },
  { id: 'newsletter-media', label: 'Newsletter / Media Builder', icon: '📰', summary: 'Build a niche media property—newsletter, podcast, or YouTube—that becomes a platform and business.' },
  { id: 'finance-business', label: 'Finance & Business Creator', icon: '📈', summary: 'Use finance and business knowledge to build credibility, a brand, and career leverage online.' },
  { id: 'high-agency-student', label: 'High-Agency Student Path', icon: '🎯', summary: 'Maximize every year of college by stacking experiences, skills, and proof of work deliberately.' },
];

export default function BlueprintLibrary() {
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const openBlueprint = async (bp) => {
    setSelected(bp);
    setDetail(null);
    setLoading(true);
    // Generic reference content for six fixed blueprints — no student data goes
    // in and nothing is personalised. Cheap tier; see src/lib/llm.js.
    const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `You are Unscripted, a life-design and execution platform for ambitious college students. Generate a detailed, actionable playbook for the "${bp.label}" path. Be specific and practical—no generic advice. Focus on what a college student can actually do today. Include honest tradeoffs.`,
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
    }));
    setDetail(result);
    setLoading(false);
  };

  const close = () => { setSelected(null); setDetail(null); };

  if (selected) {
    return <BlueprintDetail bp={selected} detail={detail} loading={loading} onBack={close} />;
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