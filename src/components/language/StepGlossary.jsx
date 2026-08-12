/**
 * The terms used in this step, behind one quiet line, plus "What does this mean?"
 * for anything the step did not cover.
 *
 * Nothing here is required reading: the step's instruction and its completion
 * criteria stand on their own, and definitions only appear when a student asks
 * for them.
 */
import { useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import TermCard from '@/components/language/TermCard';
import { trackLanguage } from '@/lib/language-level';
import { explainPhrase } from '@/lib/language-transform';

export default function StepGlossary({ terms = [], careerName, step, context = {} }) {
  const [openTerms, setOpenTerms] = useState(false);
  const [asking, setAsking] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [failed, setFailed] = useState(false);

  const ask = async () => {
    const value = phrase.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    trackLanguage('what_does_this_mean_clicked', { path_id: context.path?.id || 'none', phrase_length: value.length });
    const res = await explainPhrase({
      phrase: value,
      careerName,
      stepTitle: step?.title,
      stepDescription: step?.description,
    }).catch(() => null);
    setBusy(false);
    if (res) setAnswer(res); else setFailed(true);
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-4">
        {terms.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setOpenTerms(v => !v);
              if (!openTerms) trackLanguage('glossary_term_opened', { count: terms.length, path_id: context.path?.id || 'none' });
            }}
            className="touch-reach tp-meta inline-flex items-center gap-1.5 font-bold"
            style={{ color: 'var(--brand-navy-700)' }}
          >
            <HelpCircle size={13} /> {openTerms ? 'Hide terms' : `Terms used here (${terms.length})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAsking(v => !v)}
          className="touch-reach tp-meta inline-flex items-center gap-1.5 font-bold"
          style={{ color: 'var(--brand-navy-700)' }}
        >
          <HelpCircle size={13} /> What does this mean?
        </button>
      </div>

      {openTerms && terms.length > 0 && (
        <div className="mt-3 space-y-2">
          {terms.map((t, i) => <TermCard key={`${t.term}-${i}`} term={t} context={context} />)}
        </div>
      )}

      {asking && (
        <div className="mt-3 rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <label className="tp-meta block font-bold" style={{ color: 'var(--text-secondary)' }}>
            Which word or phrase?
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              placeholder="e.g. comps"
              className="w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
              style={{ borderColor: 'var(--border-light)', background: 'white' }}
            />
            <button
              type="button"
              onClick={ask}
              disabled={busy || !phrase.trim()}
              className="tp-body inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Explain
            </button>
          </div>
          {failed && (
            <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
              We could not explain that one just now. The step above is unchanged, so carry on and try again in a moment.
            </p>
          )}
          {answer && (
            <div className="mt-3">
              <TermCard term={answer} context={context} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}