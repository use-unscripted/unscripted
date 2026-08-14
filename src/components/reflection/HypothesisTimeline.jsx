/**
 * The hypothesis over time: Initial hypothesis → Experiment 1 → Update →
 * Experiment 2 → Update → Current position.
 *
 * Read-only, and every row is a stored record. Nothing here is recomputed, so an
 * earlier position always reads as it did when it was recorded.
 */
import { useEffect, useState } from 'react';
import { Circle, Dot } from 'lucide-react';
import { loadHypothesisHistory, timelineFrom, decisionMeta } from '@/lib/hypothesis-updates';
import { Sk } from '@/components/PageSkeleton';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Row({ eyebrow, title, lines, date }) {
  return (
    <div className="relative pl-6">
      <span className="absolute left-0 top-1.5" style={{ color: 'var(--brand-gold-500)' }}><Circle size={10} fill="currentColor" /></span>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{eyebrow}{date ? ` · ${date}` : ''}</p>
      <p className="tp-body mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="tp-meta mt-1 flex items-start gap-1" style={{ color: 'var(--text-secondary)' }}>
          <Dot size={14} className="-ml-1 shrink-0" />{l}
        </p>
      ))}
    </div>
  );
}

export default function HypothesisTimeline({ pathId, pathName, refreshKey }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    loadHypothesisHistory(pathId)
      .then(r => { if (live) setRows(r); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [pathId, refreshKey]);

  if (rows === null) return <Sk h={160} r={20} />;
  if (!rows.length) return null;

  const { initial, updates } = timelineFrom(rows);

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>How this hypothesis has changed</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        Every position you have held on {pathName || 'this direction'} is kept. Updates are added, never written over.
      </p>

      <div className="mt-5 space-y-5 border-l-0">
        {initial && (
          <Row
            eyebrow="Initial hypothesis"
            date={fmt(initial.recorded_at || initial.created_date)}
            title={initial.hypothesis_statement || pathName || 'Where you started'}
            lines={[
              initial.confidence_after != null && `Confidence when you started: ${initial.confidence_after}%.`,
              initial.remaining_unknowns?.length && `Open then: ${initial.remaining_unknowns.slice(0, 2).join('; ')}`,
            ]}
          />
        )}

        {updates.map(u => (
          <Row
            key={u.id || u.sequence}
            eyebrow={`Experiment ${u.sequence} → Update`}
            date={fmt(u.recorded_at || u.created_date)}
            title={u.experiment_title || `Update ${u.sequence}`}
            lines={[
              `${u.confidence_label_before || 'Not rated'} → ${u.confidence_label_after || 'Not rated'} confidence${u.confidence_label_source === 'student_corrected' ? ' (your correction)' : ''}.`,
              u.decision && `Decision: ${decisionMeta(u.decision)?.label || u.decision}.`,
              u.strengthened_by?.length && `Strengthened by: ${u.strengthened_by[0].text}`,
              u.weakened_by?.length && `Weakened by: ${u.weakened_by[0].text}`,
              u.remaining_unknowns?.length && `Still open: ${u.remaining_unknowns[0]}`,
              u.student_correction && `Your note: “${u.student_correction}”`,
            ]}
          />
        ))}

        {updates.length > 0 && (
          <Row
            eyebrow="Current position"
            title={`${updates[updates.length - 1].confidence_label_after || 'Not rated'} confidence · ${decisionMeta(updates[updates.length - 1].decision)?.label || 'Recorded'}`}
            lines={[updates[updates.length - 1].next_best_test && `Next best test: ${updates[updates.length - 1].next_best_test}`]}
          />
        )}
      </div>
    </section>
  );
}