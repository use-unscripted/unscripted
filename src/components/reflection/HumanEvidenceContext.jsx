import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { CHANGED_EXPECTATION_OPTIONS } from '@/lib/human-reality';
import { humanEvidenceReflected } from '@/lib/analytics/human-reality-events';

/**
 * Reflection reads the conversation.
 *
 * A student who spoke to somebody and then reflects on the experiment without
 * that conversation in front of them is reflecting on half of what they know.
 * This block carries it in: the unknown, the questions asked, what they learned,
 * what changed, and what is still theirs to test.
 *
 * The last line is the point of the whole block: hearing about the work is not
 * the same as doing it, and where firsthand testing is possible it still wins.
 */
export default function HumanEvidenceContext({ pathId, cycleId }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!pathId && !cycleId) { setRows([]); return () => {}; }
    base44.entities.HumanRealityConversation
      .filter(cycleId ? { cycle_id: cycleId } : { path_id: pathId }, '-recorded_at', 5)
      .then(list => {
        const found = (Array.isArray(list) ? list : []).filter(c => c.evidence_status === 'human_evidence_recorded');
        if (!alive) return;
        setRows(found);
        if (found.length) {
          humanEvidenceReflected({ pathId, cycleId, stage: found[0].topic_id });
          found.filter(c => !c.reflected_at).forEach(c => {
            base44.entities.HumanRealityConversation.update(c.id, { reflected_at: new Date().toISOString() }).catch(() => {});
          });
        }
      })
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [pathId, cycleId]);

  if (!rows || !rows.length) return null;

  return (
    <section className="app-card p-6">
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What someone doing the work told you</h2>
      </div>

      {rows.map(c => (
        <div key={c.id} className="app-card-flat mt-4 p-4">
          <p className="tp-control" style={{ color: 'var(--ink-900)' }}>{c.professional_role || 'A professional'}</p>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            {c.uncertainty_question || c.topic_label}
          </p>
          <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{c.key_learning}</p>
          {(c.questions_asked || []).length > 0 && (
            <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>
              You asked: {(c.questions_asked || []).join(' ')}
            </p>
          )}
          <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>
            {CHANGED_EXPECTATION_OPTIONS.find(o => o.id === c.changed_expectation)?.label}
            {c.remaining_unknown ? ` \u00b7 Still unknown: ${c.remaining_unknown}` : ''}
          </p>
        </div>
      ))}

      <div className="mt-5">
        <p className="tp-label" style={{ color: 'var(--ink-500)' }}>Worth answering as you reflect</p>
        <ul className="tp-body mt-2 space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>What did hearing from someone actually doing the work change about your thinking?</li>
          <li>Did anything they said challenge an assumption you had?</li>
          <li>What still needs to be tested through your own experience?</li>
        </ul>
      </div>

      <p className="tp-meta mt-4 rounded-[var(--r-control)] px-3 py-2" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>
        Their perspective explains the work. It does not replace testing it yourself where that is possible.
      </p>
    </section>
  );
}