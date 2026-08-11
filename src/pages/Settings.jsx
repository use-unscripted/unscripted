import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Trash2, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import Field from '@/components/onboarding/Field';
import ICSExportPanel from '@/components/calendar/ICSExportPanel';
import { generatePathTest } from '@/lib/path-generator';
import { buildOptOut, optBackInPatch, isOptedOut, mergeOptOutRows } from '@/lib/nudge-response';
import { clearCampusStore } from '@/lib/campus-store';

const textareaCls = 'mt-1 w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-base md:text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-700)] resize-none';

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
  const [optOutRows, setOptOutRows] = useState([]);
  const [emailBusy, setEmailBusy] = useState(false);

  // Every nudge email ends with a line telling students to turn these off here,
  // so this read is what makes that sentence true. It asks for this student's
  // rows rather than the newest 20 of everything: on the list call, twenty rows
  // written by other students between one visit and the next were enough to
  // push a real opt out off the end and draw the button as though the emails
  // were still on.
  // Reads are numbered so a slow one cannot overwrite a newer one. The mount read
  // and the read that follows a button press can be in flight together, and if the
  // mount read lands last it carries a snapshot taken before the press: the server
  // is right, the emails really are off, and the button says otherwise until a
  // reload. Every write also merges through the functional form, so nothing this
  // session did can be lost to a read that has not caught up.
  const optOutRead = useRef(0);
  const optOutWrites = useRef([]);
  const loadOptOuts = useCallback(async (userId, known = []) => {
    if (!userId) return;
    if (known.length) optOutWrites.current = mergeOptOutRows(optOutWrites.current, known);
    const ticket = ++optOutRead.current;
    try {
      const rows = await base44.entities.NudgeOptOut.filter({ user_id: userId }, '-created_date', 100);
      if (ticket !== optOutRead.current) return;
      setOptOutRows(mergeOptOutRows(rows, optOutWrites.current));
    } catch (err) {
      console.error('[settings] could not read the email setting:', err?.message || 'unknown');
      // A failed read must not undo what the student just did on this screen.
      if (known.length) setOptOutRows(rows => mergeOptOutRows(rows, known));
    }
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u || {});
      loadOptOuts(u?.id);
    });
    base44.entities.StudentProfile.list('-created_date', 1).then(rows => {
      if (rows[0]) { setProfile(rows[0]); setNotes({ personal_notes: rows[0].personal_notes || '', long_term_ambitions: rows[0].long_term_ambitions || '', responsibilities_constraints: rows[0].responsibilities_constraints || '', things_to_avoid: rows[0].things_to_avoid || '', priorities_for_recommendations: rows[0].priorities_for_recommendations || '' }); }
    });
  }, [loadOptOuts]);

  const emailsOff = isOptedOut(optOutRows, user?.id);

  const stopEmails = async () => {
    if (!user?.id || emailBusy) return;
    setEmailBusy(true);
    try {
      const row = await base44.entities.NudgeOptOut.create(
        buildOptOut({ userId: user.id, source: 'settings', now: new Date() })
      );
      // created_by_id is stamped by the server, and isOptedOut requires it to
      // equal user_id, so a response that came back without it would leave the
      // button still reading "Stop these emails" right after the student
      // pressed it. This is their own row, created in their own session, so
      // filling the creator in locally states what the server just did rather
      // than making a claim about anybody else.
      // A row with no id could never be turned back on, so it is not worth
      // holding on to. If the create came back with nothing useful the refetch
      // below is the only source, which is the honest outcome anyway.
      const seen = row && typeof row === 'object' && row.id
        ? { ...row, created_by_id: row.created_by_id || user.id }
        : null;
      const known = seen ? [seen] : [];
      if (seen) setOptOutRows(rows => mergeOptOutRows(rows, known));
      await loadOptOuts(user.id, known);
    } catch (err) {
      console.error('[settings] could not turn the emails off:', err?.message || 'unknown');
    } finally {
      setEmailBusy(false);
    }
  };

  // Turning them back on soft deletes the row rather than removing it, which is
  // what the rest of this app does and keeps "off in March, on in April".
  const startEmails = async () => {
    if (emailBusy) return;
    setEmailBusy(true);
    const patch = optBackInPatch(new Date());
    const live = optOutRows.filter(r => r && r.id && r.user_id === user?.id
      && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted');
    try {
      for (const row of live) {
        // Sequential on purpose: there is normally one row, and a student
        // watching a button does not benefit from parallelism here.
        await base44.entities.NudgeOptOut.update(row.id, patch);
      }
      const turnedOff = live.map(r => ({ ...r, ...patch }));
      setOptOutRows(rows => mergeOptOutRows(rows, turnedOff));
      await loadOptOuts(user?.id, turnedOff);
    } catch (err) {
      console.error('[settings] could not turn the emails back on:', err?.message || 'unknown');
    } finally {
      setEmailBusy(false);
    }
  };

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
      // Stage only — never the student's own words, and never the raw error,
      // whose server detail can quote the request that carried them.
      console.error(`[settings] path regeneration failed at stage=${err?.stage || 'unknown'}`);
      setRegenError("We couldn't generate new paths just now. Your saved context is safe. Try again in a moment.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <main className="app-page">
      <PageHeader
        title="Keep your context current."
        description="Your direction can change. Update the facts that shape future roadmaps."
      />
      <section className="mb-8 grid gap-5 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm sm:grid-cols-2">
        <Field label="Full name" value={user.full_name} name="full_name" onChange={change} />
        <Field label="Email" value={user.email} name="email" onChange={change} />
        <Field label="College" value={user.college} name="college" onChange={change} />
        <Field label="Major" value={user.major} name="major" onChange={change} />
        <Field label="Graduation year" value={user.graduation_year} name="graduation_year" onChange={change} />
        <Field label="School year" value={user.school_year} name="school_year" onChange={change} />
        {/* Sized to its own words above `sm` rather than to the card. A button
            as wide as the form was already stretched at the old page width;
            on the wider one it was a 1000px bar. */}
        <button
          onClick={save}
          className="rounded-[var(--r-control)] px-5 py-3 font-semibold text-white transition hover:-translate-y-px sm:col-span-2 sm:justify-self-start sm:px-10"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
        >
          {saved ? 'Saved' : 'Save changes'}
        </button>
        <button
          onClick={() => { clearCampusStore(); base44.auth.logout('/'); }}
          className="tp-body touch-target font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--surface-dark-900)] transition sm:col-span-2 sm:justify-self-start"
        >
          Log out
        </button>
      </section>

      <div className="mb-3 mt-10">
        <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-1.5">Personal context</h2>
        <p className="tp-prose text-[color:var(--ink-700)] mb-5">Add context, ambitions, constraints, or priorities that personalize your path recommendations. Changes influence future recommendations but do not rewrite past ones.</p>
      </div>
      <section className="mb-10 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm space-y-5">
        {NOTES_FIELDS.map(f => (
          <label key={f.name} className="tp-body block font-semibold text-[color:var(--ink-700)]">
            {f.label}
            <span className="tp-meta ml-2 inline font-normal text-[color:var(--ink-400)]">Optional</span>
            <textarea rows={3} name={f.name} value={notes[f.name] || ''} onChange={changeNote}
              placeholder={f.placeholder} maxLength={f.maxLength} className={textareaCls} />
            {f.maxLength && (notes[f.name] || '').length > 0 && (
              <span className="tp-meta block text-right text-[color:var(--ink-400)] mt-1">{(notes[f.name] || '').length}/{f.maxLength}</span>
            )}
          </label>
        ))}
        <p className="tp-meta rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3.5 text-[color:var(--ink-500)]">
          Your notes are private to your account and are used only to personalize your Unscripted experience.
        </p>
        <button onClick={saveNotes} disabled={!profile}
          className="w-full rounded-[var(--r-control)] px-5 py-3 font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          {notesSaved ? 'Saved' : 'Save personal context'}
        </button>

        {showRegenPrompt && !regenDone && (
          <div className="rounded-[var(--r-surface)] border border-[color:var(--brand-navy-700)] bg-[color:var(--ink-100)] p-5">
            <p className="tp-card text-[color:var(--brand-navy-900)] mb-1.5">Want to refresh your recommended paths?</p>
            <p className="tp-prose text-[color:var(--ink-700)] mb-5">Your personal context has been updated. Unscripted can generate new path recommendations tailored to your updated preferences. For example, if you now want to focus only on law-related roles.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleRegenerate} disabled={regenerating}
                className="tp-body flex items-center gap-2 rounded-[var(--r-control)] px-5 py-3 font-semibold text-white disabled:opacity-60 transition"
                style={{ background: 'var(--brand-navy-900)' }}>
                <RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />
                {regenerating ? 'Generating new paths…' : 'Yes, refresh my paths'}
              </button>
              <button onClick={() => setShowRegenPrompt(false)} disabled={regenerating}
                className="tp-body rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
                No, keep existing paths
              </button>
            </div>
            {regenError && <p className="tp-meta mt-3 font-semibold text-red-600" role="alert">{regenError}</p>}
          </div>
        )}

        {regenDone && (
          <div className="rounded-[var(--r-surface)] border border-green-200 bg-green-50 p-5 flex items-start gap-3">
            <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="tp-card text-green-800">New paths generated!</p>
              <p className="tp-prose text-green-700 mt-1.5">Your updated preferences have been applied and new recommendations have been added to your paths.</p>
              {/* Newest first, so the set that was just generated is at the top
                  of the page rather than below the older recommendations. */}
              <Link to="/paths?sort=newest" className="tp-meta mt-3 inline-flex items-center gap-1 font-semibold text-green-800 underline">
                View new paths <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="mb-3">
        <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-1.5">Export to calendar</h2>
        <p className="tp-prose text-[color:var(--ink-700)]">Download .ics files to add your Unscripted schedule to Google Calendar, Apple Calendar, Outlook, or any standard calendar app.</p>
      </div>
      <ICSExportPanel showHeading={false} />

      <div className="mt-10 mb-3">
        <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-1.5">Emails from us</h2>
        <p className="tp-prose text-[color:var(--ink-700)]">At most one email a week, with one thing to do or one question to answer. Turning them off does not change anything else on your account.</p>
      </div>
      <section className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-7 shadow-sm">
        {emailsOff ? (
          <>
            <p className="tp-body font-semibold text-[color:var(--surface-dark-900)] mb-4">These emails are off.</p>
            <button onClick={startEmails} disabled={emailBusy}
              className="tp-body rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition disabled:opacity-60">
              Start sending them again
            </button>
          </>
        ) : (
          <button onClick={stopEmails} disabled={emailBusy || !user?.id}
            className="tp-body rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition disabled:opacity-60">
            Stop these emails
          </button>
        )}
      </section>

      <div className="mt-10">
        <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-1.5">Recently deleted</h2>
        <p className="tp-prose text-[color:var(--ink-700)] mb-4">Mission Guides, contacts, reflections, and proof of work you've deleted are kept for 30 days before permanent removal.</p>
        <Link to="/recently-deleted"
          className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
          <Trash2 size={16} /> View Recently Deleted
        </Link>
      </div>
    </main>
  );
}