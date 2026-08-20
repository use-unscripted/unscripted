/**
 * Evidence Library: the organised record of what the student has actually done.
 *
 * Every read here is owner-scoped, so a student only ever sees their own
 * evidence; private evidence is never exposed to anyone else.
 */
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Library, Layers, FileText, ArrowRight, Lock, History } from 'lucide-react';
import DecisionRecordView from '@/components/record/DecisionRecordView';
import PageHeader from '@/components/PageHeader';
import { Sk, SkCards } from '@/components/PageSkeleton';
import EvidenceFilters from '@/components/evidence/EvidenceFilters';
import EvidenceCard from '@/components/evidence/EvidenceCard';
import CycleRecordView from '@/components/evidence/CycleRecordView';
import { buildLibrary, filterEvidence, filterOptions, DEFAULT_FILTERS, fmtDate } from '@/lib/evidence-library';
import PullToRefresh from '@/components/PullToRefresh';

export default function EvidenceLibrary() {
  const [raw, setRaw] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = useState('all');
  const [openCycleId, setOpenCycleId] = useState(null);

  const load = async () => {
    const [cycles, paths, experiments, missions, proof, reflections] = await Promise.all([
      base44.entities.CareerCycle.list('-created_date', 100).catch(() => []),
      base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
      base44.entities.Missions.list('-created_date', 300).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 300).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
    ]);
    setRaw({ cycles, paths, experiments, missions, proof, reflections });
  };

  useEffect(() => { load(); }, []);

  const { evidence, cycleRecords } = useMemo(() => (raw ? buildLibrary(raw) : { evidence: [], cycleRecords: [] }), [raw]);
  const options = useMemo(() => filterOptions(evidence), [evidence]);
  const shown = useMemo(() => filterEvidence(evidence, filters), [evidence, filters]);
  const openRecord = cycleRecords.find((r) => r.cycle.id === openCycleId) || null;

  return (
    <main className="app-page">
      <PageHeader
        title="What you have actually done."
        description="Every piece of proof from your career experiments, in one place."
      />

      <PullToRefresh onRefresh={load}>
      {!raw ? (
        <div>
          {/* view toggle · privacy note · filter bar · cards, in place, at size */}
          <div className="mb-5 flex gap-2">
            <Sk h={42} w={128} r={10} />
            <Sk h={42} w={162} r={10} />
          </div>
          <Sk h={40} r={12} className="mb-5" />
          <Sk h={64} r={16} className="mb-5" />
          <SkCards count={4} h={132} r={16} />
        </div>
      ) : openRecord ? (
        <CycleRecordView record={openRecord} onBack={() => setOpenCycleId(null)} />
      ) : (
        <>
          <div className="mb-5 flex gap-2">
            {[['all', 'All evidence', Library], ['cycles', 'By career cycle', Layers], ['record', 'Decision record', History]].map(([key, label, Icon]) => (
              <button key={key} onClick={() => setView(key)}
                className="touch-target ui-press flex items-center gap-1.5 rounded-[var(--r-control)] px-4 py-2.5 text-sm font-bold"
                style={key === view
                  ? { background: 'var(--brand-navy-900)', color: '#fff' }
                  : { background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {view !== 'record' && (
            <p className="tp-meta mb-5 flex items-center gap-2 rounded-[var(--r-control)] px-4 py-3 text-[color:var(--ink-700)]" style={{ background: 'var(--background-tertiary)' }}>
              <Lock size={13} className="shrink-0" /> Everything here is private to you.
            </p>
          )}

          {view === 'record' ? (
            <DecisionRecordView raw={raw} />
          ) : view === 'all' ? (
            <>
              {/* Nothing to sift through yet, so the empty state says more than a filter bar can. */}
              {evidence.length > 0 && (
                <EvidenceFilters filters={filters} setFilters={setFilters} options={options} shown={shown.length} total={evidence.length} />
              )}
              {evidence.length === 0 ? (
                <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
                  <FileText size={30} className="mx-auto mb-3 text-[color:var(--ink-200)]" />
                  <p className="tp-section text-[color:var(--surface-dark-900)]">No evidence yet.</p>
                  <p className="tp-body mx-auto mt-2 max-w-[46ch] text-[color:var(--ink-500)]">Submit proof from an experiment and it lands here.</p>
                </div>
              ) : shown.length === 0 ? (
                <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
                  <p className="tp-section text-[color:var(--surface-dark-900)]">No evidence matches these filters.</p>
                  <button onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="tp-body mt-3 font-semibold text-[color:var(--brand-navy-700)] underline underline-offset-2">
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {shown.map((i) => (
                    <EvidenceCard key={i.id} item={i} onOpenCycle={setOpenCycleId} />
                  ))}
                </div>
              )}
            </>
          ) : cycleRecords.length === 0 ? (
            <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
              <p className="tp-section text-[color:var(--surface-dark-900)]">No career cycles yet.</p>
              <p className="tp-body mx-auto mt-2 max-w-[46ch] text-[color:var(--ink-500)]">Choose a path and begin an experiment to start your first cycle.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cycleRecords.map((r) => (
                <button key={r.cycle.id} onClick={() => setOpenCycleId(r.cycle.id)}
                  className="ui-lift tp-card-body w-full rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white text-left">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="tp-eyebrow mb-1.5" style={{ color: r.cycle.status === 'completed' ? 'var(--success-700)' : 'var(--brand-navy-700)' }}>
                        {r.cycle.status === 'completed' ? 'Completed cycle' : 'In progress'}
                      </p>
                      <p className="tp-card text-[color:var(--surface-dark-900)]">{r.pathName || 'Unassigned path'}</p>
                      <p className="tp-meta mt-1.5 text-[color:var(--ink-500)]">
                        Started {fmtDate(r.cycle.started_at || r.cycle.created_date)} · {r.experiments.length} experiment{r.experiments.length !== 1 ? 's' : ''} ·{' '}
                        {r.missions.length} mission{r.missions.length !== 1 ? 's' : ''} ·{' '}
                        {r.evidence.length} piece{r.evidence.length !== 1 ? 's' : ''} of evidence
                      </p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-[color:var(--ink-400)]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      </PullToRefresh>
    </main>
  );
}