/**
 * One scenario on screen.
 *
 * A workstyle scenario shows plausible options and never says which one was the
 * good one. After answering, the only thing offered is an optional
 * "What might this tell us?" — a small signal, described as a small signal.
 *
 * A performance question announces itself as scored, because it is the other
 * thing entirely: it feeds task performance, not career fit.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';
import ScenarioOptionCard from '@/components/scenarios/ScenarioOptionCard';
import { orderedOptions } from '@/lib/scenarios/scenario-randomize';
import { isPerformance, signalsForOption } from '@/lib/scenarios/scenario-signals';

function readback(scenario, option) {
  const signals = signalsForOption(option, scenario);
  if (!signals.length) return 'One hypothetical choice is not enough to draw a conclusion.';
  const names = signals.map(s => s.dimension_label.toLowerCase());
  return `This choice may provide a small signal about how you approach ${names.join(' and ')}. One hypothetical choice is not enough to draw a conclusion.`;
}

export default function ScenarioCard({
  scenario, selectedOptionId, onSelect, numericAnswer, onNumericAnswer,
  seedKey = '', whyThis, disabled,
}) {
  const [openReadback, setOpenReadback] = useState(false);
  const options = useMemo(() => orderedOptions(scenario, seedKey), [scenario, seedKey]);
  const performance = isPerformance(scenario);
  const selected = options.find(o => o.id === selectedOptionId) || null;

  return (
    <div>
      {performance ? (
        <p className="tp-eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <Target size={12} /> Performance question · scored
        </p>
      ) : (
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Decision scenario · no right answers</p>
      )}

      <h3 className="tp-card mt-2" style={{ color: 'var(--text-primary)' }}>{scenario.title}</h3>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{scenario.scenario_text}</p>

      {whyThis && (
        <p className="tp-meta mt-3 rounded-[var(--r-control)] p-3" style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
          <span className="font-bold">Why you are seeing this. </span>{whyThis}
        </p>
      )}

      {performance && !options.length ? (
        <label className="mt-4 block">
          <span className="tp-meta font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Your answer{scenario.accepted_answer_range?.unit ? ` (${scenario.accepted_answer_range.unit})` : ''}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={Number.isFinite(numericAnswer) ? numericAnswer : ''}
            onChange={e => onNumericAnswer(e.target.value === '' ? null : Number(e.target.value))}
            disabled={disabled}
            className="mt-1.5 w-full rounded-[var(--r-control)] border px-3 text-base outline-none"
            style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)', minHeight: '52px' }}
          />
        </label>
      ) : (
        <div className="mt-4 space-y-3">
          {options.map(o => (
            <ScenarioOptionCard
              key={o.id}
              text={o.option_text}
              selected={o.id === selectedOptionId}
              disabled={disabled}
              onSelect={() => { setOpenReadback(false); onSelect(o); }}
            />
          ))}
        </div>
      )}

      {/* Never "you picked the collaboration answer". Optional, and hedged. */}
      {!performance && selected && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpenReadback(v => !v)}
            className="touch-reach tp-meta inline-flex items-center gap-1 font-bold"
            style={{ color: 'var(--brand-navy-700)' }}
          >
            What might this tell us? {openReadback ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {openReadback && (
            <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>{readback(scenario, selected)}</p>
          )}
        </div>
      )}
    </div>
  );
}