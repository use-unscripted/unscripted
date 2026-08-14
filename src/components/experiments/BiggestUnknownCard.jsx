/**
 * Experiment selection, framed the way the product actually thinks: you are
 * exploring a career, this is the biggest thing still unknown about it, and here
 * is the smallest test that would tell us something.
 *
 * Fed by testBrief() — never invented here, and never rendered when there is no
 * open uncertainty.
 */
import { HelpCircle, Clock, Target, ArrowRight } from 'lucide-react';
import { TYPE_BY_ID } from '@/lib/experiment-types';

function Row({ label, children }) {
  return (
    <div>
      <p className="tp-eyebrow mb-1" style={{ color: 'var(--ink-500)' }}>{label}</p>
      <div className="tp-body" style={{ color: 'var(--ink-700)' }}>{children}</div>
    </div>
  );
}

export default function BiggestUnknownCard({ brief, onTest, ctaLabel = 'Test This', busy = false }) {
  if (!brief) return null;
  const type = TYPE_BY_ID.get(brief.experiment_type);

  return (
    <section className="rounded-[var(--r-surface)] border bg-white p-5"
      style={{ borderColor: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.12)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <HelpCircle size={12} /> Biggest current unknown
      </p>
      <p className="tp-card mt-2" style={{ color: 'var(--surface-dark-900)' }}>{brief.biggest_unknown}</p>
      <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>{brief.framing}</p>

      <div className="mt-4 space-y-3.5">
        <Row label="Why it matters">{brief.why_it_matters}</Row>
        <Row label="Recommended test">
          {type ? <span className="font-semibold">{type.label}. </span> : null}{brief.recommended_test}
        </Row>
        {brief.what_you_learn?.length > 0 && (
          <Row label="What this tests">
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {brief.what_you_learn.map(l => (
                <span key={l} className="tp-meta rounded-full px-2 py-0.5" style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}>{l}</span>
              ))}
            </div>
          </Row>
        )}
        <div className="flex flex-wrap gap-4">
          <p className="tp-meta flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
            <Clock size={12} /> Estimated effort: <strong>{brief.effort_label || brief.effort}</strong>
          </p>
          <p className="tp-meta flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
            <Target size={12} /> Smallest useful test of this
          </p>
        </div>
      </div>

      <button onClick={onTest} disabled={busy}
        className="tp-body mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] py-3.5 font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        {ctaLabel} <ArrowRight size={16} />
      </button>
    </section>
  );
}