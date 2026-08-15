import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const STATUS_TINT = {
  published: { background: 'var(--success-50)', color: 'var(--success-700)' },
  draft: { background: 'var(--ink-100)', color: 'var(--ink-500)' },
  needs_rereview: { background: 'var(--warning-50)', color: 'var(--warning-700)' },
  retired: { background: 'var(--danger-50)', color: 'var(--danger-700)' },
};

/** One validation record, with the staff decisions that can be taken on it. */
export default function ValidationAdminRow({ row, onChange, onRewritten }) {
  const [busy, setBusy] = useState('');
  const { validation: v, blueprint, strength, sources, reviews } = row;
  const approved = reviews.filter(r => r.approval_status === 'approved').length;

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(''); }
  };

  const Btn = ({ id, label, onClick }) => (
    <button
      type="button"
      onClick={() => run(id, onClick)}
      disabled={Boolean(busy)}
      className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-60"
    >
      {busy === id && <Loader2 size={11} className="animate-spin" />} {label}
    </button>
  );

  return (
    <div className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[color:var(--surface-dark-900)]">
          {v.experiment_title || v.experiment_id}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={STATUS_TINT[v.validation_status] || STATUS_TINT.draft}
        >
          {(v.validation_status || 'draft').replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-400)]">v{v.experiment_version || 1}</span>
      </div>

      <p className="mt-1 font-mono text-xs text-[color:var(--ink-500)]">
        level {strength.validation_level} · {strength.sufficient ? `${strength.score}/100` : 'no score'} ·
        {' '}{sources.length} sources · {approved} approved reviews · {blueprint?.career_title || 'no blueprint'}
        {v.mapping_reviewed ? ' · mapping reviewed' : ''}{v.field_calibrated ? ' · field calibrated' : ''}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Btn id="map" label={v.mapping_reviewed ? 'Unmark mapping reviewed' : 'Mark mapping reviewed'}
          onClick={() => onChange(row, { mapping_reviewed: !v.mapping_reviewed })} />
        <Btn id="field" label={v.field_calibrated ? 'Remove field calibration' : 'Mark field calibrated'}
          onClick={() => onChange(row, { field_calibrated: !v.field_calibrated })} />
        {v.validation_status !== 'published' && (
          <Btn id="pub" label="Publish" onClick={() => onChange(row, { validation_status: 'published' })} />
        )}
        {v.validation_status !== 'retired' && (
          <Btn id="ret" label="Retire" onClick={() => onChange(row, { validation_status: 'retired' })} />
        )}
        <Btn id="rw" label="Experiment rewritten (needs re-review)" onClick={() => onRewritten(row)} />
      </div>
    </div>
  );
}