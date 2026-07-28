/* ──────────────────────────────────────────────────────────────────────────
   University names extracted from the Unscripted teaser document.
   Domestic + International user presence.
   ────────────────────────────────────────────────────────────────────────── */
const UNIVERSITIES = [
  // Domestic
  'Arizona State',
  'Boston College',
  'Brown University',
  'Boston University',
  'Clemson University',
  'Columbia University',
  'Cornell University',
  'Dartmouth College',
  'Florida State',
  'Georgetown',
  'James Madison',
  'Liberty University',
  'LeTourneau University',
  'University of Maryland',
  'University of Michigan',
  'NC State',
  'University of Notre Dame',
  'NYU',
  'University of Oklahoma',
  'UPenn',
  'Princeton University',
  'San Diego State',
  'Syracuse University',
  'Temple University',
  'UT Austin',
  'Tulane University',
  'UConn',
  'UMass Amherst',
  'UNC Chapel Hill',
  'USC',
  'University of Tennessee',
  'Vanderbilt',
  'Virginia Tech',
  'Xavier University',
  'Yale University',
  'Ohio State',
  'UC San Diego',
  'New Hampshire',
  // International
  'University of Cambridge',
  'University of Oxford',
  'University of Toronto',
  'McGill University',
  'Dublin City University',
];

/* Dot separator between names */
const DOT = '·';

export default function UniversityMarquee() {
  // Duplicate the list so the seam is invisible when it loops
  const items = [...UNIVERSITIES, ...UNIVERSITIES, ...UNIVERSITIES];

  return (
    <section
      className="overflow-hidden py-6 border-y"
      style={{
        borderColor: 'var(--border-light)',
        background: 'var(--background-primary)',
      }}
    >
      <p
        className="mb-3 text-center text-[10px] font-bold uppercase tracking-[.18em]"
        style={{ color: 'var(--text-muted)' }}
      >
        Students from 55+ universities
      </p>

      {/* Marquee track */}
      <div className="relative w-full">
        {/* Left + right fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20"
          style={{
            background:
              'linear-gradient(to right, var(--background-primary), transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20"
          style={{
            background:
              'linear-gradient(to left, var(--background-primary), transparent)',
          }}
        />

        {/* Scrolling row */}
        <div className="flex items-center gap-0" style={{ width: 'max-content' }}>
          <div
            className="flex items-center gap-0"
            style={{
              animation: 'marquee-scroll 50s linear infinite',
              willChange: 'transform',
            }}
          >
            {items.map((name, i) => (
              <span
                key={i}
                className="flex items-center gap-0 whitespace-nowrap"
              >
                <span
                  className="px-4 text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {name}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--brand-gold-500)' }}
                >
                  {DOT}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
}