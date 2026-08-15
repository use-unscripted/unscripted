import { useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Loader2, AlertCircle, Check } from 'lucide-react';
import { COMPARISON_FIELDS, RISK_LABEL } from '@/components/journey/pathComparisonFields';

/**
 * One path at a time, one part of its description at a time.
 *
 * The names come first and nothing else: the student opens the one they are
 * curious about, then steps through the same fields, in the same order, that the
 * side-by-side comparison used to show all at once. Same information, delivered
 * one screen at a time.
 */
export default function PathFocusPanel({
  paths = [],
  onSelect,
  busyId,
  error,
  onRetry,
  ctaLabel = 'Test this path',
  currentPathId = null,
  title,
  description,
}) {
  const [openId, setOpenId] = useState(null);
  const [fieldIndex, setFieldIndex] = useState(0);

  if (!paths.length) return null;

  const path = paths.find(p => p.id === openId) || null;

  // ── The list of names ──────────────────────────────────────────────────────
  if (!path) {
    return (
      <section className="app-card p-6">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
          {title || (paths.length === 3 ? 'Your three paths' : 'Your paths')}
        </h2>
        <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {description || 'Open one to read it. None of these is a guaranteed fit. You pick the one worth testing first.'}
        </p>

        <ul className="mt-4 space-y-2.5">
          {paths.map(p => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { setOpenId(p.id); setFieldIndex(0); }}
                className="ui-lift flex w-full items-center justify-between gap-3 rounded-[var(--r-control)] p-4 text-left"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', minHeight: '56px' }}
              >
                <span className="min-w-0">
                  <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>
                    {p.path_name}
                    {p.id === currentPathId && (
                      <span
                        className="tp-meta ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase align-middle"
                        style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}
                      >
                        <Check size={11} /> Testing now
                      </span>
                    )}
                  </span>
                  {(p.path_category || p.risk_level) && (
                    <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>
                      {[p.path_category, RISK_LABEL[p.risk_level]].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <ArrowRight size={16} className="shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // ── One path, one part of its description ─────────────────────────────────
  const field = COMPARISON_FIELDS[fieldIndex];
  const value = field.get(path);
  const last = COMPARISON_FIELDS.length - 1;

  return (
    <section className="app-card p-6">
      <button
        type="button"
        onClick={() => setOpenId(null)}
        className="tp-meta inline-flex items-center gap-1.5 font-bold"
        style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}
      >
        <ArrowLeft size={14} /> All three paths
      </button>

      <h2 className="tp-section mt-1" style={{ color: 'var(--text-primary)' }}>{path.path_name}</h2>
      {path.risk_level && (
        <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>{RISK_LABEL[path.risk_level]}</p>
      )}

      <div
        className="mt-4 rounded-[var(--r-control)] p-4"
        style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
      >
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{field.label}</p>
        <p className="tp-prose mt-2" style={{ color: 'var(--ink-700)' }}>
          {value || 'Nothing recorded here yet.'}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFieldIndex(i => Math.max(0, i - 1))}
          disabled={fieldIndex === 0}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>
          {fieldIndex + 1} of {COMPARISON_FIELDS.length}
        </span>
        <button
          type="button"
          onClick={() => setFieldIndex(i => Math.min(last, i + 1))}
          disabled={fieldIndex === last}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>

      {path.id === currentPathId && (
        <p className="tp-meta mt-5 font-semibold" style={{ color: 'var(--success-700)' }}>
          This is the path you are testing now.
        </p>
      )}

      {onSelect && path.id !== currentPathId && (
        <>
          {error === path.id && (
            <p className="tp-meta mt-4 flex items-start gap-1.5 font-semibold text-red-600" role="alert">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              That did not save. <button type="button" onClick={onRetry} className="underline">Try again</button>
            </p>
          )}
          <button
            type="button"
            onClick={() => onSelect(path)}
            disabled={busyId === path.id}
            className="ui-press app-cta tp-control mt-5 w-full disabled:opacity-60"
            style={{ minHeight: '52px' }}
          >
            {busyId === path.id
              ? <><Loader2 size={16} className="animate-spin" /> Setting up your test…</>
              : <>{ctaLabel} <ArrowRight size={16} /></>}
          </button>
        </>
      )}
    </section>
  );
}