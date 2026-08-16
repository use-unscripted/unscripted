/**
 * Evidence: one destination for everything the student produces.
 * Reuses the existing Proof, Outreach and Reflection pages unchanged; this only
 * routes between them, so no feature is duplicated.
 */
import { useSearchParams } from 'react-router-dom';
import { FileText, RotateCcw, Library, UserCheck, Compass, Users } from 'lucide-react';
import HumanEvidencePanel from '@/components/evidence/HumanEvidencePanel';
import ScenarioEvidenceSection from '@/components/scenarios/ScenarioEvidenceSection';
import CareerEvidenceProfile from '@/pages/CareerEvidenceProfile';
import EvidenceLibrary from '@/pages/EvidenceLibrary';
import ProofOfWorkPage from '@/pages/ProofOfWorkPage';
import WeeklyReflectionPage from '@/pages/WeeklyReflectionPage';

const TABS = [
  ['library',  'Library',     Library],
  ['proof',    'Proof',       FileText],
  ['reflect',  'Reflections', RotateCcw],
  ['career-profile', 'Career Profile', UserCheck],
  // Professional, alumni, mentor and advisor interactions. One evidence
  // architecture, one more source type — never a separate contacts database.
  ['human', 'Human', Users],
  // Scenario evidence lives inside Evidence, never as its own nav item.
  ['signals', 'Signals', Compass],
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
        {/* Not app-page: this is the tab rail, not the page column. It only
            borrows app-page's measure and side padding so the tabs line up
            with the content of whichever tab is open. */}
        <div className="mx-auto flex w-full max-w-[var(--app-measure)] flex-wrap gap-2 px-5 py-3 sm:px-8">
          {TABS.map(([key, label, Icon]) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => select(key)}
                aria-current={isActive ? 'page' : undefined}
                className="ui-press tp-body flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-control)] px-3.5 font-bold sm:flex-none sm:px-5"
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
      {active === 'reflect' && <WeeklyReflectionPage />}
      {active === 'career-profile' && <CareerEvidenceProfile />}
      {active === 'human' && <HumanEvidencePanel />}
      {active === 'signals' && (
        <main className="app-page">
          <ScenarioEvidenceSection />
        </main>
      )}
    </div>
  );
}