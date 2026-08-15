/** What changed between the previous version and this one, field by field. */
export default function RevisionDiff({ version }) {
  const changes = version?.changes || [];
  if (!changes.length) {
    return <p className="text-xs text-[color:var(--ink-500)]">No recorded field changes for this version.</p>;
  }

  return (
    <ul className="space-y-2">
      {changes.map((c, i) => (
        <li key={`${c.field}-${i}`} className="rounded-lg border border-[color:var(--ink-200)] p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[color:var(--surface-dark-900)]">{c.label}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={c.kind === 'material'
                ? { background: 'var(--warning-50)', color: 'var(--warning-700)' }
                : { background: 'var(--ink-100)', color: 'var(--ink-500)' }}
            >
              {c.kind}
            </span>
            {typeof c.similarity === 'number' && (
              <span className="text-[10px] text-[color:var(--ink-400)]">{Math.round(c.similarity * 100)}% similar</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[color:var(--ink-500)]"><span className="font-semibold">Before:</span> {String(c.before ?? '\u2014').slice(0, 300)}</p>
          <p className="mt-1 text-xs text-[color:var(--ink-700)]"><span className="font-semibold">After:</span> {String(c.after ?? '\u2014').slice(0, 300)}</p>
        </li>
      ))}
    </ul>
  );
}