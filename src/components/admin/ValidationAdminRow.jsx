import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import RereviewPanel from '@/components/admin/RereviewPanel';

const STATUS_TINT = {
  published: { background: 'var(--success-50)', color: 'var(--success-700)' },
  draft: { background: 'var(--ink-100)', color: 'var(--ink-500)' },
  needs_rereview: { background: 'var(--warning-50)', color: 'var(--warning-700)' },
  retired: { background: 'var(--danger-50)', color: 'var(--danger-700)' },
};

/** One validation record, with the staff decisions that can be taken on it. */
export default function ValidationAdminRow({ row, onChange, onRewritten, onAssign, onSubmitReview }) {
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const { validation: v, blueprint, strength, sources, reviews } = row;
  const approved = reviews.filter(r => r.approval_status === 'approved').length;
  const superseded = reviews.filter(r => r.approval_status === 'superseded').length;

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(''); }
  };

  /* The field-calibration gate, computed across students on the server. Absent
     until the aggregate has been loaded, in which case nothing is blocked. */
  const gate = row.field_calibration || null;

  const Btn = ({ id, label, onClick, disabled }) => (
    <button
      type="button"
      onClick={() => run(id, onClick)}
      disabled={Boolean(busy) || Boolean(disabled)}
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
        {' '}{sources.length} sources · {approved} approved reviews{superseded ? ` · ${superseded} superseded` : ''} · {blueprint?.career_title || 'no blueprint'}
        {v.mapping_reviewed ? ' · mapping reviewed' : ''}{v.field_calibrated ? ' · field calibrated' : ''}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Btn id="map" label={v.mapping_reviewed ? 'Unmark mapping reviewed' : 'Mark mapping reviewed'}
          onClick={() => onChange(row, { mapping_reviewed: !v.mapping_reviewed })} />
        <Btn id="field" label={v.field_calibrated ? 'Remove field calibration' : 'Mark field calibrated'}
          disabled={!v.field_calibrated && gate && !gate.eligible}
          onClick={() => onChange(row, { field_calibrated: !v.field_calibrated })} />
        {v.validation_status !== 'published' && (
          <Btn id="pub" label="Publish" onClick={() => onChange(row, { validation_status: 'published' })} />
        )}
        {v.validation_status !== 'retired' && (
          <Btn id="ret" label="Retire" onClick={() => onChange(row, { validation_status: 'retired' })} />
        )}
        <Btn id="rw" label="Experiment rewritten (needs re-review)" onClick={() => onRewritten(row)} />
        <button type="button" onClick={() => setOpen(o => !o)}
          className="rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
          {open ? 'Hide re-review' : 'Re-review'}
        </button>
      </div>

      {/* Why calibration is unavailable, in the reviewer's own terms. No number
          here comes from one student. */}
      {gate && !gate.eligible && !v.field_calibrated && (
        <ul className="mt-2 space-y-0.5">
          {gate.missing.map((m, i) => (
            <li key={i} className="text-[11px] text-[color:var(--ink-500)]">Field calibration blocked: {m}</li>
          ))}
        </ul>
      )}

      {open && <RereviewPanel row={row} onAssign={onAssign} onSubmitReview={onSubmitReview} />}
    </div>
  );
}