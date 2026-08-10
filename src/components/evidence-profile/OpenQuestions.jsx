/**
 * The unresolved questions from each Career Uncertainty Map.
 * These are stated as open, never answered here, and choosing which to test next
 * is deliberately not part of this screen.
 */
export default function OpenQuestions({ questions }) {
  const untested = questions.filter(q => !q.tested);
  const partial = questions.filter(q => q.tested);

  const group = (label, items) => items.length > 0 && (
    <div className="rounded-[16px] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <p className="tp-eyebrow mb-3" style={{ color: 'var(--ink-500)' }}>{label}</p>
      <ul className="space-y-3">
        {items.map(q => (
          <li key={q.key}>
            <p className="tp-body font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{q.question}</p>
            <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-400)' }}>
              {q.label} · {q.career}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      {group('Still untested', untested)}
      {group('Only partly tested', partial)}
    </div>
  );
}