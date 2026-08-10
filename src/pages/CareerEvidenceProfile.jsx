/**
 * The Career Evidence Profile.
 *
 * A living record of what Unscripted has actually learned about this student.
 * Every conclusion on this page is derived from the Career Evidence Graph and
 * carries the records behind it, so nothing here exists only as generated text.
 *
 * Private to the student. There is no sharing, no employer or university view,
 * and no professional validation on this screen.
 */
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { SkHeader, SkCards } from '@/components/PageSkeleton';
import ProfileSection, { StillLearning } from '@/components/evidence-profile/ProfileSection';
import HypothesisCard from '@/components/evidence-profile/HypothesisCard';
import AbilityCard from '@/components/evidence-profile/AbilityCard';
import PreferenceCard from '@/components/evidence-profile/PreferenceCard';
import PatternCard from '@/components/evidence-profile/PatternCard';
import ExperimentHistoryCard from '@/components/evidence-profile/ExperimentHistoryCard';
import ProofEvidenceCard from '@/components/evidence-profile/ProofEvidenceCard';
import OpenQuestions from '@/components/evidence-profile/OpenQuestions';
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { deriveAbilities } from '@/lib/evidence-abilities';

export default function CareerEvidenceProfile() {
  const [data, setData] = useState(null);
  const [showAllPreferences, setShowAllPreferences] = useState(false);

  useEffect(() => { loadEvidenceProfile().then(setData).catch(() => setData({ error: true })); }, []);

  if (!data) {
    return (
      <main className="app-page">
        <SkHeader description action={false} />
        <SkCards count={3} h={180} r={16} />
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="app-page">
        <PageHeader title="Career Evidence Profile." description="We could not load your evidence just now. Refresh and try again." />
      </main>
    );
  }

  const { hypotheses, abilities, preferences, energisers, drains, history, proof, experiments, counts, openQuestions, disagreements } = data;
  const flagged = new Set(disagreements.map(d => d.conclusion_key));
  const settledPrefs = preferences.filter(p => p.status !== 'still_learning');
  const learningPrefs = preferences.filter(p => p.status === 'still_learning');

  return (
    <main className="app-page">
      <PageHeader
        title="Career Evidence Profile."
        description="What Unscripted has learned about you so far, and how sure it is. Every conclusion here is built from your own experiments, ratings, reflections and proof, and it gets sharper as you do more."
      />

      <div className="tp-meta mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] border p-4"
        style={{ borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-500)' }}>
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          <Lock size={12} /> Private to you
        </span>
        <span>{counts.completedExperiments} experiment{counts.completedExperiments === 1 ? '' : 's'} completed</span>
        <span>{counts.measuredExperiments} measured</span>
        <span>{counts.proof} proof{counts.proof === 1 ? '' : 's'}</span>
        <span>{counts.reflections} reflection{counts.reflections === 1 ? '' : 's'}</span>
        <span>{counts.graph.edges} evidence connections</span>
      </div>

      <ProfileSection index={1} title="Career hypotheses" count={hypotheses.length}
        description="Where each career you are testing currently stands. Fit and confidence are separate numbers and are never combined.">
        {hypotheses.length === 0 ? (
          <StillLearning>You are not testing any career hypotheses yet, so there is nothing to score.</StillLearning>
        ) : (
          <div className="space-y-4">
            {hypotheses.map(item => (
              <HypothesisCard key={item.path.id} item={item} flagged={flagged.has(`career:${item.path.id}`)} />
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={2} title="What you're showing strength in" count={abilities.length}
        description="Demonstrated ability only. This section says nothing about whether you enjoy the work, which is measured separately below.">
        {abilities.length === 0 ? (
          <StillLearning>Nothing has been demonstrated yet. Completing an experiment or adding proof of work is what puts an ability here.</StillLearning>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {abilities.map(a => <AbilityCard key={a.id} ability={a} flagged={flagged.has(`ability:${a.id}`)} />)}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={3} title="Work preferences" count={settledPrefs.length}
        description="How you appear to prefer working, based on what you rated after doing the work.">
        {settledPrefs.length === 0 ? (
          <StillLearning>We have not measured enough work yet to say how you prefer to work.</StillLearning>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {settledPrefs.map(p => <PreferenceCard key={p.id} preference={p} flagged={flagged.has(`preference:${p.id}`)} />)}
          </div>
        )}

        {learningPrefs.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowAllPreferences(o => !o)}
              className="tp-meta touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
              {showAllPreferences ? 'Hide' : `Show ${learningPrefs.length} we are still learning`}
            </button>
            {showAllPreferences && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {learningPrefs.map(p => <PreferenceCard key={p.id} preference={p} />)}
              </div>
            )}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={4} title="What gives you energy" count={energisers.length}
        description="Enjoyment and motivation only. Strength in something does not put it here, and energy here does not imply strong ability yet.">
        {energisers.length === 0 ? (
          <StillLearning>No pattern yet. These appear once your post-experiment ratings start repeating themselves.</StillLearning>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {energisers.map(p => <PatternCard key={p.id} pattern={p} flagged={flagged.has(`energiser:${p.id}`)} />)}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={5} title="What drains you" count={drains.length}
        description="Kinds of work that rated lower on energy or higher on frustration. This is evidence about work fit, not about you.">
        {drains.length === 0 ? (
          <StillLearning>Nothing here yet. This section fills in from your own ratings, not from assumptions.</StillLearning>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {drains.map(p => <PatternCard key={p.id} pattern={p} flagged={flagged.has(`drain:${p.id}`)} />)}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={6} title="Experiments completed" count={history.length}
        description="Your experiment history and what each one measured.">
        {history.length === 0 ? (
          <StillLearning>No completed experiments yet. This is where the strongest evidence comes from.</StillLearning>
        ) : (
          <div className="space-y-4">
            {history.map(entry => <ExperimentHistoryCard key={entry.experiment.id} entry={entry} />)}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={7} title="Proofs of evidence" count={proof.length}
        description="Your existing proof of work, shown here with what it connects to.">
        {proof.length === 0 ? (
          <StillLearning>No proof of work saved yet.</StillLearning>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {proof.map(p => {
              const exp = experiments.find(e => e.id === p.experiment_id) || null;
              const supported = deriveAbilities({ proof: [p] }).map(a => a.label);
              return (
                <ProofEvidenceCard key={p.id} proof={p} experiment={exp}
                  career={p.path_tested || exp?.career_name || exp?.path_name || null}
                  abilities={supported} />
              );
            })}
          </div>
        )}
      </ProfileSection>

      <ProfileSection index={8} title="What we are still learning" count={openQuestions.length}
        description="The questions your evidence cannot answer yet. These stay open until something you do answers them.">
        {openQuestions.length === 0 ? (
          <StillLearning>No open questions right now.</StillLearning>
        ) : (
          <OpenQuestions questions={openQuestions} />
        )}
      </ProfileSection>

      <p className="tp-meta rounded-[16px] p-5 text-center"
        style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)', color: 'var(--ink-500)' }}>
        Nothing here is a verdict. Confidence never reaches certainty, and anything you flag as inaccurate stays on file next to the evidence so a future experiment can settle it.
      </p>
    </main>
  );
}