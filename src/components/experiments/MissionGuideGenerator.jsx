import { useState, useRef } from 'react';
import { X, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const VARIATION_OPTIONS = [
  { value: 'shorter', label: 'Shorter', description: 'Reduce scope and time commitment' },
  { value: 'detailed', label: 'More detailed', description: 'Add depth, resources, and sub-steps' },
  { value: 'challenging', label: 'More challenging', description: 'Raise the bar and stretch further' },
  { value: 'lower_time', label: 'Lower time commitment', description: 'Fit into a tighter schedule' },
  { value: 'different_style', label: 'Different experiment style', description: 'Try a different approach entirely' },
  { value: 'custom', label: 'Custom instructions', description: 'Write your own direction' },
];

/**
 * MissionGuideGenerator
 * Props:
 *   experiment       – Experiments record
 *   existingGuides   – MissionGuides[] already saved for this experiment
 *   onGenerated      – (newGuide) => void — called after successful save
 *   onClose          – () => void
 */
export default function MissionGuideGenerator({ experiment, existingGuides = [], onGenerated, onClose }) {
  const hasExisting = existingGuides.length > 0;
  const [variation, setVariation] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [pendingGuide, setPendingGuide] = useState(null); // guide waiting for active decision
  const [activeDecision, setActiveDecision] = useState(null); // 'make_active' | 'keep_current' | 'compare'
  const [saving, setSaving] = useState(false);
  const generatingRef = useRef(false);

  const nextVersion = (existingGuides.length > 0
    ? Math.max(...existingGuides.map(g => g.version_number || 0)) + 1
    : 1);

  const buildPrompt = () => {
    const base = `You are Unscripted, an AI career coach for college students.
Generate a detailed Mission Guide for this experiment.

Experiment title: "${experiment.title}"
Objective: "${experiment.objective}"
Path being tested: "${experiment.path_name || 'Not specified'}"
${experiment.deliverable ? `Deliverable: "${experiment.deliverable}"` : ''}

This is Version ${nextVersion}.`;

    if (hasExisting && variation) {
      const variationLabels = {
        shorter: 'Make this guide shorter and more focused. Reduce the number of steps and time commitment.',
        detailed: 'Make this guide more detailed. Add sub-steps, specific resources, and deeper guidance.',
        challenging: 'Make this guide more challenging. Raise the expectations and push further.',
        lower_time: 'Design this guide for a lower time commitment. Keep it practical for a busy student.',
        different_style: 'Use a completely different approach or experiment style than a typical informational interview or research project.',
        custom: customInstruction,
      };
      return `${base}\n\nVariation instruction: ${variationLabels[variation] || variation}`;
    }
    return base;
  };

  const handleGenerate = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError('');

    const promptContext = buildPrompt();

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: promptContext,
        response_json_schema: {
          type: 'object',
          properties: {
            guide_title: { type: 'string' },
            objective: { type: 'string' },
            estimated_time: { type: 'string' },
            deliverable: { type: 'string' },
            proof_requirement: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step_number: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimated_time: { type: 'string' },
                },
              },
            },
            reflection_questions: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      // Validate
      if (!result.steps || !Array.isArray(result.steps) || result.steps.length === 0) {
        throw new Error('Generated guide has no steps. Please try again.');
      }
      if (!result.objective) throw new Error('Generated guide is missing an objective.');

      setPendingGuide({ ...result, promptContext, version_number: nextVersion });
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  };

  const handleSave = async (makeActive) => {
    if (saving || !pendingGuide) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();

      // Deactivate existing active guide if making this one active
      if (makeActive) {
        const activeGuides = existingGuides.filter(g => g.is_active);
        await Promise.all(activeGuides.map(g =>
          base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' })
        ));
      }

      const saved = await base44.entities.MissionGuides.create({
        user_id: user.id,
        experiment_id: experiment.id,
        path_id: experiment.path_recommendation_id || '',
        guide_title: pendingGuide.guide_title || `Mission Guide v${pendingGuide.version_number}`,
        version_number: pendingGuide.version_number,
        generation_prompt_context: pendingGuide.promptContext,
        objective: pendingGuide.objective,
        steps: pendingGuide.steps,
        deliverable: pendingGuide.deliverable || '',
        proof_requirement: pendingGuide.proof_requirement || '',
        reflection_questions: pendingGuide.reflection_questions || [],
        estimated_time: pendingGuide.estimated_time || '',
        status: makeActive ? 'active' : 'draft',
        is_active: makeActive,
      });

      onGenerated(saved, makeActive);
    } catch (err) {
      setError('Failed to save guide. Please try again.');
      setSaving(false);
    }
  };

  // ── Step 3: Active decision ───────────────────────────────────────────────
  if (pendingGuide && !activeDecision) {
    const hasActive = existingGuides.some(g => g.is_active);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
        <div className="w-full max-w-lg rounded-[24px] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold text-[#050816]">Guide generated</h2>
            <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 mb-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Version {pendingGuide.version_number}</p>
            <p className="font-semibold text-[#050816] text-sm">{pendingGuide.guide_title}</p>
            <p className="text-xs text-[#64748B] mt-1">{pendingGuide.objective}</p>
            <div className="flex gap-3 mt-2 text-xs text-[#94A3B8]">
              <span>{pendingGuide.steps?.length} steps</span>
              {pendingGuide.estimated_time && <span>· {pendingGuide.estimated_time}</span>}
            </div>
          </div>

          <p className="text-sm font-semibold text-[#334155] mb-3">
            {hasActive ? 'You already have an active guide. What would you like to do?' : 'Set this as your active guide?'}
          </p>

          <div className="space-y-2 mb-5">
            <button
              onClick={() => { setActiveDecision('make_active'); handleSave(true); }}
              disabled={saving}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm font-semibold text-left transition hover:bg-[#F8ECEF] disabled:opacity-60"
              style={{ borderColor: 'var(--brand-navy-700)', color: 'var(--brand-navy-700)' }}>
              Make this the active guide
              {hasActive && <span className="block text-xs font-normal text-[#B45309] mt-0.5">Will deactivate your current guide</span>}
            </button>
            <button
              onClick={() => { setActiveDecision('keep_current'); handleSave(false); }}
              disabled={saving}
              className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#334155] text-left transition hover:bg-[#F8FAFC] disabled:opacity-60">
              {hasActive ? 'Keep my current active guide' : 'Save as draft'}
              <span className="block text-xs font-normal text-[#94A3B8] mt-0.5">New guide saved as draft</span>
            </button>
            {hasActive && (
              <button
                onClick={() => { setActiveDecision('compare'); handleSave(false); }}
                disabled={saving}
                className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#64748B] text-left transition hover:bg-[#F8FAFC] disabled:opacity-60">
                Compare guides first
                <span className="block text-xs font-normal text-[#94A3B8] mt-0.5">Opens comparison view after saving</span>
              </button>
            )}
          </div>

          {saving && (
            <div className="flex items-center justify-center gap-2 text-sm text-[#64748B]">
              <Loader2 size={15} className="animate-spin" /> Saving guide...
            </div>
          )}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Step 1 & 2: Generate UI ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">
            {hasExisting ? 'Generate Another Mission Guide' : 'Generate Mission Guide'}
          </h2>
          <button onClick={onClose} disabled={generating}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">
          {hasExisting
            ? `Version ${nextVersion} will be created. Previous guides are preserved.`
            : 'AI will generate a step-by-step guide for this experiment.'}
        </p>

        {/* Experiment context */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-0.5">Experiment</p>
          <p className="text-sm font-semibold text-[#050816]">{experiment.title}</p>
          {experiment.path_name && <p className="text-xs" style={{ color: 'var(--brand-navy-700)' }}>{experiment.path_name}</p>}
        </div>

        {/* Variation picker — only for subsequent guides */}
        {hasExisting && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#334155] mb-2">What should be different?</p>
            <div className="space-y-2">
              {VARIATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVariation(variation === opt.value ? '' : opt.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm text-left transition"
                  style={variation === opt.value
                    ? { borderColor: 'var(--brand-navy-700)', background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }
                    : { borderColor: '#E2E8F0', background: 'white', color: '#334155' }}>
                  <span className="font-semibold">{opt.label}</span>
                  <span className="block text-xs text-[#94A3B8] mt-0.5">{opt.description}</span>
                </button>
              ))}
            </div>
            {variation === 'custom' && (
              <textarea
                rows={3}
                placeholder="Describe what you want to change or focus on..."
                value={customInstruction}
                onChange={e => setCustomInstruction(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]"
              />
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div>
              <p>{error}</p>
              <button onClick={handleGenerate} className="mt-1 font-semibold underline">Retry</button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={generating}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || (variation === 'custom' && !customInstruction.trim())}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {generating ? (
              <><Loader2 size={15} className="animate-spin" /> Generating...</>
            ) : (
              <><Wand2 size={15} /> {hasExisting ? 'Generate Another Mission Guide' : 'Generate Mission Guide'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}