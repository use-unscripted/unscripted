/**
 * Path Triangulation Summary: shown directly below the matrix, and only for a
 * path that is Path Complete.
 *
 * Four blocks, in order: whether independent kinds of evidence agree, where the
 * conclusion rests on the ladder, what still contradicts what, and gap by gap
 * coverage. Every number is a count of something the student produced.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/motion';
import TriangulationContradictions from '@/components/matrix/TriangulationContradictions';
import TriangulationGapCoverage from '@/components/matrix/TriangulationGapCoverage';
import { KEEP_TESTING_NOTE, PATH_COMPLETE_CAVEAT } from '@/lib/path-completion';

function Block({ n, title, note, children, wide = false }) {
  return (
    <section className={wide ? 'app-card-flat p-5' : 'app-card-flat p-5'}>
      <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
        {n}. {title}
      </p>
      {note && <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MethodRow({ label, tests, direction }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="tp-body" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>
        {tests} {tests === 1 ? 'piece' : 'pieces'}
        {direction ? ` · points ${direction === 'toward' ? 'toward' : direction === 'away' ? 'away' : 'neither way'}` : ''}
      </span>
    </div>
  );
}

export default function PathTriangulationSummary({ row, triangulation }) {
  if (!triangulation) return null;
  const { agreement, strength, conflicts, hasContradiction, coverage, testedOnce } = triangulation;

  return (
    <Reveal y={16}>
      <section className="app-card p-5 sm:p-6"
        style={hasContradiction ? { borderColor: 'var(--warning-700)' } : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
              How the evidence on this path lines up
            </h2>
            <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{row?.name}</p>
          </div>
          <span className="tp-meta rounded-full px-3 py-1 font-semibold"
            style={hasContradiction
              ? { background: 'var(--warning-50)', color: 'var(--warning-700)' }
              : { background: 'var(--success-50)', color: 'var(--success-700)' }}>
            {hasContradiction ? 'Something still disagrees' : 'Nothing disagrees yet'}
          </span>
        </div>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          The matrix says where this path stands. This says why it stands there, and how much the evidence so far can carry.
        </p>

        <div className="mt-5 space-y-4">
          <Block n={1} title="Whether the evidence agrees" note={agreement.summary}>
            <div className="app-inset space-y-2 p-4" style={{ background: 'var(--ink-50)' }}>
              {agreement.methods.length ? agreement.methods.map(m => (
                <MethodRow key={m.id} label={m.label} tests={m.tests} direction={m.direction} />
              )) : (
                <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                  No completed test has produced evidence on this path yet.
                </p>
              )}
            </div>
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
              Compared across kinds of evidence, never within one.
            </p>
          </Block>

          <Block n={2} title="Where the evidence sits" note={strength.summary}>
            <div className="app-inset space-y-2 p-4" style={{ background: 'var(--ink-50)' }}>
              {strength.rows.filter(r => r.tests > 0).map(r => (
                <MethodRow key={r.id} label={r.label} tests={r.tests} />
              ))}
            </div>
            {strength.highestLabel && (
              <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
                The heaviest piece of evidence here is {strength.highestLabel}.
              </p>
            )}
          </Block>

          {/* The most important of the four, so it gets the most room. */}
          <Block n={3} title="What still disagrees"
            note="What disagrees with what, and the question each disagreement leaves open.">
            <TriangulationContradictions conflicts={conflicts} />
          </Block>

          <Block n={4} title="Gap by gap">
            <TriangulationGapCoverage coverage={coverage} testedOnce={testedOnce} />
          </Block>
        </div>

        <p className="tp-meta mt-5" style={{ color: 'var(--text-muted)' }}>
          {PATH_COMPLETE_CAVEAT} {KEEP_TESTING_NOTE}
        </p>

        <Link to="/decide" className="app-cta tp-control mt-4 inline-flex">
          Take this to a decision <ArrowRight size={14} />
        </Link>
      </section>
    </Reveal>
  );
}