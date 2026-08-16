import { useState } from 'react';
import { Plus } from 'lucide-react';

/**
 * Questions worth asking. Specific to the unknown, not "ask about the career".
 * The student can drop one or add their own; whatever is checked is what gets
 * recorded with the conversation.
 */
export default function HumanRealityQuestions({ questions, selected, onChange }) {
  const [draft, setDraft] = useState('');

  const toggle = (q) => onChange(selected.includes(q) ? selected.filter(x => x !== q) : [...selected, q]);
  const add = () => {
    const q = draft.trim();
    if (!q) return;
    onChange([...selected, q]);
    setDraft('');
  };

  const all = [...new Set([...questions, ...selected])];

  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Questions worth asking</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Take these with you. Specific questions get specific answers.
      </p>

      <ol className="mt-5 space-y-2.5">
        {all.map((q, i) => (
          <li key={q}>
            <label className="touch-target app-card-flat flex w-full cursor-pointer items-start gap-3 p-3.5 text-left">
              <input type="checkbox" checked={selected.includes(q)} onChange={() => toggle(q)} className="mt-1 h-4 w-4 shrink-0" />
              <span className="tp-body" style={{ color: 'var(--ink-700)' }}>
                <span className="mr-2 font-bold" style={{ color: 'var(--brand-navy-700)' }}>{i + 1}.</span>{q}
              </span>
            </label>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a question of your own"
          className="tp-body flex-1 rounded-[var(--r-control)] px-3 py-3"
          style={{ border: '1px solid var(--border-light)', color: 'var(--ink-900)' }}
        />
        <button type="button" onClick={add} className="app-cta-secondary tp-control">
          <Plus size={15} aria-hidden="true" /> Add
        </button>
      </div>
    </section>
  );
}