import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { SkCards } from '@/components/PageSkeleton';
import { useAuth } from '@/lib/AuthContext';
import DiSection from '@/components/admin/DiSection';
import DiExperimentTable from '@/components/admin/DiExperimentTable';

/**
 * Decision Intelligence: what the product is learning about which experiences
 * teach students something useful.
 *
 * This is NOT an institutional dashboard and NOT a view of students. Everything
 * on it is a count or an average over students, computed server-side, with any
 * cell built on fewer than the threshold number of students returned suppressed.
 * Nothing a student wrote reaches this page.
 */
export default function AdminDecisionIntelligence() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const admin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await base44.functions.invoke('decisionIntelligence', {}).catch(() => null);
    if (res?.data && !res.data.error) setData(res.data);
    else setError('Could not compute the aggregate metrics.');
    setLoading(false);
  }, []);

  useEffect(() => { if (admin) load(); else setLoading(false); }, [admin, load]);

  if (!admin) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 text-sm text-[color:var(--ink-700)]">
          This page is for the team only.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Team only"
        title="Decision intelligence."
        description="Aggregate product learning: which experiences help students learn something useful. Counts and averages over students, never a view of one."
        action={
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Recompute
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[var(--r-control)] px-4 py-3 text-sm"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && <SkCards count={4} h={150} />}

      {!loading && data && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-[var(--r-control)] px-4 py-3 text-xs text-[color:var(--ink-700)]"
            style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            Cells built on fewer than {data.min_students} students are suppressed. {data.disclaimer}
          </p>

          <DiSection title="Uncertainty" cell={data.uncertainty} />
          <DiExperimentTable rows={data.experiments} minStudents={data.min_students} />
          <DiSection title="Cross-career learning" cell={data.cross_career} />
          <DiSection title="Hypothesis evolution" cell={data.hypothesis_evolution} />
          <DiSection title="Recommendation rules" cell={data.rules} />
          <DiSection title="Career clarity movement" cell={data.clarity} />
          <DiSection title="Data quality" cell={data.data_quality} alwaysOpen />
        </div>
      )}
    </main>
  );
}