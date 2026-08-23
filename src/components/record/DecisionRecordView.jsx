/**
 * The decision record view inside the Evidence Library: how the student's
 * thinking has moved, hypothesis by hypothesis.
 *
 * It takes the rows the library already loaded and adds only what it needs —
 * the append-only hypothesis history, the measurement rows, and the onboarding
 * profile — so there is one history product rather than two.
 */
import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock } from 'lucide-react';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { dimensionsFromActivity } from '@/lib/career-dimensions';
import { buildDecisionRecord } from '@/lib/decision-record';
import HypothesisChain from '@/components/record/HypothesisChain';
import CrossHypothesisEvidence from '@/components/record/CrossHypothesisEvidence';
import DecisionRecordExports from '@/components/record/DecisionRecordExports';
import RecordOrigin from '@/components/record/RecordOrigin';
import { Sk } from '@/components/PageSkeleton';
import FieldSelect from '@/components/ui/FieldSelect';

export default function DecisionRecordView({ raw }) {
  const [extra, setExtra] = useState(null);
  const [openPathId, setOpenPathId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      base44.entities.HypothesisUpdate.list('created_date', 200).catch(() => []),
      loadMeasurements().catch(() => ({})),
      base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
    ]).then(([updates, measurements, profiles]) => {
      if (!live) return;
      setExtra({
        updates: Array.isArray(updates) ? updates : [],
        measurements: measurements || {},
        profile: (Array.isArray(profiles) ? profiles : [])[0] || null,
      });
    });
    return () => { live = false; };
  }, []);

  const record = useMemo(() => {
    if (!raw || !extra) return null;
    const dimensions = dimensionsFromActivity({
      experiments: raw.experiments || [],
      measurements: extra.measurements,
      reflections: raw.reflections || [],
      profile: extra.profile || {},
    });
    return buildDecisionRecord({
      paths: raw.paths || [],
      experiments: raw.experiments || [],
      missions: raw.missions || [],
      proof: raw.proof || [],
      reflections: raw.reflections || [],
      measurements: extra.measurements,
      updates: extra.updates,
      profile: extra.profile,
      dimensions,
    });
  }, [raw, extra]);

  if (!record) {
    return <div className="space-y-4"><Sk h={120} r={16} /><Sk h={280} r={16} /><Sk h={200} r={16} /></div>;
  }

  if (!record.hypotheses.length) {
    return (
      <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
        <p className="tp-section text-[color:var(--surface-dark-900)]">No hypotheses to record yet.</p>
        <p className="tp-body mx-auto mt-2 max-w-[46ch] text-[color:var(--ink-500)]">
          Once you have a career hypothesis and an experiment, your record starts building itself.
        </p>
      </div>
    );
  }

  // A student can accumulate dozens of generated hypotheses. The record is about
  // the ones with a history behind them, so those are what the picker offers;
  // the rest stay one tap away rather than filling the screen.
  const tested = record.hypotheses.filter(h => h.updateCount || h.experimentCount);
  const listed = (showAll || tested.length === 0) ? record.hypotheses : tested;
  const open = listed.find(h => h.pathId === openPathId) || listed[0];

  return (
    <div className="space-y-5">
      <p className="tp-meta flex items-center gap-2 rounded-[var(--r-control)] px-4 py-3 text-[color:var(--ink-700)]" style={{ background: 'var(--background-tertiary)' }}>
        <Lock size={13} className="shrink-0" /> Private to you. Earlier positions are kept as they were recorded, even where later evidence disagreed.
      </p>

      <RecordOrigin origin={record.origin} counts={record.counts} />

      {/* One hypothesis at a time — chains are long, and on a phone stacking
          every one of them buries the current position. */}
      {listed.length > 1 && (
        <div>
          {/* The listbox is not a native <select>, so this is a caption rather
              than a <label> — the control carries its own accessible name. */}
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
            Whose history are you reading?
          </p>
          <FieldSelect
            value={open.pathId}
            onChange={setOpenPathId}
            ariaLabel="Whose history are you reading?"
            className="mt-2 w-full"
            options={listed.map(h => ({
              value: h.pathId,
              label: `${h.pathName}${h.experimentCount ? ` · ${h.experimentCount} experiment${h.experimentCount === 1 ? '' : 's'}` : ''}`,
            }))}
          />
          {tested.length > 0 && record.hypotheses.length > tested.length && (
            <button onClick={() => setShowAll(s => !s)} className="touch-reach tp-meta mt-2 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
              {showAll
                ? 'Show only the ones you have tested'
                : `Show all ${record.hypotheses.length} hypotheses, including untested ones`}
            </button>
          )}
        </div>
      )}

      <HypothesisChain chain={open} />
      <CrossHypothesisEvidence cross={record.cross} />
      <DecisionRecordExports record={record} proof={raw.proof || []} />
    </div>
  );
}