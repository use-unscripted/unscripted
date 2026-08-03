/**
 * Loading skeletons — the layout arrives before the data does.
 *
 * The problem this solves: every page used to render its header instantly and
 * then a ~120px "Loading…" line where 800px of content was about to appear.
 * The moment the data landed the page grew, a scrollbar appeared, and the whole
 * window shifted sideways. Small individually, awful in aggregate — clicking
 * anything made the site lurch twice.
 *
 * The rule here is that a skeleton is a *tracing* of the real screen, not a
 * generic grey box. Same page width, same header block, same control row, same
 * card heights, same gaps. If a control only renders once data exists, the
 * skeleton still reserves its row — otherwise everything below it drops when it
 * appears.
 *
 * Nothing in here animates position. Shimmer is a background-position loop and
 * the swap to real content is opacity only, so no skeleton can ever be the
 * thing that moves the layout.
 */

const MAX_W = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

/** One shimmering block. Everything else is composed out of this. */
export function Sk({ h = 12, w = '100%', r = 8, className = '', style = {} }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={{ height: h, width: w, borderRadius: r, ...style }}
    />
  );
}

/**
 * The PageHeader footprint, to the pixel-ish: optional eyebrow, a 3xl/4xl
 * heading, an optional description line, and an optional right-hand action
 * button that sits inline on desktop and stacks on mobile.
 */
export function SkHeader({
  eyebrow = false,
  description = true,
  descriptionLines = 2,
  action = false,
  actionWidth = 186,
  actionHeight = 44,
  titleWidth = '62%',
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full">
        {/* Each block sits inside a box the exact height of the real line it
            stands in for — eyebrow 16px, title 36/40px, description 24px a
            line — so the header never resizes when the words turn up. */}
        {eyebrow && (
          <div className="mb-2 flex h-4 items-center">
            <Sk h={10} w={118} r={3} />
          </div>
        )}
        <div className="flex h-9 items-center sm:h-10">
          <Sk h={30} w={titleWidth} r={8} style={{ maxWidth: 520 }} />
        </div>
        {description && (
          <div className="mt-2" style={{ maxWidth: 640 }}>
            {Array.from({ length: descriptionLines }).map((_, i) => (
              <div key={i} className="flex h-6 items-center">
                <Sk h={13} r={5} w={i === descriptionLines - 1 ? '54%' : '94%'} />
              </div>
            ))}
          </div>
        )}
      </div>
      {action && <Sk h={actionHeight} w={actionWidth} r={10} className="shrink-0" />}
    </div>
  );
}

/**
 * The search + filter row. `filters` is how many dropdowns sit next to the
 * search box. Pass search={false} for pages that are filter pills only.
 */
export function SkControls({ search = true, filters = 0, className = 'mb-6' }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {search && <Sk h={42} r={12} className="flex-1" style={{ minWidth: 200 }} />}
      {Array.from({ length: filters }).map((_, i) => (
        <Sk key={i} h={42} w={200} r={12} className="w-full sm:w-[200px]" />
      ))}
    </div>
  );
}

/** A row of filter pills, e.g. Active / Planned / Completed. */
export function SkPills({ count = 5, className = 'mb-4' }) {
  const widths = [64, 78, 96, 88, 62, 70, 84];
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} h={26} w={widths[i % widths.length]} r={999} />
      ))}
    </div>
  );
}

/** A stack of cards at the real card height, with the real gap between them. */
export function SkCards({ count = 3, h = 140, gap = 16, r = 20 }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} h={h} r={r} />
      ))}
    </div>
  );
}

/** A responsive card grid. `cols` is the desktop column count. */
export function SkGrid({ count = 6, h = 180, cols = 3, gap = 16, r = 20 }) {
  const cls = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${cls}`} style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} h={h} r={r} />
      ))}
    </div>
  );
}

/** A run of text lines — last one short, the way real paragraphs end. */
export function SkText({ lines = 3, h = 13, gap = 9 }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Sk key={i} h={h} r={5} w={i === lines - 1 ? '48%' : i % 2 ? '88%' : '96%'} />
      ))}
    </div>
  );
}

/** A row of stat tiles. */
export function SkStats({ count = 4, h = 92, r = 16 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} h={h} r={r} />
      ))}
    </div>
  );
}

/**
 * The whole-page skeleton, for pages that render nothing at all until data
 * lands. Same `<main>` wrapper the real page uses, so the content box is
 * already the right width and inset before anything arrives.
 */
export function PageSkeleton({ maxWidth = '5xl', children, ...header }) {
  return (
    <main className={`mx-auto ${MAX_W[maxWidth] || MAX_W['5xl']} px-5 py-10 sm:px-8`}>
      <SkHeader {...header} />
      {children}
    </main>
  );
}

/**
 * Swaps a skeleton for real content without the box changing size underneath
 * the user. `minHeight` holds the region open at roughly the loaded height, so
 * short results don't yank the footer up and long ones only ever extend
 * downward — nothing above the fold moves either way.
 *
 * The fade is opacity-only and deliberately quick. A transform here would
 * reintroduce exactly the motion this whole file exists to remove.
 */
export function SkSwap({ loading, skeleton, minHeight = 320, children }) {
  return (
    <div style={{ minHeight }}>
      {loading ? skeleton : <div className="content-in">{children}</div>}
    </div>
  );
}

export default PageSkeleton;
