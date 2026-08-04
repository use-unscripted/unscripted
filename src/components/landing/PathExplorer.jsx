import { forwardRef, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase, Rocket, Building2, Megaphone, Handshake, GraduationCap, Compass,
  ChevronRight, Check, AlertTriangle, FlaskConical,
} from 'lucide-react';

const PATHS = [
  {
    id: 'career',
    label: 'A traditional professional career',
    icon: Briefcase,
    tagline: "Whether the day-to-day of the role, not the title, is something you’d still want five years in.",
    missions: [
      'Interview three people who are two to five years into the role',
      'Sit in on one real work session or shadow a full day',
      'Rebuild one deliverable they actually produce each week',
    ],
    green: 'The unglamorous 80% of the work still holds your attention.',
    red: 'Talking about the work is more interesting to you than doing it.',
    evidence: 'three interview write-ups and one work sample you can hand a recruiter.',
  },
  {
    id: 'startup',
    label: 'Joining a startup',
    icon: Rocket,
    tagline: "Whether you want the ambiguity and range, or you’re mostly reacting to the story startups tell about themselves.",
    missions: [
      'Map ten early-stage companies hiring near you or remote',
      'Interview two people who joined before the company had structure',
      'Ship one scoped, unpaid piece of work for one of them',
    ],
    green: 'You keep moving when nobody defines the next step for you.',
    red: 'The appeal disappears once equity and titles are off the table.',
    evidence: 'a shipped work sample and a written read on ten companies.',
  },
  {
    id: 'company',
    label: 'Building a company',
    icon: Building2,
    tagline: 'Whether you can find a problem people will pay to fix, before you commit years to it.',
    missions: [
      'Run ten problem interviews with one specific group of people',
      'Put up a one-page offer and drive real traffic to it',
      'Attempt one pre-sale or paid pilot',
    ],
    green: 'Strangers keep the conversation going after you stop asking questions.',
    red: 'Every yes comes from someone who already knows you.',
    evidence: 'ten interview transcripts, a live page, and real demand data. Or a documented no.',
  },
  {
    id: 'brand',
    label: 'Building a personal brand',
    icon: Megaphone,
    tagline: "Whether you’ll keep publishing in the stretch where nobody is watching yet.",
    missions: [
      'Pick one audience and one specific promise to them',
      'Publish twelve pieces in thirty days on a single platform',
      'Turn three of those pieces into three real conversations',
    ],
    green: 'You have more to say in week four than you did in week one.',
    red: "You’re checking the metrics more often than you’re making the work.",
    evidence: 'twelve published pieces and a record of what actually landed.',
  },
  {
    id: 'freelance',
    label: 'Freelancing or offering a service',
    icon: Handshake,
    tagline: 'Whether people will pay you for this, at a price that works, before you turn down anything else.',
    missions: [
      'Define one service, one buyer, and one price',
      'Send twenty-five tailored pitches and track every reply',
      'Deliver one paid engagement end to end',
    ],
    green: 'A paying client came from a cold pitch, not a favor.',
    red: 'Every project turns into free work with a vague finish line.',
    evidence: 'one real invoice, one delivered project, and a testimonial.',
  },
  {
    id: 'grad',
    label: 'Graduate school',
    icon: GraduationCap,
    tagline: 'Whether the degree is the only door to the work you want, or just the most expensive one.',
    missions: [
      'Interview three people who did the program and two who skipped it',
      'Sit in on a class or work through a full syllabus',
      'Price the real cost: tuition, years, and income you forgo',
    ],
    green: 'Everyone doing the work you want needed the credential to get there.',
    red: "You’re applying because the next step is unclear, not because it’s required.",
    evidence: 'a written cost-and-alternatives case you can revisit before any deposit is due.',
  },
  {
    id: 'mission',
    label: 'A mission-driven path',
    icon: Compass,
    tagline: 'Whether the cause holds up when it becomes logistics and constraints instead of a mission statement.',
    missions: [
      'Volunteer ten hours with an organization doing the actual work',
      'Interview someone five-plus years in about tradeoffs and pay',
      'Own one small deliverable from start to finish',
    ],
    green: 'The work still matters to you on the days it is tedious.',
    red: "You’re more attached to the identity than to the outcome.",
    evidence: 'ten logged hours, a finished deliverable, and an honest read on the tradeoffs.',
  },
];

const EASE = [0.16, 1, 0.3, 1];

