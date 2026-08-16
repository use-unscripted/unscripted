/**
 * One dimension's evidence, source by source, plus the provenance behind any
 * scenario-derived reading.
 *
 * Five separate rows rather than one number: a student can see that some of this
 * came from hypothetical decisions and some from work they actually did, which is
 * the whole point of keeping the sources apart.
 */
import { useState } from 'react';
import { ChevronDown, MessageSquare, Compass, FlaskConical, Target, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';

const ICONS = {
  self_report: MessageSquare,
  scenario: Compass,
  behavioural: FlaskConical,
  performance: Target,
  human: BadgeCheck,
};

const CONTEXT_WORDS = {
  onboarding: 'during onboarding',
  path_review: 'while choosing a path',
  experiment: 'inside an experiment',
  standalone: 'on its own',
};

function SourceRow({ source }) {
  const Icon = ICONS[source.id] || MessageSquare;
  return (
    <div
      className="rounded-[var(--r-control)] p-3"
      style={{ background: source.applicable ? 'var(--ink-50)' : 'transparent', border: '1px solid var(--ink-200)' }}
    >
      <p className="tp-label flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
        <Icon size={12} /> {source.label}
      </p>
      <p className="tp-body mt-1 font-bold" style={{ color: source.applicable ? 'var(--ink-900)' : 'var(--ink-400)' }}>
        {source.state}
      </p>
      <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-500)' }}>{source.reading}</p>
    </div>
  );
}

export default function DimensionSources({ breakdown, provenance = [] }) {
  const [open, setOpen] = useState(false);
  if (!breakdown) return null;

  return (
    <div className="mt-5">
      <p className="tp-eyebrow mb-2" style={{ color: 'var(--ink-500)' }}>Where this comes from</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {breakdown.sources.map(s => <SourceRow key={s.id} source={s} />)}
      </div>

      <div className="mt-4 rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--info-50)' }}>
        <p className="tp-label" style={{ color: 'var(--ink-500)' }}>Current interpretation</p>
        <p className="tp-body mt-1" style={{ color: 'var(--ink-900)' }}>{breakdown.interpretation}</p>
        <p className="tp-meta mt-2" style={{ color: 'var(--ink-500)' }}>
          Evidence confidence: {breakdown.confidence}%
          {breakdown.confidence < 40 ? ' · low and developing' : ''}
        </p>
        {breakdown.scenario_heavy && (
          <p className="tp-meta mt-1.5" style={{ color: 'var(--warning-700)' }}>
            This reading rests on hypothetical answers. Real-world evidence is still limited.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="touch-target tp-meta mt-3 flex w-full items-center justify-between rounded-[var(--r-control)] px-3 text-left font-bold"
        style={{ border: '1px solid var(--ink-200)', color: 'var(--brand-navy-700)' }}
      >
        Why does Unscripted think this?
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {provenance.length === 0 && (
            <p className="tp-meta" style={{ color: 'var(--ink-500)' }}>
              Nothing here came from a scenario. Everything above came from what you told us or from work you actually did.
            </p>
          )}
          {provenance.map((p, i) => (
            <div key={i} className="rounded-[var(--r-control)] p-3" style={{ border: '1px solid var(--ink-200)' }}>
              <p className="tp-body font-bold" style={{ color: 'var(--ink-900)' }}>{p.title}</p>
              {p.option_text && <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-700)' }}>You chose: {p.option_text}</p>}
              <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>
                Hypothetical answer {CONTEXT_WORDS[p.context] || ''}
                {p.answered_at ? ` · ${format(new Date(p.answered_at), 'd MMM yyyy')}` : ''}
                {p.strength ? ` · ${p.strength} signal` : ''}
                {p.revised ? ' · you changed this answer' : ''}
              </p>
            </div>
          ))}
          <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
            Scenario answers are hypothetical. Real experiments carry more weight in your Career Decision Matrix.
          </p>
        </div>
      )}
    </div>
  );
}