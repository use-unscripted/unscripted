/**
 * "What your evidence just did" — shown once the post check-in is saved.
 *
 * Plain sentences only: no scores, no bars, no percentages. Every line is read
 * off values that were already stored, and nothing here writes anything.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { loadEvidenceImpact } from '@/lib/evidence-impact';
import { Sk } from '@/components/PageSkeleton';

function Line({ children }) {
  return <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}

function Block({ title, children }) {
  return (
    <div className="mt-5">
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {children}
    </div>
  );
}

export default function EvidenceImpactPanel({ exp, measurement, pathId }) {
  const [state, setState] = useState({ loading: true, impact: null });

  useEffect(() => {
    let alive = true;
    loadEvidenceImpact({ experiment: exp, measurement, pathId })
      .catch(() => null)
      .then(impact => { if (alive) setState({ loading: false, impact }); });
    return () => { alive = false; };
  }, [exp?.id, measurement?.post_completed_at, pathId]);

  if (state.loading) return <Sk h={280} r={20} />;
  const i = state.impact;
  if (!i) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What your evidence just did</h2>

      {i.gap && (
        <Block title="The gap you tested">
          <Line>
            This test gave evidence on {i.gap.label}.
            {i.gap.state ? ` That gap now reads as ${i.gap.state.toLowerCase()}.` : ''}
          </Line>
        </Block>
      )}

      {i.method && (
        <Block title={`This was ${i.method.label.toLowerCase()} evidence`}>
          <Line>{i.method.weightNote}</Line>
          <Line>{i.ladderRule}</Line>
        </Block>
      )}

      {i.comparison.length > 0 && (
        <Block title="Against what you expected">
          <Line>You found the work {i.comparison.join(', ')}.</Line>
        </Block>
      )}

      {(i.movement.length > 0 || i.coverage.total > 0) && (
        <Block title="What this moved about the path">
          {i.movement.map(line => <Line key={line}>{line}</Line>)}
          {i.coverage.total > 0 && (
            <Line>
              {i.pathName || 'This path'} now has evidence behind {i.coverage.withEvidence} of {i.coverage.total} gaps.
            </Line>
          )}
        </Block>
      )}

      {i.contradictions.length > 0 && (
        <div className="app-inset mt-5 p-4" style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)' }}>
          <p className="tp-body flex items-center gap-2 font-bold" style={{ color: 'var(--warning-700)' }}>
            <AlertTriangle size={15} /> This disagrees with something you recorded earlier
          </p>
          {i.contradictions.map(c => (
            <p key={c.id} className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{c.note}</p>
          ))}
          <p className="tp-prose mt-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
            Both readings are kept. Neither one is discarded, and further testing is what settles it.
          </p>
        </div>
      )}

      {i.nextGap && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border-light)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>The obvious next move</p>
          <Line>{i.nextGap.label} has nothing behind it yet. {i.nextGap.question}</Line>
          <Link
            to={`/conviction-lab?pathId=${pathId}`}
            className="ui-press app-cta tp-control mt-4"
            style={{ minHeight: '48px' }}
          >
            Test {i.nextGap.label.toLowerCase()} next
          </Link>
        </div>
      )}
    </section>
  );
}