function PathCard({ path }) {
  const Icon = path.icon;
  return (
    <div
      /* Tighter top padding at lg is deliberate and load-bearing: on the
         two-column desktop layout the card's icon has to sit level with the
         middle of the selected tab beside it, and the tab is a shorter box.
         32px top pushed the icon 21px below that line. Below lg the card is
         an accordion panel with nothing to align to, so it keeps p-6. */
      className="rounded-[var(--r-surface)] bg-white p-6 sm:p-8 lg:pt-3"
      style={{ border: '1px solid var(--border-light)', boxShadow: '0 18px 44px rgba(16,24,40,0.07)' }}
    >
      {/* items-center, not items-start: the heading reads as belonging to the
          icon when their midlines agree, and a two-line label still balances
          against it. */}
      <div className="flex items-center gap-4">
        <span
          className="hidden h-11 w-11 shrink-0 place-items-center rounded-[var(--r-control)] sm:grid"
          style={{ background: 'var(--brand-navy-900)', color: 'var(--brand-gold-500)' }}
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          {/* The uppercase "What you'd actually be testing" eyebrow that sat
             above this heading is gone — it restated the heading and it was
             the fourth instance of the same device on one page. */}
          <h3 className="font-heading text-2xl font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {path.label}
          </h3>
        </div>
      </div>

      <p className="mt-4 leading-7" style={{ color: 'var(--text-secondary)' }}>{path.tagline}</p>

      <div className="my-6 h-px w-full" style={{ background: 'var(--border-light)' }} />

      <p className="font-heading text-sm font-bold" style={{ color: 'var(--brand-navy-700)' }}>
        Your first missions
      </p>
      <ol className="mt-3.5 space-y-2.5">
        {path.missions.map((m, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
              style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}
            >
              {i + 1}
            </span>
            <span className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{m}</span>
          </li>
        ))}
      </ol>

      {/* These three used to be bordered boxes, which made this a bordered
          card holding three more bordered cards — three containment layers
          where one does the job. The tinted fills already separate them from
          the card, and they separate them by meaning (green / red / gold)
          rather than by drawing another rectangle. Borders removed; don't
          put them back. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'rgba(22,163,74,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <Check size={13} strokeWidth={3} style={{ color: 'var(--success-700)' }} />
            <span className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: 'var(--success-700)' }}>
              Signal it fits
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{path.green}</p>
        </div>
        <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'rgba(220,38,38,0.06)' }}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} strokeWidth={2.5} style={{ color: 'var(--danger-700)' }} />
            <span className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: 'var(--danger-700)' }}>
              Signal it doesn’t
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{path.red}</p>
        </div>
      </div>

      <div
        className="mt-5 flex items-start gap-2.5 rounded-[var(--r-control)] px-4 py-3.5"
        style={{ background: 'rgba(214,182,106,0.14)' }}
      >
        <FlaskConical size={15} className="mt-1 shrink-0" style={{ color: 'var(--brand-gold-600)' }} />
        <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
          <span className="font-semibold">Proof after 30 days · </span>{path.evidence}
        </p>
      </div>
    </div>
  );
}

const PathButton = forwardRef(function PathButton({ path, active, rotateChevron = false, fill = false, ...rest }, ref) {
  const Icon = path.icon;
  return (
    <button
      ref={ref}
      type="button"
      className={`group relative flex w-full items-center gap-3 rounded-[var(--r-control)] px-4 py-3.5 text-left transition-colors duration-200 hover:-translate-y-px${fill ? ' flex-1' : ''}`}
      style={{
        background: active ? 'var(--brand-navy-900)' : 'var(--brand-white)',
        border: `1px solid ${active ? 'var(--brand-navy-900)' : 'var(--border-light)'}`,
        boxShadow: active ? '0 12px 28px rgba(31,58,95,0.22)' : '0 1px 2px rgba(16,24,40,0.04)',
      }}
      {...rest}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] transition-colors duration-200"
        style={{
          background: active ? 'rgba(214,182,106,0.18)' : 'var(--background-tertiary)',
          color: active ? 'var(--brand-gold-500)' : 'var(--brand-navy-700)',
        }}
      >
        <Icon size={16} />
      </span>
      <span
        className="flex-1 text-sm font-semibold"
        style={{ color: active ? 'var(--brand-white)' : 'var(--text-primary)' }}
      >
        {path.label}
      </span>
      <ChevronRight
        size={16}
        className={`shrink-0 transition-transform duration-200 ${rotateChevron && active ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}
        style={{ color: active ? 'var(--brand-gold-500)' : 'var(--text-muted)' }}
      />
    </button>
  );
});

export default function PathExplorer() {
  const [selected, setSelected] = useState(0);
  const [openMobile, setOpenMobile] = useState(null);
  const tabRefs = useRef([]);
  const reduce = useReducedMotion();

  const handleKeyDown = (e, i) => {
    const last = PATHS.length - 1;
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setSelected(next);
    tabRefs.current[next]?.focus();
  };

  const active = PATHS[selected];

  return (
    <div>
      {/* Desktop — vertical tab rail + persistent detail card */}
      <div className="hidden gap-8 lg:grid" style={{ gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)' }}>
        {/* The rail already stretches to the detail card's height; the buttons
            didn't, so the last one stopped ~48px short of the card's bottom
            edge. `fill` spreads that slack across all seven so both columns end
            on the same line. */}
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Paths you can test"
          className="flex flex-col gap-2"
        >
          {PATHS.map((p, i) => (
            <PathButton
              key={p.id}
              path={p}
              active={i === selected}
              fill
              role="tab"
              id={`path-tab-${p.id}`}
              aria-selected={i === selected}
              aria-controls={`path-panel-${p.id}`}
              tabIndex={i === selected ? 0 : -1}
              ref={(el) => { tabRefs.current[i] = el; }}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            role="tabpanel"
            id={`path-panel-${active.id}`}
            aria-labelledby={`path-tab-${active.id}`}
            tabIndex={0}
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -6 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="rounded-[var(--r-surface)] focus-visible:outline-none"
          >
            <PathCard path={active} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile — accordion, detail opens inline under the path you tap */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {PATHS.map((p, i) => {
          const open = openMobile === i;
          return (
            <div key={p.id}>
              <PathButton
                path={p}
                active={open}
                rotateChevron
                aria-expanded={open}
                aria-controls={`path-acc-${p.id}`}
                onClick={() => setOpenMobile(open ? null : i)}
              />
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`path-acc-${p.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2.5">
                      <PathCard path={p} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
