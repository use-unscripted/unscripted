/**
 * Evidence — one destination for everything the student produces.
 * Reuses the existing Proof, Outreach and Reflection pages unchanged; this only
 * routes between them, so no feature is duplicated.
 */
import { useSearchParams } from 'react-router-dom';
import { FileText, Users, RotateCcw, Library } from 'lucide-react';
import EvidenceLibrary from '@/pages/EvidenceLibrary';
import ProofOfWorkPage from '@/pages/ProofOfWorkPage';
import OutreachTracker from '@/pages/OutreachTracker';
import WeeklyReflectionPage from '@/pages/WeeklyReflectionPage';

const TABS = [
  ['library',  'Library',     Library],
  ['proof',    'Proof',       FileText],
  ['outreach', 'Outreach',    Users],
  ['reflect',  'Reflections', RotateCcw],
];

export default function Evidence() {
  const [params, setParams] = useSearchParams();
  const active = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'library';

  const select = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur" style={{ borderColor: 'var(--border-light)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3 sm:px-8">
          {TABS.map(([key, label, Icon]) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => select(key)}
                aria-current={isActive ? 'page' : undefined}
                className="ui-press flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-xs font-bold sm:flex-none sm:px-4 sm:text-sm"
                style={
                  isActive
                    ? { background: 'var(--brand-navy-900)', color: '#fff', minHeight: '44px' }
                    : { background: 'var(--background-tertiary)', color: 'var(--text-secondary)', minHeight: '44px' }
                }
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {active === 'library' && <EvidenceLibrary />}
      {active === 'proof' && <ProofOfWorkPage />}
      {active === 'outreach' && <OutreachTracker />}
      {active === 'reflect' && <WeeklyReflectionPage />}
    </div>
  );
}