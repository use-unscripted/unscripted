import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Inbox, Loader2, RefreshCw, TriangleAlert, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { SkCards } from '@/components/PageSkeleton';
import { useAuth } from '@/lib/AuthContext';
import { AI_FEATURES } from '@/lib/ai-failures';

/**
 * Every AI generation that failed or was rejected, so we can see it.
 *
 * The failures that matter most are the ones nobody would ever hear about. A
 * student whose Mission Guide came back empty does not file a bug, they close
 * the tab, and that is most of the 252 experiments with no guide. A generation
 * that failed once and succeeded on retry is invisible to the student and to
 * the funnel, and it is the earliest warning that a model has drifted.
 *
 * ## What this page cannot show you
 *
 * The prompt and the response. That is deliberate: the prompts here are built
 * from what students told us about their lives, and this is a page staff read.
 * Rows hold a feature, a stage, cause codes, counts and ids. To see the actual
 * content of a failure, reproduce it with `base44 exec` against your own
 * account.
 *
 * So the question this page answers is "what is breaking, where, how often, and
 * is it getting worse" — not "what exactly did the model say."
 */

const RECOVERED_HELP = 'Failed, then succeeded when we handed the model its own rejection reasons. The student saw nothing.';

function fmtWhen(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Unknown'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function featureLabel(feature) {
  return (feature || 'unknown').replace(/_/g, ' ');
}

export default function AdminAiFailures() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [tab, setTab] = useState('open');

  const admin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await base44.entities.AiFailure.list('-occurred_at', 500);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setError('Could not load the failure log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (admin) load(); else setLoading(false); }, [admin, load]);

  const markReviewed = async (row) => {
    setBusyId(row.id);
    try {
      await base44.entities.AiFailure.update(row.id, {
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || '',
      });
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, reviewed: true } : r)));
    } catch {
      setError('Could not update that row.');
    } finally {
      setBusyId('');
    }
  };

  // Grouped by feature so the shape of the problem is the first thing visible,
  // rather than a reverse-chronological list where one noisy feature buries the
  // rest.
  const summary = useMemo(() => {
    const byFeature = new Map(AI_FEATURES.map(f => [f, { feature: f, total: 0, recovered: 0, unreviewed: 0 }]));
    for (const row of rows) {
      // A row whose feature is not in the list still gets counted, under its own
      // heading. Skipping it made these totals disagree with the tab counts
      // below, which is the kind of quiet mismatch that makes a dashboard
      // untrustworthy.
      if (!byFeature.has(row.feature)) {
        byFeature.set(row.feature, { feature: row.feature || 'unknown', total: 0, recovered: 0, unreviewed: 0 });
      }
      const entry = byFeature.get(row.feature);
      entry.total += 1;
      if (row.recovered) entry.recovered += 1;
      if (!row.reviewed) entry.unreviewed += 1;
    }
    return [...byFeature.values()].filter(e => e.total > 0).sort((a, b) => b.total - a.total);
  }, [rows]);

  const visible = useMemo(() => {
    if (tab === 'open') return rows.filter(r => !r.reviewed && !r.recovered);
    if (tab === 'recovered') return rows.filter(r => r.recovered);
    return rows;
  }, [rows, tab]);

  const counts = useMemo(() => ({
    open: rows.filter(r => !r.reviewed && !r.recovered).length,
    recovered: rows.filter(r => r.recovered).length,
    all: rows.length,
  }), [rows]);

  if (!admin) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 text-sm text-[color:var(--ink-700)]">
          This page is for the team only.
        </div>
      </main>
    );
  }

  const TABS = [
    { id: 'open', label: 'Needs a look', count: counts.open },
    { id: 'recovered', label: 'Recovered on retry', count: counts.recovered },
    { id: 'all', label: 'Everything', count: counts.all },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        title="AI failures."
        description="Every generation that failed or was rejected. Diagnostics only: no prompts, no model output, nothing a student wrote."
        action={
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[var(--r-control)] px-4 py-3 text-sm"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && <SkCards />}

      {!loading && (
        <>
          {summary.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.map(entry => (
                <div key={entry.feature} className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4">
                  <p className="text-sm font-semibold capitalize text-[color:var(--surface-dark-900)]">
                    {featureLabel(entry.feature)}
                  </p>
                  <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--brand-navy-900)' }}>{entry.total}</p>
                  <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                    {entry.recovered} recovered on retry, {entry.unreviewed} unreviewed
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                style={tab === t.id
                  ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
                  : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
                {t.label}
                <span className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={tab === t.id ? { background: 'rgba(255,255,255,0.25)' } : { background: 'var(--ink-100)', color: 'var(--ink-500)' }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {tab === 'recovered' && counts.recovered > 0 && (
            <p className="mb-3 flex items-start gap-2 rounded-[var(--r-control)] px-4 py-3 text-xs text-[color:var(--ink-700)]"
              style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
              <Wand2 size={13} className="mt-0.5 shrink-0" /> {RECOVERED_HELP}
            </p>
          )}

          {visible.length === 0 ? (
            <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-10 text-center">
              <Inbox size={22} className="mx-auto mb-2 text-[color:var(--ink-400)]" />
              <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">Nothing here.</p>
              <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                {tab === 'open' ? 'No unreviewed failures.' : 'No rows in this view yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map(row => (
                <div key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-[color:var(--surface-dark-900)]">
                        {featureLabel(row.feature)}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={row.recovered
                          ? { background: 'var(--success-50)', color: 'var(--success-700)' }
                          : { background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
                        {row.recovered ? 'Recovered' : 'Failed'}
                      </span>
                      {row.reviewed && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>Reviewed</span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-[color:var(--ink-500)]">
                      stage={row.stage || 'unknown'}
                      {Array.isArray(row.codes) && row.codes.length ? ` · ${row.codes.join(', ')}` : ''}
                      {row.attempts ? ` · ${row.attempts} attempt${row.attempts === 1 ? '' : 's'}` : ''}
                      {row.model ? ` · ${row.model}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--ink-400)]">{fmtWhen(row.occurred_at || row.created_date)}</p>
                  </div>
                  {!row.reviewed && (
                    <button onClick={() => markReviewed(row)} disabled={busyId === row.id}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-60">
                      {busyId === row.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Mark reviewed
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {rows.length >= 500 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-[color:var(--ink-500)]">
              <TriangleAlert size={12} /> Showing the 500 most recent. Older rows exist and are not counted above.
            </p>
          )}
        </>
      )}
    </main>
  );
}
