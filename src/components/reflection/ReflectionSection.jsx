/** One numbered section of the reflection: a title, a lead, and its questions. */
const field = 'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none resize-none';
const fieldStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

export default function ReflectionSection({ section, answers, onChange, children }) {
  return (
    <section className="rounded-[var(--r-control)] p-4 sm:p-5" style={{ background: 'var(--ink-50)', border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Section {section.number}</p>
      <h3 className="tp-card mt-1.5" style={{ color: 'var(--text-primary)' }}>{section.title}</h3>
      {section.lead && <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>{section.lead}</p>}

      {children}

      {section.questions.length > 0 && (
        <div className="mt-4 space-y-4">
          {section.questions.map(q => (
            <label key={q.key} className="block">
              <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
                {q.label}
                {!q.required && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · optional</span>}
              </span>
              <textarea
                rows={q.rows}
                value={answers[q.key] || ''}
                onChange={e => onChange(q.key, e.target.value)}
                placeholder={q.placeholder}
                className={`${field} mt-1.5 bg-white`}
                style={fieldStyle}
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}