import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Trash2, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import Field from '@/components/onboarding/Field';
import ICSExportPanel from '@/components/calendar/ICSExportPanel';
import { generatePathTest } from '@/lib/path-generator';

const textareaCls = 'mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#274C77] resize-none';

const NOTES_FIELDS = [
  { name: 'personal_notes', label: 'Personal notes and context', placeholder: 'Anything about your situation or background that should personalize your recommendations...', maxLength: 3000 },
  { name: 'long_term_ambitions', label: 'Long-term ambitions', placeholder: 'What you ultimately want to build, achieve, or become...' },
  { name: 'responsibilities_constraints', label: 'Responsibilities or constraints', placeholder: 'e.g. family responsibilities, commuting, financial limits, health routines...' },
  { name: 'things_to_avoid', label: 'Things I do not want', placeholder: 'Careers, lifestyles, or commitments you want to avoid...' },
  { name: 'priorities_for_recommendations', label: 'Anything the recommendations should prioritize', placeholder: 'Specific factors or values that should weigh heavily in path evaluation...' },
];

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState({});
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notes, setNotes] = useState({});
  const [notesSaved, setNotesSaved] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenDone, setRegenDone] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [newSetId, setNewSetId] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser);
    base44.entities.StudentProfile.list('-created_date', 1).then(rows => {
      if (rows[0]) { setProfile(rows[0]); setNotes({ personal_notes: rows[0].personal_notes || '', long_term_ambitions: rows[0].long_term_ambitions || '', responsibilities_constraints: rows[0].responsibilities_constraints || '', things_to_avoid: rows[0].things_to_avoid || '', priorities_for_recommendations: rows[0].priorities_for_recommendations || '' }); }
    });
  }, []);

  const change = e => setUser({ ...user, [e.target.name]: e.target.value });
  const changeNote = e => setNotes(n => ({ ...n, [e.target.name]: e.target.value }));

  const save = async () => {
    await base44.auth.updateMe({ college: user.college, major: user.major, graduation_year: user.graduation_year, school_year: user.school_year });
    setSaved(true);
  };

  const saveNotes = async () => {
    if (profile?.id) {
      await base44.entities.StudentProfile.update(profile.id, notes);
    }
    setNotesSaved(true);
    setShowRegenPrompt(true);
    setTimeout(() => setNotesSaved(false), 3000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError('');
    try {
      // force: true is what makes this button do anything at all. Without it
      // generatePathTest() short-circuits on the student's existing complete
      // set and returns those same three rows — so the panel claimed new paths
      // had been generated and "View new paths" showed the old ones.
      const paths = await generatePathTest({ force: true });
      setRegenDone(true);
      setNewSetId(paths?.[0]?.path_set_id || '');
    } catch (err) {
      // Stage only — never the student's own words.
      console.error('[settings] path regeneration failed', err?.message || err);
      setRegenError("We couldn't generate new paths just now. Your saved context is safe — try again in a moment.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <PageHeader
        title="Keep your context current."
        description="Your direction can change. Update the facts that shape future roadmaps."
      />
      <section className="mb-8 grid gap-5 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:grid-cols-2">
        <Field label="Full name" value={user.full_name} name="full_name" onChange={change} />
        <Field label="Email" value={user.email} name="email" onChange={change} />
        <Field label="College" value={user.college} name="college" onChange={change} />
        <Field label="Major" value={user.major} name="major" onChange={change} />
        <Field label="Graduation year" value={user.graduation_year} name="graduation_year" onChange={change} />
        <Field label="School year" value={user.school_year} name="school_year" onChange={change} />
        <button
          onClick={save}
          className="rounded-[10px] px-5 py-3 font-semibold text-white transition hover:-translate-y-px sm:col-span-2"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
        >
          {saved ? 'Saved ✓' : 'Save changes'}
        </button>
        <button
          onClick={() => base44.auth.logout('/')}
          className="text-sm font-semibold text-[#64748B] hover:text-[#050816] transition sm:col-span-2"
        >
          Log out
        </button>
      </section>

      <div className="mb-3 mt-10">
        <h2 className="font-heading text-xl font-bold text-[#050816] mb-1">Personal context</h2>
        <p className="text-sm text-[#334155] mb-5">Add context, ambitions, constraints, or priorities that personalize your path recommendations. Changes influence future recommendations but do not rewrite past ones.</p>
      </div>
      <section className="mb-10 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm space-y-5">
        {NOTES_FIELDS.map(f => (
          <label key={f.name} className="block text-sm font-semibold text-[#334155]">
            {f.label}
            <span className="ml-2 text-xs font-normal text-[#94A3B8]">Optional</span>
            <textarea rows={3} name={f.name} value={notes[f.name] || ''} onChange={changeNote}
              placeholder={f.placeholder} maxLength={f.maxLength} className={textareaCls} />
            {f.maxLength && (notes[f.name] || '').length > 0 && (
              <span className="block text-right text-xs text-[#94A3B8] mt-0.5">{(notes[f.name] || '').length}/{f.maxLength}</span>
            )}
          </label>
        ))}
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
          🔒 Your notes are private to your account and are used only to personalize your Unscripted experience.
        </p>
        <button onClick={saveNotes} disabled={!profile}
          className="w-full rounded-[10px] px-5 py-3 font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {notesSaved ? 'Saved ✓' : 'Save personal context'}
        </button>

        {showRegenPrompt && !regenDone && (
          <div className="rounded-[16px] border border-[#274C77] bg-[#EEF2F6] p-5">
            <p className="text-sm font-bold text-[#1F3A5F] mb-1">Want to refresh your recommended paths?</p>
            <p className="text-xs text-[#334155] mb-4">Your personal context has been updated. Unscripted can generate new path recommendations tailored to your updated preferences — for example, if you now want to focus only on law-related roles.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleRegenerate} disabled={regenerating}
                className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition"
                style={{ background: 'var(--brand-navy-900)' }}>
                <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                {regenerating ? 'Generating new paths…' : 'Yes, refresh my paths'}
              </button>
              <button onClick={() => setShowRegenPrompt(false)} disabled={regenerating}
                className="rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-white transition">
                No, keep existing paths
              </button>
            </div>
            {regenError && <p className="mt-3 text-xs font-semibold text-red-600" role="alert">{regenError}</p>}
          </div>
        )}

        {regenDone && (
          <div className="rounded-[16px] border border-green-200 bg-green-50 p-5 flex items-start gap-3">
            <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">New paths generated!</p>
              <p className="text-xs text-green-700 mt-0.5">Your updated preferences have been applied and new recommendations have been added to your paths.</p>
              {/* Newest first, so the set that was just generated is at the top
                  of the page rather than below the older recommendations. */}
              <Link to="/paths?sort=newest" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-800 underline">
                View new paths <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="mb-3">
        <h2 className="font-heading text-xl font-bold text-[#050816] mb-1">Export to calendar</h2>
        <p className="text-sm text-[#334155]">Download .ics files to add your Unscripted schedule to Google Calendar, Apple Calendar, Outlook, or any standard calendar app.</p>
      </div>
      <ICSExportPanel showHeading={false} />

      <div className="mt-10">
        <h2 className="font-heading text-xl font-bold text-[#050816] mb-1">Recently deleted</h2>
        <p className="text-sm text-[#334155] mb-4">Mission Guides, contacts, reflections, and proof of work you've deleted are kept for 30 days before permanent removal.</p>
        <Link to="/recently-deleted"
          className="inline-flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-5 py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
          <Trash2 size={15} /> View Recently Deleted
        </Link>
      </div>
    </main>
  );
}