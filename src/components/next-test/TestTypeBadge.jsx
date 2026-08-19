/**
 * Which kind of test this is, and what it is aimed at. A framing only: the test
 * itself runs on the same experiment, evidence and reflection path as any other.
 */
export default function TestTypeBadge({ label, purpose, produces }) {
  if (!label) return null;
  return (
    <div className="mt-3 rounded-[var(--r-control)] px-3 py-2.5" style={{ background: 'var(--ink-100)' }}>
      <p className="tp-meta font-bold" style={{ color: 'var(--ink-900)' }}>{label}</p>
      {purpose && <p className="tp-meta mt-1" style={{ color: 'var(--ink-700)' }}>{purpose}</p>}
      {produces && <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>{produces}</p>}
    </div>
  );
}