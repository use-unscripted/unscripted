import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const Section = ({ label, children }) => (
  <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">{label}</p>
    <div className="mt-3">{children}</div>
  </section>
);

const Chips = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items?.map(x => (
      <span key={x} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#334155]">{x}</span>
    ))}
  </div>
);

const List = ({ items, accent = false }) => (
  <ul className="space-y-2">
    {items?.map((x, i) => (
      <li key={i} className="flex gap-3 text-sm text-[#334155]">
        <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${accent ? 'text-[#10B981]' : 'text-[#2563EB]'}`} />
        {x}
      </li>
    ))}
  </ul>
);

const Skeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 animate-pulse">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="rounded-[20px] border border-[#E2E8F0] bg-white p-6">
        <div className="h-3 w-24 rounded bg-[#E2E8F0] mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-[#F1F5F9]" />
          <div className="h-3 w-5/6 rounded bg-[#F1F5F9]" />
        </div>
      </div>
    ))}
  </div>
);

export default function BlueprintDetail({ bp, detail, loading, onBack }) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#07111F] transition"
      >
        <ArrowLeft size={16} /> All blueprints
      </button>
      <div className="mb-8 flex items-center gap-4">
        <span className="text-5xl">{bp.icon}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#2563EB]">Creator / Founder Blueprint</p>
          <h1 className="font-heading text-3xl font-bold text-[#07111F]">{bp.label}</h1>
        </div>
      </div>

      {loading && <Skeleton />}

      {detail && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section label="What this path means">
            <p className="text-sm leading-6 text-[#334155]">{detail.what_this_path_means}</p>
          </Section>
          <Section label="Who it fits">
            <p className="text-sm leading-6 text-[#334155]">{detail.who_it_fits}</p>
          </Section>
          <Section label="Skills required">
            <Chips items={detail.skills_required} />
          </Section>
          <Section label="Content strategy">
            <p className="text-sm leading-6 text-[#334155]">{detail.content_strategy}</p>
          </Section>
          <Section label="Weekly actions">
            <List items={detail.weekly_actions} />
          </Section>
          <Section label="First project idea">
            <p className="text-sm leading-6 text-[#334155]">{detail.first_project_idea}</p>
          </Section>
          <Section label="Networking strategy">
            <p className="text-sm leading-6 text-[#334155]">{detail.networking_strategy}</p>
          </Section>
          <Section label="Monetization paths">
            <Chips items={detail.monetization_paths} />
          </Section>
          <Section label="Mistakes to avoid">
            <List items={detail.mistakes_to_avoid} accent />
          </Section>
          <div className="md:col-span-2">
            <Section label="30-day starter plan">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
                {detail.thirty_day_plan?.map((week, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-bold text-[#2563EB]">{week.week}</p>
                    <p className="font-heading mt-1 font-semibold text-sm text-[#07111F]">{week.focus}</p>
                    <ul className="mt-3 space-y-1.5">
                      {week.actions?.map((a, j) => (
                        <li key={j} className="flex gap-2 text-xs text-[#334155]">
                          <span className="mt-0.5 shrink-0 text-[#2563EB]">→</span>{a}
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