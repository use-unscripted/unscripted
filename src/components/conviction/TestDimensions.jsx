/**
 * What a test quietly measures, shown as context and nothing more.
 *
 * Dimensions are measurement infrastructure, not a workflow: the student sees
 * the Conviction Gap and the test, and this line only names what the test will
 * teach the system about them. Read-only on purpose — nothing here is chosen,
 * completed, or navigated to.
 */
export default function TestDimensions({ dimensions = [] }) {
  const labels = dimensions.map(d => (typeof d === 'string' ? d : d?.label)).filter(Boolean);
  if (!labels.length) return null;

  return (
    <div className="mt-5">
      <p className="tp-label" style={{ color: 'var(--ink-500)' }}>This test is helping you learn about</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {labels.slice(0, 4).map(label => (
          <li
            key={label}
            className="tp-meta rounded-full px-2.5 py-1 font-semibold"
            style={{ background: 'var(--ink-50)', color: 'var(--ink-500)' }}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}