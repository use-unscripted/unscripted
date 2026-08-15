import { Link } from 'react-router-dom';
import { Plus, Minus, Check, HelpCircle, Users } from 'lucide-react';
import SidePanel from '@/components/matrix/SidePanel';
import ProvenanceSources from '@/components/matrix/ProvenanceSources';
import ExpectationBars from '@/components/matrix/ExpectationBars';
import { metricPanel, humanDate } from '@/lib/matrix-provenance';

/**
 * One metric, explained from the records behind it. Everything rendered here is
 * projected from the scored row, so nothing in this panel can cite work the
 * student did not do. When there is no traceable record, it says exactly that
 * rather than composing a reason.
 */
const Block = ({ title, children }) => (
  <section className="mt-6 first:mt-0">
    <h3 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{title}</h3>
    <div className="mt-2">{children}</div>
  </section>
);

const Line = ({ icon: Icon, color, children }) => (
  <li className="tp-body flex gap-2" style={{ color: 'var(--text-secondary)' }}>
    <Icon size={15} className="mt-1 shrink-0" style={{ color }} aria-hidden="true" />
    <span>{children}</span>
  </li>
);

export default function MetricPanel({ row, metric, onClose }) {
  if (!row || !metric) return null;
  const p = metricPanel(row, metric);

  return (
    <SidePanel open title={p.title} eyebrow="Why does Unscripted think this?" onClose={onClose}>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>Current</p>
          <p className="tp-page tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.current || '—'}</p>
        </div>
        {p.previous && (
          <div>
            <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>Previous</p>
            <p className="tp-card tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.previous}</p>
          </div>
        )}
      </div>
      {p.note && <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>{p.note}</p>}

      {!p.sufficient ? (
        <p className="app-inset tp-body mt-5 p-3.5" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
          {p.insufficientNote}
        </p>
      ) : (
        <>
          {p.signals?.length > 0 && (
            <Block title="Signals used, and how much each counted">
              <ul className="space-y-2">
                {p.signals.map(s => (
                  <li key={s.key} className="app-inset p-3" style={{ background: 'var(--ink-50)' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
                      <p className="tp-meta tabular-nums shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {s.value}% · weight {Math.round(s.weight * 100)}%
                      </p>
                    </div>
                    <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{s.detail}</p>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {p.lines?.length > 0 && (
            <Block title="What you reported after the work">
              <ul className="space-y-1.5">
                {p.lines.map((l, i) => (
                  <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                    {l.label}: <span className="tabular-nums">{l.value}</span> after {l.source}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {p.expectation && <Block title="Expectation against reality"><ExpectationBars expectation={p.expectation} /></Block>}

          {p.people?.length > 0 && (
            <Block title="Conversations counted">
              <ul className="space-y-2">
                {p.people.map(person => (
                  <li key={person.id} className="app-inset p-3" style={{ background: 'var(--ink-50)' }}>
                    <p className="tp-body flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Users size={14} aria-hidden="true" /> {person.name}
                    </p>
                    <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {[person.role, humanDate(person.date)].filter(Boolean).join(' · ')}
                    </p>
                    {person.learned && <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{person.learned}</p>}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {p.strengthening?.length > 0 && (
            <Block title="Evidence strengthening this path">
              <ul className="space-y-1.5">
                {p.strengthening.map((e, i) => (
                  <Line key={i} icon={Plus} color="var(--success-700)">
                    {e.text} <span style={{ color: 'var(--text-muted)' }}>({e.source})</span>
                  </Line>
                ))}
              </ul>
            </Block>
          )}

          {p.weakening?.length > 0 && (
            <Block title="Evidence weakening this path">
              <ul className="space-y-1.5">
                {p.weakening.map((e, i) => (
                  <Line key={i} icon={Minus} color="var(--warning-700)">
                    {e.text} <span style={{ color: 'var(--text-muted)' }}>({e.source})</span>
                  </Line>
                ))}
              </ul>
            </Block>
          )}

          {p.biggest && (
            <Block title="Biggest remaining unknown">
              <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{p.biggest.question}</p>
            </Block>
          )}

          {p.resolved.length > 0 && (
            <Block title="Unknowns resolved">
              <ul className="space-y-1.5">
                {p.resolved.map(u => (
                  <Line key={u.key} icon={Check} color="var(--success-700)">
                    {u.label}{u.note ? ` — ${u.note}` : ''}
                  </Line>
                ))}
              </ul>
            </Block>
          )}

          {p.open.length > 0 && (
            <Block title="Still unknown">
              <ul className="space-y-1.5">
                {p.open.map(u => (
                  <Line key={u.key} icon={HelpCircle} color="var(--text-muted)">{u.label}</Line>
                ))}
              </ul>
            </Block>
          )}

          <Block title="Sources used"><ProvenanceSources sources={p.sources} /></Block>

          {(metric === 'uncertainty' || metric === 'coverage') && (
            <Link to="/test" className="app-cta tp-control mt-6 inline-flex">Test the biggest unknown</Link>
          )}
          {metric === 'human' && p.people?.length === 0 && (
            <Link to="/evidence?tab=outreach" className="app-cta-secondary tp-control mt-6 inline-flex">Plan a conversation</Link>
          )}
        </>
      )}
    </SidePanel>
  );
}