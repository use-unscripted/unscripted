/**
 * A titled block on an admin dashboard, with room for the caveat that belongs
 * beside the numbers rather than in a document nobody opens.
 *
 * Deliberately separate from DiSection, which renders a computed metric cell and
 * its suppression state and takes no children.
 */
export default function AdminSection({ title, note, children }) {
  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>{title}</h2>
      {note && <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}