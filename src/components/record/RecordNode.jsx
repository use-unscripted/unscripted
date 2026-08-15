/**
 * One node of the decision chain, exactly as it was recorded.
 * Nothing here recomputes anything: an initial position keeps the numbers it was
 * saved with even when a later experiment contradicted them.
 */
import { Compass, FlaskConical, GitCommitVertical, Flag } from 'lucide-react';
import { DIRECTIONS } from '@/lib/decision-record';

const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Group({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2.5">
      <p className="tp-eyebrow" style={{ color: 'var(--ink-400)' }}>{label}</p>
      <ul className="mt-1 space-y-1">
        {items.filter(Boolean).map((t, i) => (
          <li key={i} className="tp-meta" style={{ color: 'var(--ink-700)' }}>· {t}</li>
        ))}
      </ul>
    </div>
  );
}

function Frame({ Icon, eyebrow, tone, title, date, children }) {
  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full" style={{ background: 'var(--background-tertiary)' }}>
        <Icon size={11} style={{ color: tone }} />
      </span>
      <p className="tp-eyebrow" style={{ color: tone }}>{eyebrow}{date ? ` · ${fmt(date)}` : ''}</p>
      {title && <p className="tp-body mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      {children}
    </li>
  );
}

export default function RecordNode({ node }) {
  if (node.kind === 'initial') {
    return (
      <Frame Icon={Compass} eyebrow="Initial hypothesis" tone="var(--brand-navy-700)" date={node.at} title={node.statement || 'Where this started'}>
        {node.reconstructed && (
          <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>
            Read from your hypothesis record. This direction was started before positions were snapshotted.
          </p>
        )}
        <Group label="Why it seemed worth testing" items={[node.rationale]} />
        <Group label="Initial confidence" items={[node.confidence != null ? `${node.confidence}%` : 'Not recorded']} />
        <Group label="Initial unknowns" items={node.unknowns} />
      </Frame>
    );
  }

  if (node.kind === 'experiment') {
    return (
      <Frame Icon={FlaskConical} eyebrow="Experiment" tone="var(--brand-gold-700)" date={node.at} title={node.title}>
        <Group label="What was tested" items={[node.tested]} />
        <Group label="Expectation beforehand" items={node.expectation} />
        <Group label="Activity" items={node.activity.missions} />
        <Group label="Campus experiences" items={node.activity.campus} />
        <Group label="Evidence produced" items={node.evidence.map(e => `${e.title}${e.approved ? ' (approved for resume)' : ''}`)} />
        <Group label="What actually happened" items={node.reality} />
        {!node.reality.length && (
          <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>No post-experiment check-in was recorded for this one.</p>
        )}
      </Frame>
    );
  }

  if (node.kind === 'update') {
    const tone = DIRECTIONS[node.direction]?.tone || 'var(--ink-500)';
    return (
      <Frame Icon={GitCommitVertical} eyebrow="Hypothesis update" tone={tone} date={node.at}
        title={`${DIRECTIONS[node.direction]?.label || 'Recorded'}${node.confidenceBefore ? ` · ${node.confidenceBefore} → ${node.confidenceAfter}` : ''}`}>
        {node.studentCorrected && (
          <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>Confidence wording was your correction.</p>
        )}
        <Group label="Strengthened by" items={node.strengthened} />
        <Group label="Weakened by" items={node.weakened} />
        <Group label="Unknown resolved" items={node.resolved} />
        <Group label="New unknown" items={node.newUnknowns} />
        <Group label="Decision" items={[node.decisionLabel, node.note]} />
      </Frame>
    );
  }

  return (
    <Frame Icon={Flag} eyebrow="Current position" tone="var(--brand-navy-900)" date={node.changedAt}
      title={`${node.decisionLabel || String(node.status).replace(/_/g, ' ')}${node.confidence ? ` · ${node.confidence} confidence` : ''}`}>
      <Group label="Still open" items={node.openUnknowns} />
      <Group label="Next best test" items={[node.nextTest]} />
      <Group label="Your modification note" items={[node.modificationNote]} />
    </Frame>
  );
}