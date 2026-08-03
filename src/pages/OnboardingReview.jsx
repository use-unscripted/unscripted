import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Clock, Target, Zap, FileText, X, Pencil, Check } from 'lucide-react';
import { LogoWordmark } from '@/components/UnscriptedLogo';
import { loadDraft, saveDraft } from '@/lib/guest-draft';
import { base44 } from '@/api/base44Client';

export default function OnboardingReview() {
  const nav = useNavigate();
  const [draft, setDraft] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const d = loadDraft();
    if (!d || !d.primary_path) {
      // No usable draft — send back to start
      nav('/onboarding', { replace: true });
      return;
    }
    setDraft(d);

    // If already authenticated and onboarding done, go straight to dashboard
    base44.auth.isAuthenticated().then(async authed => {
      if (authed) {
        const user = await base44.auth.me().catch(() => null);
        if (user?.onboarding_completed) {
          nav('/journey', { replace: true });
        } else {
          // Authenticated but not finished — go claim
          nav('/claim-onboarding', { replace: true });
        }
      }
    }).finally(() => setChecking(false));
  }, []);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState({
    personal_notes: '',
    long_term_ambitions: '',
    responsibilities_constraints: '',
    things_to_avoid: '',
    priorities_for_recommendations: '',
  });

  // Sync notesForm once draft is loaded
  useEffect(() => {
    if (draft) {
      setNotesForm({
        personal_notes: draft.personal_notes || '',
        long_term_ambitions: draft.long_term_ambitions || '',
        responsibilities_constraints: draft.responsibilities_constraints || '',
        things_to_avoid: draft.things_to_avoid || '',
        priorities_for_recommendations: draft.priorities_for_recommendations || '',
      });
    }
  }, [draft]);

  const hasNotes = draft && (draft.personal_notes || draft.long_term_ambitions || draft.responsibilities_constraints || draft.things_to_avoid || draft.priorities_for_recommendations);

  const saveNotes = () => {
    const updated = saveDraft(notesForm);
    setDraft(updated);
    setEditingNotes(false);
  };

  const removeNotes = () => {
    const cleared = { personal_notes: '', long_term_ambitions: '', responsibilities_constraints: '', things_to_avoid: '', priorities_for_recommendations: '' };
    const updated = saveDraft(cleared);
    setDraft(updated);
    setNotesForm(cleared);
    setEditingNotes(false);
  };

  if (checking || !draft) return null;

  // Cut on a word boundary. A hard slice landed mid-word ("locked into a cu…") on the last
  // screen a student reads before being asked to create an account.
  const truncateOnWord = (text, max) => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
  };

  const tradeoffs = draft.desired_lifestyle
    ? `Lifestyle goal: ${truncateOnWord(draft.desired_lifestyle, 120)}`
    : null;

  const handleCreateAccount = () => {
    // Ensure draft is persisted before navigating away
    saveDraft({ ...draft });
    nav('/register');
  };

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: '#FAFAF9' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <LogoWordmark />
          <Link to="/login" className="text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">Log in</Link>
        </div>

        {/* Completion badge */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: '#EEF2F6', border: '2px solid rgba(31,58,95,0.25)' }}>
            <Target size={28} style={{ color: 'var(--brand-navy-900)' }} />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#050816]">
            Your 30-Day Path Test Is Ready
          </h1>
          <p className="mt-3 max-w-lg text-[#64748B] leading-6">
            You've completed the intake. Create a free account to generate your three tailored paths, save your Mission Guides, and track what you learn.
          </p>
        </div>

        {/* Summary card */}
        <div className="mb-6 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.14em] mb-5" style={{ color: 'var(--brand-navy-700)' }}>Your intake summary</p>

          <div className="space-y-4">
            {draft.name && (
              <div className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#EEF2F6' }}>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--brand-navy-900)' }}>1</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">About you</p>
                  <p className="text-sm text-[#334155]">{draft.name}{draft.college ? ` · ${draft.college}` : ''}{draft.major ? ` · ${draft.major}` : ''}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#EEF2F6' }}>
                <span className="text-[10px] font-bold" style={{ color: 'var(--brand-navy-900)' }}>2</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Primary path to test</p>
                <p className="text-sm font-semibold text-[#050816]">{draft.primary_path}</p>
                {draft.comparison_path && (
                  <p className="text-sm text-[#64748B]">Comparing against: {draft.comparison_path}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#EEF2F6' }}>
                <Clock size={11} style={{ color: 'var(--brand-navy-900)' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Weekly availability</p>
                <p className="text-sm text-[#334155]">{draft.available_hours_per_week || 8} hours per week available for path-testing</p>
              </div>
            </div>

            {tradeoffs && (
              <div className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center" style={{ background: '#EEF2F6' }}>
                  <Zap size={11} style={{ color: 'var(--brand-navy-900)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Tradeoff to explore</p>
                  <p className="text-sm text-[#334155]">{tradeoffs}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Personal notes summary */}
        {(hasNotes || editingNotes) && !editingNotes && (
          <div className="mb-6 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: 'var(--brand-navy-900)' }} />
                <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>Personal context</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#334155] border border-[#E2E8F0] hover:bg-[#F8FAFC]">
                  <Pencil size={11} /> Edit
                </button>
                <button onClick={removeNotes}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50">
                  <X size={11} /> Remove
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {draft.personal_notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-0.5">Notes</p>
                  <p className="text-sm text-[#334155] line-clamp-3">{draft.personal_notes}</p>
                </div>
              )}
              {draft.long_term_ambitions && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-0.5">Long-term ambitions</p>
                  <p className="text-sm text-[#334155] line-clamp-2">{draft.long_term_ambitions}</p>
                </div>
              )}
              {draft.responsibilities_constraints && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-0.5">Responsibilities</p>
                  <p className="text-sm text-[#334155] line-clamp-2">{draft.responsibilities_constraints}</p>
                </div>
              )}
              {draft.things_to_avoid && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-0.5">Things to avoid</p>
                  <p className="text-sm text-[#334155] line-clamp-2">{draft.things_to_avoid}</p>
                </div>
              )}
              {draft.priorities_for_recommendations && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-0.5">Priorities</p>
                  <p className="text-sm text-[#334155] line-clamp-2">{draft.priorities_for_recommendations}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {editingNotes && (
          <div className="mb-6 rounded-[24px] border border-[#1F3A5F] bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.14em] mb-4" style={{ color: 'var(--brand-navy-700)' }}>Edit personal context</p>
            {[
              { name: 'personal_notes', label: 'Personal notes and context', maxLength: 3000 },
              { name: 'long_term_ambitions', label: 'Long-term ambitions' },
              { name: 'responsibilities_constraints', label: 'Responsibilities or constraints' },
              { name: 'things_to_avoid', label: 'Things I do not want' },
              { name: 'priorities_for_recommendations', label: 'Anything the recommendations should prioritize' },
            ].map(f => (
              <label key={f.name} className="block text-sm font-semibold text-[#334155] mb-4">
                {f.label}
                <textarea rows={3} value={notesForm[f.name]} maxLength={f.maxLength}
                  onChange={e => setNotesForm(n => ({ ...n, [f.name]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-normal text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F]" />
              </label>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setEditingNotes(false)}
                className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
                Cancel
              </button>
              <button onClick={saveNotes}
                className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Check size={14} /> Save notes
              </button>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm text-center">
          <p className="text-sm text-[#64748B] mb-6 leading-6">
            Create a free account to generate your three tailored paths, save your Mission Guides, and track what you learn.
          </p>
          <button onClick={handleCreateAccount}
            className="w-full flex items-center justify-center gap-2 rounded-[10px] py-3.5 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            Create My Free Account <ArrowRight size={16} />
          </button>
          <p className="mt-4 text-sm text-[#94A3B8]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold underline" style={{ color: 'var(--brand-navy-900)' }}>Log in</Link>
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={() => nav('/paths-intake')}
            className="flex items-center gap-2 text-sm font-semibold text-[#64748B] hover:text-[#050816] transition">
            <ArrowLeft size={14} /> Edit my path selection
          </button>
        </div>
      </div>
    </main>
  );
}