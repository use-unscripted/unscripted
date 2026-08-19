/**
 * Conviction, per path, inside the Career Decision Matrix. Not a second
 * dashboard: it sits with the scores it is read from.
 */
import PathConvictionCard from '@/components/matrix/PathConvictionCard';

export default function ConvictionInMatrix({ rows = [], conviction = {}, onOpen }) {
  const withConviction = rows.filter(r => conviction[r.pathId]);
  if (!withConviction.length) return null;

  return (
    <section>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Where each path stands</h2>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        How much real evidence sits behind each direction, what it still turns on, and the one test that would move it.
        Decision ready means you could decide on evidence rather than a guess. It never means the career is the right one.
      </p>
      <div className="mt-4 space-y-4">
        {withConviction.map(row => (
          <PathConvictionCard key={row.pathId} row={row} conviction={conviction[row.pathId]} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}