/**
 * Career evidence this week. Real counts only, and nothing is lost by not
 * coming back: this is a record of learning, not a streak.
 */
export default function EvidenceThisWeek({ week }) {
  if (!week) return null;

  const lines = [
    week.quickTests && `${week.quickTests} Quick Test${week.quickTests === 1 ? '' : 's'} completed`,
    week.deepDives && `${week.deepDives} Deep Dive${week.deepDives === 1 ? '' : 's'} completed`,
    week.dimensions && `${week.dimensions} career dimension${week.dimensions === 1 ? '' : 's'} tested`,
    week.moreConfident && `${week.moreConfident} path${week.moreConfident === 1 ? '' : 's'} became more confident`,
  ].filter(Boolean);
  if (!lines.length) return null;

  return (
    <section className="rounded-[20px] border bg-white p-6" style={{ borderColor: 'var(--ink-200)' }}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Career evidence this week</h2>
      <ul className="mt-3 space-y-1.5">
        {lines.map(line => (
          <li key={line} className="tp-body" style={{ color: 'var(--ink-700)' }}>{line}</li>
        ))}
      </ul>
    </section>
  );
}