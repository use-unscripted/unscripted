/**
 * Step 1. Six things that arrived overnight, as a plain list to scroll.
 *
 * No input, no puzzle, nothing to score. The dullness is the content module's
 * decision and this component's job is to stay out of its way: no summaries, no
 * highlighting of the item that matters, no icons hinting at which one is the
 * real problem. Working out which of six things is the one worth doing is the
 * step.
 */
import { SimNote, SimNext } from '@/components/worksim/controls';

function Rows({ rows }) {
  return (
    <dl className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
      {rows.map(r => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="tp-meta" style={{ color: 'var(--text-secondary)' }}>{r.label}</dt>
          <dd className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SimInbox({ sim, onNext }) {
  return (
    <div className="space-y-6">
      {sim.read_in.map(item => (
        <SimNote key={item.id} from={item.from} subject={item.subject}>
          {item.summary && (
            <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{item.summary}</p>
          )}

          {item.rows && <Rows rows={item.rows} />}

          {item.body && (
            <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{item.body}</p>
          )}

          {item.tickets && (
            <div className="mt-4 space-y-3">
              {item.tickets.map(t => (
                <div
                  key={t.ref}
                  className="rounded-[var(--r-control)] border p-3.5"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}
                >
                  <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>
                    {t.ref} · {t.from} · {t.subject}
                  </p>
                  <p className="tp-body mt-1.5" style={{ color: 'var(--text-primary)' }}>{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </SimNote>
      ))}

      <SimNext onClick={onNext}>I have read these</SimNext>
    </div>
  );
}
