import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Scale } from 'lucide-react';

/** Accepts a live recalculation result or a stored HypothesisRecalculation row. */
export function normalizeChange(change) {
  if (!change) return null;
  const before = change.before || {};
  const after = change.after || {};
  return {
    pathName: change.path?.path_name || change.path_name || '',
    fitBefore: before.career_fit_score ?? null,
    fitAfter: after.career_fit_score ?? null,
    confidenceBefore: before.fit_confidence_score ?? null,
    confidenceAfter: after.fit_confidence_score ?? null,
    reasons: change.reasons || [],
    contradictions: change.contradictions || [],
    statusAfter: change.statusAfter || change.status_after || null,
    date: change.recalculated_at || change.created_date || null,
  };
}

function Score({ label, from, to }) {
  if (from === null || to === null) return null;
  const up = to > from;
  const same = to === from;
  return (
    <div>
      <p className="tp-meta" style={{ color: 'var(--ink-500)' }}>{label}</p>
      <p className="tp-card mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--surface-dark-900)' }}>
        <span style={{ color: 'var(--ink-400)' }}>{from}%</span>
        <ArrowRight size={13} style={{ color: 'var(--ink-400)' }} />
        <span style={{ color: same ? 'var(--surface-dark-900)' : up ? 'var(--success-700)' : 'var(--warning-700)' }}>{to}%</span>
      </p>
    </div>
  );
}

/**
 * Why a career's scores moved, in the evidence the student produced.
 * Fit and confidence are shown side by side on purpose: a career can become
 * less promising and better understood in the same update.
 */
export default function WhyThisChanged({ change, defaultOpen = false, compact = false }) {
  const c = normalizeChange(change);
  const [open, setOpen] = useState(defaultOpen);
  if (!c || (c.fitAfter === null && !c.reasons.length)) return null;

  const fitFell = c.fitBefore !== null && c.fitAfter !== null && c.fitAfter < c.fitBefore;
  const confidenceRose = c.confidenceBefore !== null && c.confidenceAfter !== null && c.confidenceAfter > c.confidenceBefore;

  return (
    <section className={`rounded-[16px] border ${compact ? 'mt-3 p-4' : 'p-5'}`} style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tp-body flex items-center gap-2 font-bold" style={{ color: 'var(--surface-dark-900)' }}>
          <Scale size={15} style={{ color: 'var(--brand-navy-700)' }} />
          Why this changed{c.pathName && !compact ? `: ${c.pathName}` : ''}
        </p>
        <button onClick={() => setOpen(o => !o)} className="tp-meta inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          {open ? 'Hide reasons' : 'See reasons'} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Score label="Career fit" from={c.fitBefore} to={c.fitAfter} />
        <Score label="Confidence in that estimate" from={c.confidenceBefore} to={c.confidenceAfter} />
      </div>

      {fitFell && confidenceRose && (
        <p className="tp-meta mt-3" style={{ color: 'var(--ink-500)' }}>
          Estimated fit went down, and confidence went up: there is now direct evidence from real work where before there were only your expectations.
        </p>
      )}

      {open && (
        <>
          <ul className="mt-3 space-y-2">
            {c.reasons.map((r, i) => (
              <li key={i} className="tp-prose flex gap-2" style={{ color: 'var(--ink-700)' }}>
                <span aria-hidden="true" style={{ color: 'var(--brand-gold-600)' }}>•</span>
                <span>{r.text} <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>({r.source})</span></span>
              </li>
            ))}
          </ul>
          {!!c.contradictions.length && (
            <p className="tp-meta mt-3" style={{ color: 'var(--ink-500)' }}>
              Conflicting evidence is kept rather than resolved, so this stays open for further testing.
            </p>
          )}
        </>
      )}
    </section>
  );
}