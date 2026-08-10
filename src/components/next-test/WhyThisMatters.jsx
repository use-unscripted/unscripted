/**
 * "Why this matters" — what is already known, what is still open, why this test
 * is the useful one, and which paths it would help clarify.
 */
export default function WhyThisMatters({ detail }) {
  if (!detail) return null;

  const block = (heading, lines) => (
    <div>
      <h4 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{heading}</h4>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>{line}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mt-5 space-y-5 rounded-[16px] border p-5" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
      {block('What we already know', detail.known)}
      {block('What we are still learning', detail.learning)}
      {block('Why this experiment matters', [detail.why, detail.could_lower])}

      {detail.clarifies?.length > 0 && (
        <div>
          <h4 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Paths this could clarify</h4>
          <ul className="mt-2 space-y-2">
            {detail.clarifies.map(c => (
              <li key={c.path_id} className="tp-body" style={{ color: 'var(--ink-700)' }}>
                <span className="font-semibold" style={{ color: 'var(--ink-900)' }}>{c.path_name}</span>
                {' — '}{c.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}