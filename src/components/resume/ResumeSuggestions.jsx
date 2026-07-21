import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Lightbulb, Plus, X } from 'lucide-react';
import { newEntry } from './resumeTemplates';

export default function ResumeSuggestions({ resume, onAddEntry }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const [exps, missions, proof] = await Promise.all([
        base44.entities.Experiments.filter({ status: 'completed' }).catch(() => []),
        base44.entities.Missions.filter({ status: 'completed' }).catch(() => []),
        base44.entities.ProofOfWork.list('-created_date', 50).catch(() => []),
      ]);

      const items = [];

      for (const exp of exps.slice(0, 5)) {
        items.push({
          id: `exp-${exp.id}`,
          source: 'experiment',
          label: `You completed: "${exp.title}"`,
          prompt: `Would you like to add this as a Projects entry?`,
          entry: newEntry(),
          prefill: { title: exp.title, org: '', bullets: [exp.objective || ''] },
          section: 'projects',
        });
      }

      for (const p of proof.slice(0, 3)) {
        items.push({
          id: `proof-${p.id}`,
          source: 'proof',
          label: `Proof of work: "${p.title}"`,
          prompt: `Would you like to create a bullet for this?`,
          entry: newEntry(),
          prefill: { title: p.title, org: '', bullets: [p.description || p.completion_note || ''] },
          section: 'projects',
        });
      }

      setSuggestions(items);
    } finally {
      setLoading(false);
    }
  };

  const visible = suggestions.filter(s => !dismissed.has(s.id));

  if (loading) return <p className="text-xs text-[#94A3B8] py-2">Loading suggestions…</p>;
  if (visible.length === 0) return null;

  return (
    <div className="mb-5 rounded-[16px] border border-amber-100 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={14} className="text-amber-600" />
        <p className="text-xs font-bold text-amber-800">Suggestions from your Unscripted activity</p>
      </div>
      <p className="text-[10px] text-amber-700 mb-3">These are based on your completed work. Nothing is added without your approval.</p>
      <div className="space-y-2">
        {visible.map(s => (
          <div key={s.id} className="flex items-start gap-3 rounded-xl bg-white border border-amber-100 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#050816]">{s.label}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">{s.prompt}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => { onAddEntry(s.section, { ...s.entry, ...s.prefill }); setDismissed(d => new Set([...d, s.id])); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white" style={{ background: '#8B0C21' }}>
                <Plus size={10} /> Add
              </button>
              <button onClick={() => setDismissed(d => new Set([...d, s.id]))}
                className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[#94A3B8] hover:text-[#334155]">
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}