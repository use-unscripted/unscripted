/**
 * Pilot dashboard — admin only, aggregate only.
 *
 * Deliberately absent: private reflections, uploaded proof contents, contact
 * notes, resume content, personal onboarding answers, individual student files.
 * Everything shown is a count, a percentage or an average derived from event
 * records (see src/lib/pilot-report.js).
 */
import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { PageSkeleton, SkControls, SkStats } from '@/components/PageSkeleton';
import PilotStat from '@/components/pilot/PilotStat';
import { loadPilotAccess } from '@/lib/pilot-access';
import { loadPilotReport } from '@/lib/pilot-report';

const selCls = 'rounded-[10px] border bg-white px-3 py-2 text-sm';

export default function PilotDashboard() {
  const [access, setAccess] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ institution_id: '', cohort_id: '', access_source: '' });

  const load = useCallback(async (f) => {
    setBusy(true);
    setError('');
    try {
      setReport(await loadPilotReport({
        institution_id: f.institution_id || undefined,
        cohort_id: f.cohort_id || undefined,
        access_source: f.access_source || undefined,
      }));
    } catch (err) {
      console.error('[pilot] report failed:', err?.message || err);
      setError("We couldn't load the pilot report. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadPilotAccess().then(a => {
      setAccess(a);
      if (a.isAdmin) load(filter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (!access) {
    return (
      <PageSkeleton maxWidth="5xl">
        <SkControls search={false} filters={2} />
        <SkStats count={8} />
      </PageSkeleton>
    );
  }

  if (!access.isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <ShieldAlert size={28} className="mx-auto" style={{ color: 'var(--brand-navy-700)' }} />
        <h1 className="font-heading mt-3 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admins only</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          The pilot report is aggregate reporting for the Unscripted team and partner institutions.
        </p>
      </main>
    );
  }

  const setF = (key) => (e) => {
    const next = { ...filter, [key]: e.target.value };
    setFilter(next);
    load(next);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Pilot reporting"
        title="University pilot dashboard"
        description="Aggregate progress only. No reflection text, proof files, contact notes, resume content or onboarding answers appear here."
        action={
          <button type="button" onClick={() => load(filter)} disabled={busy}
            className="ui-press inline-flex items-center gap-2 rounded-[10px] px-4 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      {error && <p className="mb-4 text-sm font-semibold text-red-600" role="alert">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        <select value={filter.institution_id} onChange={setF('institution_id')} aria-label="Institution"
          className={selCls} style={{ borderColor: 'var(--border-light)' }}>
          <option value="">All institutions</option>
          {(report?.filterOptions.institutions || []).map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filter.cohort_id} onChange={setF('cohort_id')} aria-label="Cohort"
          className={selCls} style={{ borderColor: 'var(--border-light)' }}>
          <option value="">All cohorts</option>
          {(report?.filterOptions.cohorts || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.access_source} onChange={setF('access_source')} aria-label="Access source"
          className={selCls} style={{ borderColor: 'var(--border-light)' }}>
          <option value="">All access sources</option>
          <option value="independent_beta">Independent beta</option>
          <option value="institution_sponsored">Institution sponsored</option>
          <option value="internal_admin">Internal admin</option>
        </select>
      </div>

      {!report ? (
        <SkStats count={8} />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PilotStat label="Invitations" value={report.invitations} sub="Accounts created" />
            <PilotStat label="Registrations" value={report.registrations} sub="Completed first sign-in" />
            <PilotStat label="Full-cycle completion" value={`${report.fullCycleRate}%`} sub="Of registered students" />
            <PilotStat label="Avg clarity change" value={report.averageClarityChange}
              sub={`${report.clarityStudents} completed cycle${report.clarityStudents === 1 ? '' : 's'}`} />
            <PilotStat label="7-day return" value={report.returnEngagement.sevenDay} sub="Students" />
            <PilotStat label="30-day return" value={report.returnEngagement.thirtyDay} sub="Students" />
            <PilotStat label="Second cycle attempted" value={`${report.secondCycleRate}%`} sub="Of cycle completers" />
            <PilotStat label="Continuation interest" value={report.continuationInterestRecorded} sub="Answers recorded" />
          </section>

          <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
            <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Stage-by-stage</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Unique students reaching each stage, the drop-off from the stage before, and the average days from
              registration.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="py-2 text-left font-bold">Stage</th>
                    <th className="py-2 text-right font-bold">Students</th>
                    <th className="py-2 text-right font-bold">Drop-off</th>
                    <th className="py-2 text-right font-bold">Avg days</th>
                  </tr>
                </thead>
                <tbody>
                  {report.funnel.map((row, i) => {
                    const t = report.timeToStage.find(x => x.label === row.label);
                    return (
                      <tr key={row.event} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                        <td className="py-2 pr-3" style={{ color: 'var(--text-primary)' }}>{row.label}</td>
                        <td className="py-2 text-right" style={{ color: 'var(--text-primary)' }}>{row.count}</td>
                        <td className="py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                          {i === 0 ? '—' : `${row.dropOffFromPrevious}%`}
                        </td>
                        <td className="py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                          {t?.days == null ? '—' : t.days}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
            <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Cohort completion</h2>
            {report.cohorts.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>No cohort activity recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {report.cohorts.map(c => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {c.completed}/{c.started} completed · {c.rate}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Based on {report.totalEvents} recorded events.
          </p>
        </div>
      )}
    </main>
  );
}