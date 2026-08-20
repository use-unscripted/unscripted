/**
 * The matrix at a glance: four soft quadrants, two labelled axes, one marker per
 * path. Readable in a few seconds, and deliberately shallow — the deeper metrics
 * stay in the table and the conviction cards below it.
 *
 * Every value plotted is a reading the matrix already computed. Tapping a marker
 * reveals that path's existing conviction card, which is where the provenance and
 * the "Why does Unscripted think this?" panel already live.
 */
import { Compass, TrendingUp, Search, RotateCcw } from 'lucide-react';
import { QUADRANTS } from '@/lib/matrix-quadrant';

const ICONS = {
  validate: Compass,
  continue: TrendingUp,
  exposure: Search,
  reassess: RotateCcw,
};

/* Top row then bottom row, matching the corners named in the model. */
const ORDER = ['validate', 'continue', 'exposure', 'reassess'];

const clamp = (v) => Math.max(7, Math.min(93, v));

export default function QuadrantChart({ points = [], unplaced = [], selectedId, onSelect }) {
  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Where your paths stand</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)', maxWidth: '58ch' }}>
        Tap a path to see the evidence behind its position.
      </p>

      <div className="mt-6 flex gap-2 sm:gap-3">
        {/* Vertical axis */}
        <div className="flex w-6 shrink-0 flex-col items-center justify-between py-1 sm:w-8">
          <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>High</span>
          <span className="tp-meta whitespace-nowrap font-semibold" style={{
            color: 'var(--text-primary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          }}>
            Path confidence
          </span>
          <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>Low</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative aspect-square w-full sm:aspect-[4/3]">
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5 sm:gap-2">
              {ORDER.map(key => {
                const q = QUADRANTS[key];
                const Icon = ICONS[key];
                return (
                  <div key={key} className="flex flex-col p-2.5 sm:p-4"
                    style={{ background: q.bg, borderRadius: 'var(--r-control)' }}>
                    <Icon size={16} style={{ color: q.fg }} />
                    <p className="tp-card mt-1.5 leading-tight" style={{ color: 'var(--text-primary)' }}>{q.title}</p>
                    <p className="tp-meta mt-1 hidden sm:block" style={{ color: q.fg, maxWidth: '30ch' }}>{q.message}</p>
                  </div>
                );
              })}
            </div>

            {/* The markers. Position is the reading itself: coverage across,
                confidence up. */}
            {points.map(p => {
              const active = p.pathId === selectedId;
              return (
                <button key={p.pathId} type="button" onClick={() => onSelect(p)}
                  aria-label={`${p.name}: confidence ${p.confidence}, evidence coverage ${p.coverage}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${clamp(p.coverage)}%`,
                    bottom: `${clamp(p.confidence)}%`,
                    width: 30,
                    height: 30,
                    background: active ? 'var(--brand-gold-500)' : 'var(--brand-navy-900)',
                    color: active ? 'var(--brand-navy-900)' : 'var(--brand-white)',
                    boxShadow: 'var(--elev-cta)',
                    fontWeight: 700,
                    fontSize: 13,
                  }}>
                  {p.index}
                </button>
              );
            })}
          </div>

          {/* Horizontal axis */}
          <div className="mt-2 flex items-center justify-between">
            <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>Low</span>
            <span className="tp-meta font-semibold" style={{ color: 'var(--text-primary)' }}>Evidence coverage</span>
            <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>High</span>
          </div>
        </div>
      </div>

      {/* Which marker is which. Also the tap target on a phone, where a 30px
          circle is not much to aim at. */}
      <ul className="mt-5 space-y-2">
        {points.map(p => (
          <li key={p.pathId}>
            <button type="button" onClick={() => onSelect(p)}
              className="touch-target flex w-full items-center gap-3 px-3 py-2 text-left"
              style={{
                background: p.pathId === selectedId ? 'var(--ink-100)' : 'transparent',
                borderRadius: 'var(--r-control)',
              }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full tp-meta font-bold"
                style={{ background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }}>{p.index}</span>
              <span className="min-w-0 flex-1">
                <span className="tp-body block truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>
                  {p.readyLabel || p.quadrant.title} · confidence {p.confidence} · coverage {p.coverage}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {unplaced.length > 0 && (
        <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
          {unplaced.map(u => u.name).join(', ')} {unplaced.length === 1 ? 'is' : 'are'} not plotted yet: there is no
          confidence or coverage reading behind {unplaced.length === 1 ? 'it' : 'them'} so far.
        </p>
      )}
    </section>
  );
}