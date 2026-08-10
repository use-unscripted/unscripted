import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { recalculateAfterReflection } from '@/lib/hypothesis-recalculation';
import WhyThisChanged from '@/components/paths/WhyThisChanged';
import { Sk } from '@/components/PageSkeleton';

/**
 * What the reflection changed.
 *
 * Runs once per saved reflection: the reflection joins the measurements, proof
 * and prior evidence, the affected career hypotheses are recalculated, and the
 * result is shown here rather than changing scores invisibly.
 */
export default function EvidenceUpdatePanel({ reflection, experiment }) {
  const [state, setState] = useState('working');
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    let live = true;
    setState('working');
    recalculateAfterReflection({ reflection, experiment })
      .then(rows => { if (live) { setChanges(rows); setState('done'); } })
      .catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [reflection?.id, experiment?.id]);

  if (state === 'failed') return null;

  return (
    <section className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-card" style={{ color: 'var(--text-primary)' }}>What this reflection changed</p>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
        Your reflection was added to your pre and post check-ins, your deliverables and everything you had already recorded, and the careers it affects were recalculated.
      </p>

      {state === 'working' ? (
        <div className="mt-4 space-y-3"><Sk h={112} r={16} /></div>
      ) : changes.length ? (
        <div className="mt-4 space-y-3">
          {changes.map(c => <WhyThisChanged key={c.path.id} change={c} defaultOpen={changes.length === 1} />)}
        </div>
      ) : (
        <p className="tp-prose mt-4" style={{ color: 'var(--text-secondary)' }}>
          This is now part of your evidence, and it did not move any career estimate far enough to report. One experiment rarely does.
        </p>
      )}

      <Link to="/career-profile" className="tp-meta mt-4 inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
        See your career evidence profile <ArrowUpRight size={12} />
      </Link>
    </section>
  );
}