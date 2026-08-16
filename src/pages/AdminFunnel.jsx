/**
 * The decision-cycle funnel, team only.
 *
 * Two funnels sit on this page and are never added together. The event funnel is
 * what students demonstrably did, and it only knows about the period since the
 * instrumentation shipped. The record funnel covers all of history but is built
 * from stored rows, which prove a record exists and nothing about whether a
 * student saw it — so it is labelled as inference on every row.
 *
 * Real-student numbers exclude founder, admin, internal test and automated test
 * accounts, plus every account nobody has classified yet.
 */
import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/PageHeader';
import PageSkeleton, { Sk } from '@/components/PageSkeleton';
import AdminSection from '@/components/admin/AdminSection';
import FunnelStageTable from '@/components/admin/FunnelStageTable';
import RepeatCyclePanel from '@/components/admin/RepeatCyclePanel';
import UserClassPanel from '@/components/admin/UserClassPanel';
import ReconstructionPanel from '@/components/admin/ReconstructionPanel';

export default function AdminFunnel() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('decisionFunnel', {});
      setData(res?.data || null);
    } catch (err) {
      setError(err?.message || 'That did not load.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user && user.role !== 'admin') {
    return (
      <main className="app-page">
        <section className="app-card p-6">
          <p className="tp-card flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <ShieldAlert size={16} /> This page is for the Unscripted team.
          </p>
        </section>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <PageSkeleton maxWidth="6xl" title description>
        <Sk h={280} r={16} />
      </PageSkeleton>
    );
  }

  const counts = data?.class_counts || {};

  return (
    <main className="app-page">
      <PageHeader
        title="Decision cycle funnel"
        description="What students demonstrably did, with internal and unclassified accounts held out of the numbers."
        action={
          <button type="button" onClick={load} className="ui-press app-cta-secondary tp-control">
            <RotateCcw size={15} /> Refresh
          </button>
        }
      />

      {error && (
        <p className="tp-body mb-5" style={{ color: 'var(--danger-700)' }}>{error}</p>
      )}

      <div className="app-stack">
        <section className="app-card-flat p-4">
          <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{data?.note}</p>
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
            Counting: {(data?.included_classes || []).join(', ') || 'none'} ·
            {' '}unclassified accounts: {counts.unclassified ?? 0} ·
            {' '}internal accounts: {(counts.founder ?? 0) + (counts.admin ?? 0) + (counts.internal_test ?? 0) + (counts.automated_test_agent ?? 0)}
          </p>
        </section>

        <AdminSection title="Real students, event by event" note="Each stage requires an event the product actually emitted. A stage with zero students means no student has been recorded reaching it, which is not the same as students abandoning it.">
          <FunnelStageTable stages={data?.event_funnel?.stages || []} eventBacked />
        </AdminSection>

        <AdminSection title="Repeat cycles" note="A completed cycle needs all seven recorded steps: selected, pre-expectations, experiment finished, evidence, post-experience, reflection, decision. Creating an experiment record does not count.">
          <RepeatCyclePanel cycles={data?.cycles} />
        </AdminSection>

        <AdminSection title="Internal and test activity" note="Kept visible so it is obvious how much of the raw record count came from us rather than from students.">
          <FunnelStageTable
            stages={(data?.internal_activity?.stages || []).map(s => ({ ...s, label: s.key.replace(/_/g, ' ') }))}
            eventBacked
          />
        </AdminSection>

        <AdminSection title="History, inferred from records" note="All of history, but every row here is an inference from stored rows. Do not read drop-off from this table.">
          <FunnelStageTable stages={data?.record_funnel?.stages || []} eventBacked={false} />
          <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>{data?.record_funnel?.caveat}</p>
        </AdminSection>

        <AdminSection title="What can and cannot be reconstructed">
          <ReconstructionPanel reconstruction={data?.reconstruction} />
        </AdminSection>

        <AdminSection title="Account classification" note="Nothing is assigned automatically. An unclassified account stays out of the real-student numbers rather than being guessed at.">
          <UserClassPanel accounts={data?.accounts || []} counts={counts} onChanged={load} />
        </AdminSection>
      </div>
    </main>
  );
}