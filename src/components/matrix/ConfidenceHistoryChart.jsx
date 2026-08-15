import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

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
            <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>– {s.text || s}</li>
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

  const length = Math.max(...series.map(s => s.trend.points.length));
  const data = Array.from({ length }, (_, i) => {
    const point = { step: series.find(s => s.trend.points[i])?.trend.points[i]?.label || `Step ${i + 1}` };
    series.forEach(s => { point[s.name] = s.trend.points[i]?.value ?? null; });
    return point;
  });

  const onPoint = (careerName, index) => {
    const s = series.find(x => x.name === careerName);
    const p = s?.trend.points[index];
    if (p) setSelected({ ...p, career: careerName });
  };

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>How your career thinking has changed</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Each point is a hypothesis update you recorded. Tap a point to see what moved it.
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

      <div className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="step" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border-light)' }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border-light)', fontSize: 12 }}
              formatter={(v, name) => [`${v}%`, name]}
            />
            {series.map((s, i) => (
              <Line key={s.pathId} type="monotone" dataKey={s.name} connectNulls
                stroke={STROKES[i].color} strokeWidth={2.5} strokeDasharray={STROKES[i].dash}
                dot={{ r: 4, strokeWidth: 2, fill: 'var(--background-primary)', cursor: 'pointer' }}
                activeDot={{ r: 6, onClick: (_, payload) => onPoint(s.name, payload?.index ?? 0) }}
                isAnimationActive
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Explain point={selected} />
    </section>
  );
}