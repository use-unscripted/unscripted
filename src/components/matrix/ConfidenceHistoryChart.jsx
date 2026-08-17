import { useState } from 'react';
import { humanDate } from '@/lib/matrix-provenance';

/**
 * How the student's thinking has changed, read from stored hypothesis versions
 * rather than recomputed. A score that existed at a point in time keeps the
 * value it had then, so re-running today's formula never rewrites the past.
 *
 * Each line is distinguished by colour AND dash pattern, so the chart is still
 * readable without colour.
 */
const STROKES = [
  { color: 'var(--brand-navy-700)', dash: '' },
  { color: 'var(--brand-gold-600)', dash: '7 4' },
  { color: 'var(--ink-500)', dash: '2 4' },
];

function Explain({ point }) {
  if (!point) return null;
  return (
    <div className="app-card-flat mt-4 p-4">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Why did this change?</p>
      <p className="tp-card mt-1.5" style={{ color: 'var(--text-primary)' }}>
        {point.career}: {point.value}% after {point.label}
      </p>
      {/* The date of the record itself, so the point can be traced back to the
          update the student actually recorded. Never an id. */}
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        {[point.previous !== null && point.previous !== undefined ? `Previously ${point.previous}%` : null,
          humanDate(point.at) ? `Recorded ${humanDate(point.at)}` : null].filter(Boolean).join(' · ')}
      </p>
      {point.change && <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{point.change}</p>}
      {point.strengthened?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {point.strengthened.slice(0, 3).map((s, i) => (
            <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>+ {s.text || s}</li>
          ))}
        </ul>
      )}
      {point.weakened?.length > 0 && (
        <ul className="mt-1 space-y-1">
          {point.weakened.slice(0, 3).map((s, i) => (
            <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>- {s.text || s}</li>
          ))}
        </ul>
      )}
      {!point.change && !point.strengthened?.length && !point.weakened?.length && (
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          This version was recorded without a written explanation.
        </p>
      )}
    </div>
  );
}

export default function ConfidenceHistoryChart({ rows }) {
  const [selected, setSelected] = useState(null);
  const series = rows.filter(r => r.trend.points.length >= 2).slice(0, 3);

  if (!series.length) {
    return (
      <section className="app-card p-6">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>How your career thinking has changed</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          This graph appears once a direction has been updated at least twice, after reflecting on real experiments.
        </p>
      </section>
    );
  }

  /* Drawn as plain SVG rather than through a charting library: the chart is a
     handful of straight lines on a fixed 0–100 scale, and the library was a
     large extra dependency for it. viewBox scaling keeps it responsive. */
  const length = Math.max(...series.map(s => s.trend.points.length));
  const W = 720, H = 280, L = 38, R = 12, T = 12, B = 30;
  const x = (i) => L + (length > 1 ? (i * (W - L - R)) / (length - 1) : (W - L - R) / 2);
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  const labels = Array.from({ length }, (_, i) =>
    series.find(s => s.trend.points[i])?.trend.points[i]?.label || `Step ${i + 1}`);

  const onPoint = (careerName, index) => {
    const s = series.find(x => x.name === careerName);
    const p = s?.trend.points[index];
    // The previous point's stored value, so "why did this change?" can show what
    // it changed FROM without recomputing history.
    const prev = index > 0 ? s?.trend.points[index - 1]?.value : null;
    if (p) setSelected({ ...p, career: careerName, previous: prev ?? null });
  };

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>How your career thinking has changed</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Each point is a path update you recorded. Tap a point to see what moved it.
      </p>

      <div className="mt-5 flex flex-wrap gap-4">
        {series.map((s, i) => (
          <span key={s.pathId} className="tp-meta inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <svg width="26" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="26" y2="4" stroke={STROKES[i].color} strokeWidth="3" strokeDasharray={STROKES[i].dash} />
            </svg>
            {s.name}
          </span>
        ))}
      </div>

      <div className="mt-4 w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[280px] w-full" role="img"
          aria-label="Confidence over time for each hypothesis you have updated">
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border-light)" strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{v}</text>
            </g>
          ))}
          {labels.map((label, i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {label.length > 14 ? `${label.slice(0, 13)}…` : label}
            </text>
          ))}
          {series.map((s, si) => {
            const pts = s.trend.points
              .map((p, i) => (typeof p.value === 'number' ? { i, value: p.value } : null))
              .filter(Boolean);
            return (
              <g key={s.pathId}>
                <polyline
                  points={pts.map(p => `${x(p.i)},${y(p.value)}`).join(' ')}
                  fill="none" stroke={STROKES[si].color} strokeWidth="2.5"
                  strokeDasharray={STROKES[si].dash} strokeLinecap="round"
                />
                {pts.map(p => (
                  <circle key={p.i} cx={x(p.i)} cy={y(p.value)} r="5"
                    fill="var(--background-primary)" stroke={STROKES[si].color} strokeWidth="2.5"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onPoint(s.name, p.i)}
                  >
                    <title>{`${s.name}: ${p.value}%`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <Explain point={selected} />
    </section>
  );
}