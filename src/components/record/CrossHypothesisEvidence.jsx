/**
 * What the evidence says about the student across every hypothesis, with each
 * conclusion traceable back to the experiences behind it.
 */
import { useState } from 'react';
import { CheckCircle2, HelpCircle, AlertTriangle, Circle, ChevronRight } from 'lucide-react';
import DimensionInspector from '@/components/journey/DimensionInspector';

function Row({ item, onOpen }) {
  return (
    <button onClick={() => onOpen(item.raw)} className="touch-target flex w-full items-start gap-2 rounded-[var(--r-control)] px-2 py-2 text-left hover:bg-[color:var(--ink-50)]">
      <span className="min-w-0 flex-1">
        <span className="tp-body block font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
        <span className="tp-meta block" style={{ color: 'var(--text-secondary)' }}>
          {item.levelLabel}
          {item.count ? ` · ${item.count} observation${item.count === 1 ? '' : 's'}` : ''}
          {item.careers.length ? ` · seen while testing ${item.careers.join(', ')}` : ''}
        </span>
      </span>
      <ChevronRight size={15} className="mt-1 shrink-0" style={{ color: 'var(--ink-400)' }} />
    </button>
  );
}

function Block({ Icon, title, items, onOpen }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}><Icon size={12} /> {title}</p>
      <div className="mt-1">{items.map(i => <Row key={i.dimension} item={i} onOpen={onOpen} />)}</div>
    </div>
  );
}

export default function CrossHypothesisEvidence({ cross }) {
  const [open, setOpen] = useState(null);
  const total = cross.confirmed.length + cross.suspected.length + cross.conflicting.length;
  if (!total && !cross.open.length) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      {open && <DimensionInspector dimension={open} onClose={() => setOpen(null)} />}
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What we learned about you</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        Read across {cross.experimentsBehind || 'your'} experience{cross.experimentsBehind === 1 ? '' : 's'}, not from one of them. Open any line to see what it came from.
      </p>
      <Block Icon={CheckCircle2} title="Evidence points somewhere" items={cross.confirmed} onOpen={setOpen} />
      <Block Icon={AlertTriangle} title="Conflicting evidence" items={cross.conflicting} onOpen={setOpen} />
      <Block Icon={HelpCircle} title="Suspected, one experience so far" items={cross.suspected} onOpen={setOpen} />
      <Block Icon={Circle} title="Limited evidence so far" items={cross.open} onOpen={setOpen} />
    </section>
  );
}