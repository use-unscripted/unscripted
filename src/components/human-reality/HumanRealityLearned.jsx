import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { CHANGED_EXPECTATION_OPTIONS, REPRESENTATIVENESS_LABELS } from '@/lib/human-reality';

/**
 * What this conversation moved, said plainly, plus what it deliberately did not.
 *
 * Human exposure, the unknown it was aimed at and the Path's recorded insight
 * all move. Fit and confidence do not: one conversation is not a reason to
 * believe a Path suits somebody, however useful what they heard was.
 */
export default function HumanRealityLearned({ record, brief }) {
  const changed = CHANGED_EXPECTATION_OPTIONS.find(o => o.id === record.changed_expectation)?.label;
  const rep = REPRESENTATIVENESS_LABELS.get(record.representativeness);

  return (
    <section className="app-card p-6 sm:p-8">
      <p className="tp-body flex items-center gap-2 font-bold" style={{ color: 'var(--success-700)' }}>
        <Check size={16} aria-hidden="true" /> Recorded as human evidence
      </p>
      <h2 className="tp-section mt-3" style={{ color: 'var(--ink-900)' }}>Human Evidence added</h2>

      <dl className="mt-4 space-y-3">
        <div>
          <dt className="tp-label" style={{ color: 'var(--ink-500)' }}>What we learned</dt>
          <dd className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{record.key_learning}</dd>
        </div>
        <div>
          <dt className="tp-label" style={{ color: 'var(--ink-500)' }}>What changed</dt>
          <dd className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>
            {changed}{record.changed_expectation_note ? ` \u2014 ${record.changed_expectation_note}` : ''}
          </dd>
        </div>
        <div>
          <dt className="tp-label" style={{ color: 'var(--ink-500)' }}>What still needs to be tested</dt>
          <dd className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>
            {record.remaining_unknown
              || 'How you personally respond to this work. That only comes from doing it yourself.'}
          </dd>
        </div>
        <div>
          <dt className="tp-label" style={{ color: 'var(--ink-500)' }}>Updated on your Path</dt>
          <dd className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>
            Human exposure, {brief?.topic_label ? brief.topic_label.toLowerCase() : 'this open question'}, and the insight
            recorded against {record.path_name || 'this path'}.
            {rep ? ` Weighted as: ${rep.toLowerCase()}.` : ''}
          </dd>
        </div>
      </dl>

      <p className="tp-meta mt-4 rounded-[var(--r-control)] px-3 py-2" style={{ background: 'var(--info-50)', color: 'var(--info-700)' }}>
        Your fit and confidence scores are unchanged. Those move on evidence from work you have done yourself.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/matrix" className="ui-press app-cta tp-control">View updated Matrix</Link>
        <Link to="/journey" className="app-cta-secondary tp-control">Continue path</Link>
        <Link to="/evidence?tab=human" className="app-cta-secondary tp-control">See it in Evidence</Link>
      </div>
    </section>
  );
}