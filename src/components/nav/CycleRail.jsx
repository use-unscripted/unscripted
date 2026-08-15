import { Link, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { STAGES, STAGE_INDEX } from '@/lib/journey';
import useCycleStage from '@/hooks/useCycleStage';

/**
 * The cycle rail: where you are in this cycle, on every signed-in screen.
 *
 * It reads the same derived stage My Journey does and links each stage to the
 * screen that does that work, so a student deep inside an experiment or a
 * reflection can always see the shape of the cycle and step sideways without
 * going back to the dashboard first.
 */

/** Which screen does the work of each stage. */
const STAGE_TO = {
  explore: '/paths',
  choose: '/paths',
  test: '/experiments',
  prove: '/evidence?tab=proof',
  reflect: '/reflect',
  decide: '/reflect',
};

/** Which stage the screen you are on belongs to, so the rail can mark it. */
const HERE = [
  ['/paths', 'choose'],
  ['/experiments', 'test'],
  ['/experiment', 'test'],
  ['/guide', 'test'],
  ['/moment', 'test'],
  ['/simulation', 'test'],
  ['/evidence', 'prove'],
  ['/reflect', 'reflect'],
];

function stageOfPath(pathname) {
  const hit = HERE.filter(([p]) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}

/* Two grounds: the app's paper, and the navy sidebar. Same shape either way —
   only the ink and the hairlines change. */
const INK = {
  light: {
    eyebrow: 'var(--brand-navy-700)',
    path: 'var(--text-secondary)',
    label: 'var(--text-primary)',
    labelTodo: 'var(--text-muted)',
    sub: 'var(--text-muted)',
    here: 'var(--brand-navy-700)',
    hereBg: 'var(--background-tertiary)',
    rail: 'var(--border-light)',
    nodeTodo: 'var(--background-primary)',
    nodeTodoRing: 'var(--border-light)',
    link: 'var(--brand-navy-700)',
  },
  dark: {
    eyebrow: 'var(--brand-gold-500)',
    path: '#FFFFFF',
    label: '#FFFFFF',
    labelTodo: 'var(--ink-300)',
    sub: 'var(--ink-300)',
    here: 'var(--brand-gold-500)',
    hereBg: 'var(--brand-navy-700)',
    rail: 'rgba(255,255,255,0.16)',
    nodeTodo: 'transparent',
    nodeTodoRing: 'rgba(255,255,255,0.28)',
    link: 'var(--ink-300)',
  },
};

export default function CycleRail({ variant = 'light' }) {
  const { pathname } = useLocation();
  const journey = useCycleStage();
  const activeIdx = STAGE_INDEX[journey?.stage] ?? 0;
  const hereStage = stageOfPath(pathname);
  const c = INK[variant];

  return (
    <div>
      <p className="tp-eyebrow" style={{ color: c.eyebrow }}>Your cycle</p>
      {journey?.currentPath?.path_name && (
        <p className="tp-meta mt-1.5 font-semibold" style={{ color: c.path, overflowWrap: 'anywhere' }}>
          {journey.currentPath.path_name}
        </p>
      )}

      <ol className="mt-4">
        {STAGES.map((s, i) => {
          const state = i < activeIdx ? 'done' : i === activeIdx ? 'current' : 'todo';
          const isHere = hereStage === s.key;
          return (
            <li key={s.key} className="relative flex gap-3">
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[8px] top-[26px] w-[2px]"
                  style={{ background: i < activeIdx ? 'var(--brand-gold-500)' : c.rail }}
                />
              )}
              <span className="relative z-[1] shrink-0 pt-[11px]" aria-current={state === 'current' ? 'step' : undefined}>
                {state === 'done' ? (
                  <span className="grid h-[18px] w-[18px] place-items-center rounded-full"
                    style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}>
                    <Check size={10} strokeWidth={3.5} aria-hidden="true" />
                  </span>
                ) : state === 'current' ? (
                  <span className="grid h-[18px] w-[18px] place-items-center rounded-full"
                    style={{ background: 'var(--brand-navy-900)', boxShadow: '0 0 0 3px rgba(214,182,106,0.45)' }}>
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: 'var(--brand-gold-500)' }} />
                  </span>
                ) : (
                  <span className="block h-[18px] w-[18px] rounded-full"
                    style={{ background: c.nodeTodo, boxShadow: `inset 0 0 0 2px ${c.nodeTodoRing}` }} />
                )}
              </span>

              <Link
                to={STAGE_TO[s.key]}
                className="journey-stage-row -mx-2 flex min-w-0 flex-1 flex-col rounded-[var(--r-control)] px-2 py-2"
                style={isHere ? { background: c.hereBg } : undefined}
              >
                <span className="tp-meta font-bold"
                  style={{ color: state === 'todo' ? c.labelTodo : c.label }}>
                  {s.label}
                </span>
                <span className="tp-meta" style={{ color: isHere ? c.here : c.sub }}>
                  {isHere ? "You're here" : s.question}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <Link to="/journey" className="tp-meta mt-4 inline-block font-semibold" style={{ color: c.link }}>
        Back to My Journey
      </Link>
    </div>
  );
}