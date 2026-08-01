/**
 * Evidence collected on this experiment, plus reflection and final-decision
 * status — the two things that close a cycle. Existing proof and reflection
 * records are reused here, never re-created.
 */
import { Link } from 'react-router-dom';
import { FileText, RotateCcw, Compass, ExternalLink } from 'lucide-react';

function Row({ Icon, label, value, to, cta }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border-light)' }}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          <Icon size={13} style={{ color: 'var(--brand-navy-700)' }} /> {label}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{value}</p>
      </div>
      {to && (
        <Link to={to} className="shrink-0 text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>{cta} →</Link>
      )}
    </div>
  );
}

export default function ExperimentStatusPanel({ proofs, reflections, cycle }) {
  const decision = cycle?.final_decision;

  return (
    <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <h3 className="font-heading mb-3 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        Evidence, reflection and decision
      </h3>

      <Row
        Icon={FileText}
        label="Evidence"
        value={proofs.length ? `${proofs.length} item${proofs.length === 1 ? '' : 's'} attached to this experiment` : 'Nothing attached yet — complete a mission to add evidence.'}
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
          {proofs.slice(0, 6).map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
              {(p.external_url || p.file_url) && (
                <a href={p.external_url || p.file_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-700)' }}>
                  Open <ExternalLink size={10} className="inline" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}