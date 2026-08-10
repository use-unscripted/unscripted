import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import DisagreeButton from '@/components/evidence-profile/DisagreeButton';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

/**
 * "Why does Unscripted think this?"
 * Lists the actual records behind a conclusion, each one a link back to the
 * thing itself, so no insight exists only as a sentence.
 */
export default function EvidenceProvenance({ summary, type, conclusionKey, label, alreadyFlagged }) {
  const [open, setOpen] = useState(false);
  const sources = summary?.sources || [];

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(o => !o)}
        className="tp-meta touch-reach flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}>
        Why does Unscripted think this?
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {sources.length === 0 ? (
            <p className="tp-meta" style={{ color: 'var(--ink-500)' }}>
              Nothing supports this yet, which is why it is not stated as a conclusion.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sources.map((s, i) => (
                <li key={i} className="tp-meta flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--ink-700)' }}>
                  <span className="rounded-full px-2 py-0.5 font-bold"
                    style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
                    {s.quality.label}
                  </span>
                  {s.link ? (
                    <Link to={s.link} className="inline-flex items-center gap-1 font-semibold underline">
                      {s.detail} <ArrowUpRight size={11} />
                    </Link>
                  ) : (
                    <span>{s.detail}</span>
                  )}
                  {s.date && <span style={{ color: 'var(--ink-400)' }}>{fmt(s.date)}</span>}
                </li>
              ))}
            </ul>
          )}

          {summary?.newest?.date && (
            <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
              Most recent evidence: {fmt(summary.newest.date)}. Strongest: {summary.strongest?.quality.label}.
            </p>
          )}

          <DisagreeButton type={type} conclusionKey={conclusionKey} label={label} alreadyFlagged={alreadyFlagged} />
        </div>
      )}
    </div>
  );
}