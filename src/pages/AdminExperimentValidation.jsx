import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Inbox } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { SkCards } from '@/components/PageSkeleton';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ValidationAdminRow from '@/components/admin/ValidationAdminRow';
import { loadValidationAdmin, updateValidation, markRewritten, assignReviewer, submitRereview } from '@/lib/validation-admin';

const TABS = [
  { id: 'needs_rereview', label: 'Needs re-review' },
  { id: 'draft', label: 'Draft' },
  { id: 'published', label: 'Published' },
  { id: 'all', label: 'Everything' },
];

/** The validation console: where an experiment's strength is actually decided. */
export default function AdminExperimentValidation() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    /* The field-calibration gate is computed across students, so it comes from
       the aggregate function rather than this page: the browser never sees the
       responses behind it. If it cannot be loaded, nothing is blocked. */
    const [next, di] = await Promise.all([
      loadValidationAdmin().catch(() => ({ rows: [] })),
      base44.functions.invoke('decisionIntelligence', {}).then(r => r?.data).catch(() => null),
    ]);
    const gates = new Map((di?.experiments || [])
      .filter(r => r.blueprint_key && r.field_calibration)
      .map(r => [r.blueprint_key, r.field_calibration]));
    setState({
      ...next,
      rows: (next.rows || []).map(row => ({
        ...row,
        field_calibration: gates.get(row.validation.blueprint_key) || null,
      })),
    });
    setBusy(false);
  }, []);

  useEffect(() => { if (admin) load(); }, [admin, load]);

  const rows = useMemo(() => {
    const all = state?.rows || [];
    return tab === 'all' ? all : all.filter(r => (r.validation.validation_status || 'draft') === tab);
  }, [state, tab]);

  if (!admin) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 text-sm text-[color:var(--ink-700)]">
          This page is for the team only.
        </div>
      </main>
    );
  }

  const change = async (row, patch) => {
    setError('');
    try {
      await updateValidation(row, patch);
    } catch (err) {
      setError(err?.message || 'That change was refused.');
      return;
    }
    await load();
  };
  const rewritten = async (row) => { await markRewritten(row); await load(); };
  const assign = async (row, reviewer) => { await assignReviewer(row, reviewer); await load(); };
  const review = async (row, form) => { await submitRereview(row, form); await load(); };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        title="Experiment validation."
        description="Every validation record, the score its stored evidence supports, and the staff decisions behind it. Nothing here is generated."
        action={
          <button onClick={load} disabled={busy}
            className="flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-[var(--r-control)] px-4 py-3 text-sm"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map(t => {
          const count = t.id === 'all'
            ? (state?.rows || []).length
            : (state?.rows || []).filter(r => (r.validation.validation_status || 'draft') === t.id).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={tab === t.id
                ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
                : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
              {t.label}
              <span className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={tab === t.id ? { background: 'rgba(255,255,255,0.25)' } : { background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {!state ? <SkCards /> : rows.length === 0 ? (
        <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-10 text-center">
          <Inbox size={22} className="mx-auto mb-2 text-[color:var(--ink-400)]" />
          <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">No validation records in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <ValidationAdminRow key={row.validation.id} row={row} onChange={change} onRewritten={rewritten}
              onAssign={assign} onSubmitReview={review} />
          ))}
        </div>
      )}
    </main>
  );
}