/**
 * Evidence collected on this experiment, plus reflection and final-decision
 * status: the two things that close a cycle. Existing proof and reflection
 * records are reused here, never re-created.
 */
import { Link } from 'react-router-dom';
import { FileText, RotateCcw, Compass, ExternalLink } from 'lucide-react';
import { safeExternalUrl } from '@/lib/safe-url';

function Row({ Icon, label, value, to, cta }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border-light)' }}>
      <div className="min-w-0">
        <p className="tp-body flex items-center gap-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
          <Icon size={13} style={{ color: 'var(--brand-navy-700)' }} /> {label}
        </p>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{value}</p>
      </div>
      {to && (
        <Link to={to} className="touch-reach tp-meta shrink-0 py-1 font-bold" style={{ color: 'var(--brand-navy-700)' }}>{cta} →</Link>
      )}
    </div>
  );
}

export default function ExperimentStatusPanel({ proofs, reflections, cycle }) {
  const decision = cycle?.final_decision;

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <h3 className="tp-card mb-4" style={{ color: 'var(--text-primary)' }}>
        Evidence, reflection and decision
      </h3>

      <Row
        Icon={FileText}
        label="Evidence"
        value={proofs.length ? `${proofs.length} item${proofs.length === 1 ? '' : 's'} attached to this experiment` : 'Nothing attached yet. Add evidence as you work through this experiment.'}
        to="/evidence?tab=proof"
        cta="Full history"
      />

      <Row
        Icon={RotateCcw}
        label="Reflection"
        value={reflections.length ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'} recorded` : 'Not written yet.'}
        to="/evidence?tab=reflect"
        cta={reflections.length ? 'Review' : 'Reflect'}
      />

      <Row
        Icon={Compass}
        label="Final decision"
        value={
          decision
            ? `Recorded: ${decision.replace(/_/g, ' ')}`
            : 'Open once you have evidence and a reflection.'
        }
        to="/journey"
        cta={decision ? 'View' : 'Go to decision'}
      />

      {proofs.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
          {proofs.slice(0, 6).map(p => {
            // Student-entered URL: only http(s) is allowed in an href.
            const href = safeExternalUrl(p.external_url) || safeExternalUrl(p.file_url);
            return (
            <li key={p.id} className="tp-meta flex items-center justify-between gap-2">
              <span className="truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                  Open <ExternalLink size={10} className="inline" />
                </a>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}