/**
 * Section 6: the evidence this experiment produced — deliverables, professional
 * conversations, campus activity and steps completed — and one question about
 * which piece moved the student's thinking most.
 */
import { FileText, Users, CalendarDays, ListChecks } from 'lucide-react';

const field = 'w-full rounded-[var(--r-control)] border bg-white px-3 py-2.5 text-base md:text-sm outline-none resize-none';
const fieldStyle = { borderColor: 'var(--border-light)' };

function Item({ Icon, title, meta, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="ui-press flex w-full items-start gap-2.5 rounded-[var(--r-control)] p-3 text-left"
      style={selected
        ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)', minHeight: '48px' }
        : { background: 'white', border: '1px solid var(--border-light)', minHeight: '48px' }}
    >
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: selected ? 'var(--brand-gold-500)' : 'var(--brand-navy-700)' }} />
      <span className="min-w-0">
        <span className="tp-body block font-semibold" style={{ color: selected ? 'var(--brand-white)' : 'var(--text-primary)' }}>{title}</span>
        {meta && <span className="tp-meta block" style={{ color: selected ? 'rgba(255,255,255,.75)' : 'var(--text-muted)' }}>{meta}</span>}
      </span>
    </button>
  );
}

export default function EvidenceReview({ ctx, answers, onChange }) {
  const proof = ctx.proof || [];
  const outreach = ctx.outreach || [];
  const campus = (ctx.experiment?.notes || '').toLowerCase().includes('campus') ? 1 : 0;

  const items = [
    ...proof.map(p => ({ id: p.id, Icon: FileText, title: p.title || 'Deliverable', meta: p.category ? `Deliverable · ${p.category.replace(/_/g, ' ')}` : 'Deliverable' })),
    ...outreach
      .filter(c => ['responded', 'call_scheduled', 'completed'].includes(c.response_status))
      .map(c => ({ id: c.id, Icon: Users, title: [c.name, c.role].filter(Boolean).join(' · ') || 'A conversation', meta: 'Professional conversation' })),
    ...(ctx.completedStepTitles || []).slice(0, 4).map((t, i) => ({ id: `step:${i}`, Icon: ListChecks, title: t, meta: 'Step completed' })),
  ];

  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.length ? items.map(it => (
          <Item
            key={it.id}
            Icon={it.Icon}
            title={it.title}
            meta={it.meta}
            selected={answers.influentialEvidenceId === it.id}
            onSelect={() => onChange({ influentialEvidenceId: it.id, influentialEvidenceLabel: it.title })}
          />
        )) : (
          <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
            No deliverables or conversations were recorded against this experiment. Answer the question below in your own words.
          </p>
        )}
        {campus > 0 && (
          <Item Icon={CalendarDays} title="Campus activity linked to this experiment" meta="On campus" selected={false} onSelect={() => {}} />
        )}
      </div>

      <label className="mt-4 block">
        <span className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
          Which piece of evidence most influenced your thinking?
        </span>
        <textarea
          rows={3}
          value={answers.influentialEvidence || ''}
          onChange={e => onChange({ influentialEvidence: e.target.value })}
          placeholder="Name it, and say what it changed."
          className={`${field} mt-1.5`}
          style={fieldStyle}
        />
      </label>
    </>
  );
}