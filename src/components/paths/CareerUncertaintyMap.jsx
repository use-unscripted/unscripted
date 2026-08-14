import { useState } from 'react';
import { ChevronDown, ChevronUp, Map } from 'lucide-react';

const GROUPS = [
  { key: 'known',      title: 'Strong evidence',     hint: 'Tested enough that we would stand behind it.', color: 'var(--success-700)' },
  { key: 'developing', title: 'Developing evidence',  hint: 'Some signal, not enough to be sure.',          color: 'var(--warning-700)' },
  { key: 'untested',   title: 'Still untested',       hint: 'We have no real evidence here yet.',           color: 'var(--ink-400)' },
];

function VariableRow({ v }) {
  return (
    <li className="rounded-lg bg-white px-3 py-2.5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="tp-body font-semibold text-[color:var(--ink-700)]">{v.label}</span>
        <span className="tp-meta text-[color:var(--ink-400)]">
          {v.relevance === 'high' ? 'Especially important here' : 'Relevant here'} · evidence {v.evidence_strength}%
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-[color:var(--ink-100)]">
        <div className="h-full rounded-full" style={{ width: `${v.evidence_strength}%`, background: 'var(--brand-navy-700)' }} />
      </div>
      {v.tendency && (
        <p className="tp-meta mt-1.5 text-[color:var(--ink-500)]">
          What we think: {v.tendency} <span className="text-[color:var(--ink-400)]">({v.tendency_confidence}% confidence)</span>
        </p>
      )}
      {!v.tendency && <p className="tp-meta mt-1.5 text-[color:var(--ink-400)]">{v.question}</p>}
      {v.sources.length > 0 && <p className="tp-meta mt-1 text-[color:var(--ink-400)]">From: {v.sources.join(', ')}</p>}
      {v.needs_more_evidence && <p className="tp-meta mt-1 text-[color:var(--warning-700)]">Needs more testing.</p>}
    </li>
  );
}

/**
 * Optional expanded view of the uncertainty model. Collapsed by default: the
 * panel above already says the few things that matter, and this is the full
 * picture for a student who wants it.
 */
export default function CareerUncertaintyMap({ map }) {
  const [open, setOpen] = useState(false);
  if (!map?.variables?.length) return null;

  return (
    <div className="rounded-[var(--r-control)] bg-white" style={{ border: '1px solid var(--border-light)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="touch-target flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
          <Map size={12} /> Your career uncertainty map
        </span>
        <span className="tp-meta flex items-center gap-2 text-[color:var(--ink-400)]">
          {map.known.length} tested · {map.untested.length} untested
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: 'var(--border-light)' }}>
          {GROUPS.map(g => (
            map[g.key].length > 0 && (
              <div key={g.key}>
                <p className="tp-eyebrow" style={{ color: g.color }}>{g.title}</p>
                <p className="tp-meta mb-2 text-[color:var(--ink-400)]">{g.hint}</p>
                <ul className="space-y-2">
                  {map[g.key].map(v => <VariableRow key={v.variable} v={v} />)}
                </ul>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}