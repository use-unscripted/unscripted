/**
 * The first decision in an experiment: what are you actually unsure about?
 *
 * Experiments used to be designed against whatever the uncertainty map ranked
 * highest, which meant the student was handed three tests of questions they were
 * never asked. Here they choose the open question themselves, and the designs
 * that follow are built to answer that one thing.
 *
 * A variable already carrying strong evidence is still offered, with its state
 * shown, because a student is allowed to retest something the system thinks it
 * knows.
 */
import { HelpCircle, ArrowRight, ChevronDown } from 'lucide-react';

const STATE_LABEL = (v) =>
  v.evidence_strength >= 60 ? 'Already well tested'
  : v.evidence_strength >= 25 ? 'Partly tested'
  : 'Untested';

export default function UncertaintyPicker({ pathName, variables, value, onChange, onNext }) {
  const chosen = variables.find(v => v.variable === value) || null;

  return (
    <div className="space-y-6">
      <div>
        <p className="tp-eyebrow mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <HelpCircle size={12} /> Step one
        </p>
        <h2 className="tp-page" style={{ color: 'var(--surface-dark-900)' }}>
          What are you unsure about with {pathName}?
        </h2>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-500)' }}>
          Pick the part of this work you genuinely do not know about yourself yet. Your experiments
          are then built to answer that, rather than testing the career in general.
        </p>
      </div>

      <label className="block">
        <span className="tp-body mb-1.5 block font-semibold" style={{ color: 'var(--ink-700)' }}>
          The question you want answered
        </span>
        <div className="relative">
          <select
            className="field-select w-full appearance-none rounded-xl border px-4 py-3 pr-10 text-base outline-none md:text-sm"
            style={{ borderColor: 'var(--ink-200)', background: 'var(--page-surface)', color: 'var(--ink-900)' }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose what to test…</option>
            {variables.map(v => (
              <option key={v.variable} value={v.variable}>
                {v.label} — {STATE_LABEL(v)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ink-400)' }}
          />
        </div>
      </label>

      {chosen && (
        <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
          <p className="tp-eyebrow mb-1" style={{ color: 'var(--ink-500)' }}>What this will answer</p>
          <p className="tp-body font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{chosen.question}</p>
          {chosen.tendency && (
            <p className="tp-meta mt-2" style={{ color: 'var(--ink-500)' }}>
              What you have told us so far: {chosen.tendency}
            </p>
          )}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!value}
        className="tp-body flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 font-semibold text-white transition disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
      >
        Design experiments for this <ArrowRight size={16} />
      </button>
    </div>
  );
}