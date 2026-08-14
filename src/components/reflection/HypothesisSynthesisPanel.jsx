/**
 * Section 7: the suggested hypothesis update.
 *
 * Every line here comes from a stored record — the recalculation's before and
 * after, the hypothesis's own supporting and contradicting evidence, its
 * unresolved questions, and the next-best-test engine. Nothing is written by a
 * model, so there is no evidence here the student did not produce.
 *
 * The student reviews it: any line can be dropped, the confidence word can be
 * corrected, and a note can be added. Their version is what gets recorded, next
 * to the derived one.
 */
import { useState } from 'react';
import { ArrowRight, Check, Undo2 } from 'lucide-react';
import { applyReview, CONFIDENCE_LABELS } from '@/lib/hypothesis-synthesis';

function Ba({ label, value, sub }) {
  return (
    <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="tp-card mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function EvidenceList({ title, rows, dropped, onToggle, empty }) {
  return (
    <div className="mt-4">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{title}</p>
      {rows.length === 0 ? (
        <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r, i) => {
            const off = dropped.includes(i);
            return (
              <li key={i} className="flex items-start gap-2.5 rounded-[var(--r-control)] p-3" style={{ background: 'white', border: '1px solid var(--border-light)', opacity: off ? 0.5 : 1 }}>
                <span className="min-w-0 flex-1">
                  <span className="tp-body block" style={{ color: 'var(--text-primary)', textDecoration: off ? 'line-through' : 'none' }}>{r.text}</span>
                  <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>{r.source}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(i)}
                  className="tp-meta shrink-0 font-semibold"
                  style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}
                >
                  {off ? <span className="inline-flex items-center gap-1"><Undo2 size={12} /> Put back</span> : "That's not right"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function HypothesisSynthesisPanel({ synthesis, onConfirm }) {
  const [review, setReview] = useState({ droppedStrengthened: [], droppedWeakened: [], droppedUnknowns: [], confidenceLabel: '', note: '' });
  if (!synthesis) return null;

  const toggle = (key) => (i) => setReview(r => ({
    ...r,
    [key]: r[key].includes(i) ? r[key].filter(x => x !== i) : [...r[key], i],
  }));

  const label = review.confidenceLabel || synthesis.after.confidenceLabel;

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Section 7</p>
      <h2 className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>Update your hypothesis</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        This is assembled from your own check-ins, deliverables and words. Correct anything that misreads what happened before you record it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Ba label="Before" value={synthesis.before.confidenceLabel === 'Not yet rated' ? 'Not yet rated' : `${synthesis.before.confidenceLabel} confidence`} sub={synthesis.before.statusLabel} />
        <Ba label="After" value={`${label} confidence`} sub={synthesis.after.statusLabel} />
      </div>

      <EvidenceList
        title="Evidence that strengthened it"
        rows={synthesis.strengthened}
        dropped={review.droppedStrengthened}
        onToggle={toggle('droppedStrengthened')}
        empty="Nothing in this experiment strengthened this hypothesis."
      />
      <EvidenceList
        title="Evidence that weakened it"
        rows={synthesis.weakened}
        dropped={review.droppedWeakened}
        onToggle={toggle('droppedWeakened')}
        empty="Nothing in this experiment weakened this hypothesis."
      />
      <EvidenceList
        title="Remaining unknowns"
        rows={synthesis.unknowns.map(u => ({ text: u, source: 'Still open' }))}
        dropped={review.droppedUnknowns}
        onToggle={toggle('droppedUnknowns')}
        empty="No open questions are recorded against this hypothesis."
      />

      {synthesis.next_test && (
        <div className="mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Next best test</p>
          <p className="tp-body mt-1.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{synthesis.next_test.question}</p>
          {synthesis.next_test.title && (
            <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{synthesis.next_test.title}</p>
          )}
        </div>
      )}

      <div className="mt-5">
        <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>Does that confidence read right to you?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONFIDENCE_LABELS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setReview(r => ({ ...r, confidenceLabel: c }))}
              aria-pressed={label === c}
              className="tp-body rounded-[var(--r-control)] px-4 font-semibold"
              style={label === c
                ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)', minHeight: '48px' }
                : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
            >
              {c}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={review.note}
          onChange={e => setReview(r => ({ ...r, note: e.target.value }))}
          placeholder="Anything this summary gets wrong, in your words (optional)."
          className="mt-3 w-full resize-none rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
          style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
        />
      </div>

      <button
        type="button"
        onClick={() => onConfirm(applyReview(synthesis, review))}
        className="ui-press tp-body mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] font-bold text-white"
        style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}
      >
        <Check size={15} /> This is right, continue <ArrowRight size={15} />
      </button>
    </section>
  );
}