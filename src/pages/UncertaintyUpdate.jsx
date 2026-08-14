/**
 * "Help us understand what you are still figuring out."
 *
 * The short update for a student who onboarded before the intake asked about
 * uncertainty. It asks the newly required questions and NOTHING else: their
 * original answers are read, kept, and never re-asked, and their existing
 * personalised paths are not regenerated or touched by this page.
 *
 * It writes onto the student's existing StudentProfile row, adding only the
 * fields that were missing. A student with no profile row at all is sent to the
 * full intake instead, because there is nothing here to update.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Sk } from '@/components/PageSkeleton';
import { Scale, Tags, ChipsMulti } from '@/components/onboarding/OnboardingFields';
import { UNKNOWNS, DECISIONS } from '@/lib/onboarding-steps';

const asOptions = (values) => values.map(v => ({ value: v, label: v }));
const list = (v) => (Array.isArray(v) ? v : []);

export default function UncertaintyUpdate() {
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    baseline_career_clarity: null,
    baseline_confidence: null,
    current_careers_considered: [],
    careers_ruled_out: [],
    current_decision_pressure: [],
    major_uncertainties: [],
    major_uncertainties_other: '',
  });

  useEffect(() => {
    base44.entities.StudentProfile.list('-created_date', 1)
      .then(rows => {
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) { nav('/onboarding', { replace: true }); return; }
        setProfile(row);
        // Seed from whatever they already have. The career they named at
        // signup counts as a career they are considering, so it is offered
        // back to them rather than asked for again.
        setForm({
          baseline_career_clarity: row.baseline_career_clarity || null,
          baseline_confidence: row.baseline_confidence || null,
          current_careers_considered: list(row.current_careers_considered).length
            ? list(row.current_careers_considered)
            : [row.career_interests, row.secret_paths].filter(Boolean),
          careers_ruled_out: list(row.careers_ruled_out),
          current_decision_pressure: list(row.current_decision_pressure),
          major_uncertainties: list(row.major_uncertainties),
          major_uncertainties_other: row.major_uncertainties_other || '',
        });
        setLoading(false);
      })
      .catch(() => { setError('We could not load your answers. Please try again.'); setLoading(false); });
  }, [nav]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.baseline_career_clarity) { setError('Pick a number for how clear you are. Any number, including 1.'); return; }
    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      // Only the new fields. Nothing they answered originally is written here,
      // so nothing they answered originally can be overwritten.
      await base44.entities.StudentProfile.update(profile.id, {
        baseline_career_clarity: form.baseline_career_clarity,
        baseline_confidence: form.baseline_confidence || undefined,
        current_careers_considered: form.current_careers_considered,
        careers_ruled_out: form.careers_ruled_out,
        current_decision_pressure: form.current_decision_pressure,
        major_uncertainties: form.major_uncertainties,
        major_uncertainties_other: form.major_uncertainties_other,
        baseline_recorded_at: profile.baseline_recorded_at || now,
        uncertainty_updated_at: now,
      });
      nav('/journey', { replace: true });
    } catch {
      setError('That did not save. Nothing you entered was lost, so press the button again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="app-page">
        <Sk h={30} w="60%" r={7} className="mb-6" />
        <Sk h={220} r={16} />
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        showBack
        title="What are you still figuring out?"
        description="Your original answers and your paths stay exactly as they are. These few questions are what your next experiments are chosen from."
      />

      <div className="app-stack">
        <div className="app-card p-6 sm:p-8">
          <Scale
            label="How certain are you about what you want to do?"
            description="A low number is not a problem. This is the number we measure your progress against."
            value={form.baseline_career_clarity}
            onChange={v => set('baseline_career_clarity', v)}
            lowLabel="No idea at all"
            highLabel="Completely certain"
          />
          <div className="mt-6">
            <Scale
              label="And how confident are you in that answer?"
              description="Optional."
              value={form.baseline_confidence}
              onChange={v => set('baseline_confidence', v)}
              lowLabel="Not confident"
              highLabel="Very confident"
            />
          </div>
        </div>

        <div className="app-card p-6 sm:p-8">
          <p className="tp-card mb-1" style={{ color: 'var(--text-primary)' }}>Careers you are considering</p>
          <p className="tp-meta mb-4" style={{ color: 'var(--text-secondary)' }}>
            Optional. Edit or remove anything here, and leave it empty if nothing fits.
          </p>
          <Tags
            value={form.current_careers_considered}
            onChange={v => set('current_careers_considered', v)}
            placeholder="e.g. Product management"
          />

          <p className="tp-card mb-1 mt-7" style={{ color: 'var(--text-primary)' }}>Anything you have ruled out</p>
          <p className="tp-meta mb-4" style={{ color: 'var(--text-secondary)' }}>
            Optional. We will not suggest these back to you.
          </p>
          <Tags
            value={form.careers_ruled_out}
            onChange={v => set('careers_ruled_out', v)}
            placeholder="e.g. Law school"
          />
        </div>

        <div className="app-card p-6 sm:p-8">
          <p className="tp-card mb-1" style={{ color: 'var(--text-primary)' }}>What are you deciding right now?</p>
          <p className="tp-meta mb-4" style={{ color: 'var(--text-secondary)' }}>Optional.</p>
          <ChipsMulti
            options={asOptions(DECISIONS)}
            value={form.current_decision_pressure}
            onChange={v => set('current_decision_pressure', v)}
          />
        </div>

        <div className="app-card p-6 sm:p-8">
          <p className="tp-card mb-1" style={{ color: 'var(--text-primary)' }}>What is still open for you?</p>
          <p className="tp-meta mb-4" style={{ color: 'var(--text-secondary)' }}>
            These become the questions your experiments are built to answer.
          </p>
          <ChipsMulti
            options={asOptions(UNKNOWNS)}
            value={form.major_uncertainties}
            onChange={v => set('major_uncertainties', v)}
            note={form.major_uncertainties_other}
            onNote={v => set('major_uncertainties_other', v)}
            noteLabel="Something else you are trying to figure out"
            notePlaceholder="In your own words"
          />
        </div>

        {error && (
          <p className="tp-body rounded-[var(--r-control)] px-3 py-2.5" role="alert"
            style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}>
            {error}
          </p>
        )}

        <button onClick={save} disabled={saving}
          className="ui-press tp-body flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saving' : 'Save and continue'}
        </button>
      </div>
    </main>
  );
}