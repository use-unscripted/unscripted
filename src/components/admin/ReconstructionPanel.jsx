/**
 * What history can and cannot be rebuilt, stated on the dashboard itself rather
 * than in a document nobody opens beside the numbers.
 */
export default function ReconstructionPanel({ reconstruction }) {
  if (!reconstruction) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="app-card-flat p-4">
        <p className="tp-card" style={{ color: 'var(--success-700)' }}>Reconstructable from stored records</p>
        <ul className="mt-2 space-y-1.5">
          {(reconstruction.reconstructable || []).map(r => (
            <li key={r.stage} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.stage}</span>: {r.from}
            </li>
          ))}
        </ul>
      </div>
      <div className="app-card-flat p-4">
        <p className="tp-card" style={{ color: 'var(--warning-700)' }}>Not reconstructable</p>
        <ul className="mt-2 space-y-1.5">
          {(reconstruction.not_reconstructable || []).map(r => (
            <li key={r.stage} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.stage}</span>: {r.why}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}