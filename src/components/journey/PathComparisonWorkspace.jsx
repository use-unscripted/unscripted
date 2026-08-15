/**
 * The one comparison workspace: three paths, the same categories, no page hops.
 * Desktop reads as three columns; mobile stacks the same cards with a category
 * chooser so a student never has to open a separate page to compare.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { COMPARISON_FIELDS, RISK_LABEL } from './pathComparisonFields';
import { trackPilotEvent } from '@/lib/pilot-metrics';

function Cell({ label, value }) {
  return (
    <div className="border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        {label}
      </p>
      <p className="tp-body mt-1.5" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
        {value || 'Not enough information yet.'}
      </p>
    </div>
  );
}

function PathColumn({ path, busy, busyId, onSelect, ctaLabel = 'Test this path' }) {
  return (
    <article
      className="flex flex-col rounded-[var(--r-surface)] bg-white p-5"
      style={{ border: '1px solid var(--border-light)' }}
    >
      <header>
        <h3 className="tp-card" style={{ color: 'var(--text-primary)' }}>
          {path.path_name}
        </h3>
        <p className="tp-meta mt-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>
          {[path.path_category, RISK_LABEL[path.risk_level]].filter(Boolean).join(' · ')}
        </p>
      </header>

      <div className="mt-4 flex-1 space-y-3">
        {COMPARISON_FIELDS.map(f => <Cell key={f.key} label={f.label} value={f.get(path)} />)}
      </div>

      <button
        type="button"
        onClick={() => onSelect(path)}
        disabled={busy}
        className="ui-press app-cta tp-control mt-5 w-full disabled:opacity-60"
        style={{ minHeight: '48px' }}
      >
        {busyId === path.id ? 'Setting this up…' : ctaLabel}
      </button>
    </article>
  );
}

export default function PathComparisonWorkspace({ paths, onSelect, busyId, error, onRetry, ctaLabel }) {
  const three = paths.slice(0, 3);
  const [mobileIdx, setMobileIdx] = useState(0);
  const busy = !!busyId;

  // all_paths_viewed: on desktop all three cards are on screen at once; on a
  // phone it means the student actually opened each one.
  const [seen, setSeen] = useState(() => new Set([0]));
  useEffect(() => {
    if (three.length < 3) return;
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
    if (!wide && seen.size < 3) return;
    trackPilotEvent('all_paths_viewed', {
      path_id: three[0]?.id,
      value: three.length,
      dedupe_key: three.map(p => p.id).sort().join('|'),
    });
  }, [three, seen]);

  return (
    <section className="rounded-[var(--r-surface)] p-5 sm:p-6" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        Compare your three paths
      </h2>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
        Same questions asked of each one. None of these is a guaranteed fit. You pick the one worth
        testing first, and the test tells you the rest.
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-[var(--r-control)] p-4" style={{ background: 'var(--danger-50)', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--danger-700)' }} />
          <div>
            <p className="tp-body font-bold" style={{ color: '#991B1B' }}>We couldn't set that path up.</p>
            <p className="tp-body mt-1.5" style={{ color: 'var(--danger-700)' }}>
              Your answers and your choice are safe. Nothing was half-created. Try again.
            </p>
            <button type="button" onClick={onRetry} className="tp-body mt-2.5 inline-flex items-center gap-1.5 font-bold" style={{ color: '#991B1B' }}>
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        </div>
      )}

      {/* Mobile: one card at a time, switchable — still one workspace, one page. */}
      <div className="mt-5 flex gap-2 sm:hidden">
        {three.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setMobileIdx(i); setSeen(prev => new Set(prev).add(i)); }}
            className="tp-meta flex-1 truncate rounded-[var(--r-control)] px-2 py-2.5 font-bold"
            style={i === mobileIdx
              ? { background: 'var(--brand-navy-900)', color: '#fff' }
              : { background: '#fff', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
          >
            Path {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-4 sm:hidden">
        {three[mobileIdx] && (
          <PathColumn path={three[mobileIdx]} busy={busy} busyId={busyId} onSelect={onSelect} ctaLabel={ctaLabel} />
        )}
      </div>

      <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-3">
        {three.map(p => (
          <PathColumn key={p.id} path={p} busy={busy} busyId={busyId} onSelect={onSelect} ctaLabel={ctaLabel} />
        ))}
      </div>
    </section>
  );
}