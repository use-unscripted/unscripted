import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const Section = ({ label, children }) => (
  <section className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 shadow-sm">
    <p className="tp-eyebrow text-[color:var(--info-600)]">{label}</p>
    <div className="mt-3">{children}</div>
  </section>
);

const Chips = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items?.map(x => (
      <span key={x} className="tp-meta rounded-full border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)]">{x}</span>
    ))}
  </div>
);

const List = ({ items, accent = false }) => (
  <ul className="space-y-2">
    {items?.map((x, i) => (
      <li key={i} className="tp-body flex gap-3 text-[color:var(--ink-700)]">
        <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${accent ? 'text-[#10B981]' : 'text-[color:var(--info-600)]'}`} />
        {x}
      </li>
    ))}
  </ul>
);

const Skeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 animate-pulse">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6">
        <div className="h-3 w-28 rounded bg-[color:var(--ink-200)] mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[color:var(--ink-100)]" />
          <div className="h-3 w-5/6 rounded bg-[color:var(--ink-100)]" />
        </div>
      </div>
    ))}
  </div>
);

export default function BlueprintDetail({ bp, detail, loading, error, onBack }) {
  return (
    <main className="app-page">
      <button
        onClick={onBack}
        className="tp-body mb-7 flex items-center gap-2 font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-800)] transition"
      >
        <ArrowLeft size={16} /> All blueprints
      </button>
      <div className="mb-8 flex items-center gap-4">
        <bp.Icon size={44} strokeWidth={1.5} aria-hidden="true" className="text-[color:var(--info-600)]" />
        <div>
          <p className="tp-eyebrow mb-2 text-[color:var(--info-600)]">Creator / Founder Blueprint</p>
          <h1 className="tp-page text-[color:var(--surface-dark-800)]">{bp.label}</h1>
        </div>
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <div className="tp-body rounded-[var(--r-surface)] px-5 py-4"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          {error}
        </div>
      )}

      {detail && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section label="What this path means">
            <p className="tp-prose text-[color:var(--ink-700)]">{detail.what_this_path_means}</p>
          </Section>
          <Section label="Who it fits">
            <p className="tp-prose text-[color:var(--ink-700)]">{detail.who_it_fits}</p>
          </Section>
          <Section label="Skills required">
            <Chips items={detail.skills_required} />
          </Section>
          <Section label="Content strategy">
            <p className="tp-prose text-[color:var(--ink-700)]">{detail.content_strategy}</p>
          </Section>
          <Section label="Weekly actions">
            <List items={detail.weekly_actions} />
          </Section>
          <Section label="First project idea">
            <p className="tp-prose text-[color:var(--ink-700)]">{detail.first_project_idea}</p>
          </Section>
          <Section label="Networking strategy">
            <p className="tp-prose text-[color:var(--ink-700)]">{detail.networking_strategy}</p>
          </Section>
          <Section label="Monetization paths">
            <Chips items={detail.monetization_paths} />
          </Section>
          <Section label="Mistakes to avoid">
            <List items={detail.mistakes_to_avoid} accent />
          </Section>
          <div className="md:col-span-2">
            <Section label="30-day starter plan">
              <div className="grid gap-4 sm:grid-cols-2 mt-2">
                {detail.thirty_day_plan?.map((week, i) => (
                  <div key={i} className="rounded-[var(--r-control)] p-4" style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
                    <p className="tp-meta font-bold text-[color:var(--info-600)]">{week.week}</p>
                    <p className="tp-card mt-1 text-[color:var(--surface-dark-800)]">{week.focus}</p>
                    <ul className="mt-3 space-y-1.5">
                      {week.actions?.map((a, j) => (
                        <li key={j} className="tp-meta flex gap-2 text-[color:var(--ink-700)]">
                          <span className="mt-0.5 shrink-0 text-[color:var(--info-600)]">→</span>{a}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </main>
  );
}