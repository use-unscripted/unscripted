import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

/**
 * An existing proof of work, shown here with what it connects to.
 * The Proofs feature itself is untouched; this only reads it.
 */
export default function ProofEvidenceCard({ proof, experiment, career, abilities = [] }) {
  return (
    <div className="rounded-[16px] border bg-white p-5" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{proof.title}</h3>
          <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-400)' }}>
            {(proof.category || 'evidence').replace(/_/g, ' ')}
            {fmt(proof.completed_at || proof.created_date) ? ` · ${fmt(proof.completed_at || proof.created_date)}` : ''}
          </p>
        </div>
        <Link to="/evidence?tab=proof" className="tp-meta inline-flex items-center gap-1 font-semibold"
          style={{ color: 'var(--brand-navy-700)' }}>
          Open <ArrowUpRight size={12} />
        </Link>
      </div>

      {proof.description && (
        <p className="tp-body mt-2 line-clamp-2" style={{ color: 'var(--ink-700)' }}>{proof.description}</p>
      )}

      <dl className="tp-meta mt-3 space-y-1" style={{ color: 'var(--ink-500)' }}>
        {career && <div><dt className="inline font-semibold">Career hypothesis: </dt><dd className="inline">{career}</dd></div>}
        {experiment && <div><dt className="inline font-semibold">Experiment: </dt><dd className="inline">{experiment.title}</dd></div>}
        {abilities.length > 0 && (
          <div><dt className="inline font-semibold">Supports: </dt><dd className="inline">{abilities.join(', ')}</dd></div>
        )}
        {!career && !experiment && !abilities.length && (
          <div><dd>Not linked to a career or experiment yet.</dd></div>
        )}
      </dl>
    </div>
  );
}