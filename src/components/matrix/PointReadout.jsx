/**
 * What one point on the confidence graph actually was: the experiment the
 * student ran, and the conviction gap that experiment was testing.
 *
 * This exists because the graph used to name every point along the bottom axis,
 * where a dozen experiment titles collided into unreadable stubs. The names
 * belong to the points, not to an axis.
 */
export default function PointReadout({ hover }) {
  if (!hover) {
    return (
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        Hover or tap a point to see the experiment behind it.
      </p>
    );
  }

  const { series, index, stroke } = hover;
  const point = series.trend.points[index];
  if (!point) return null;

  return (
    <div
      className="mt-3 rounded-[var(--r-control)] p-4"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
    >
      <p className="tp-meta inline-flex items-center gap-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
        <svg width="20" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="20" y2="4" stroke={stroke.color} strokeWidth="3" strokeDasharray={stroke.dash} />
        </svg>
        {series.name} · {point.value}%
      </p>
      <p className="tp-card mt-1.5" style={{ color: 'var(--text-primary)' }}>
        {point.experiment || point.label}
      </p>
      {point.tested && (
        <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>
          Gap tested: {point.tested}
        </p>
      )}
    </div>
  );
}