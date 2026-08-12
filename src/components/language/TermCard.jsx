/**
 * One term, explained where the student already is. Term, plain definition, why
 * it matters, and an example when there is a useful one, plus the option to keep
 * it. Nobody should have to leave a step to look a word up.
 */
import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import { saveVocabularyTerm, trackLanguage } from '@/lib/language-level';

export default function TermCard({ term, context = {} }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!term?.term || !term?.definition) return null;

  const keep = async () => {
    if (busy || saved) return;
    setBusy(true);
    const row = await saveVocabularyTerm({ ...term, ...context }).catch(() => null);
    setBusy(false);
    if (row) {
      setSaved(true);
      trackLanguage('glossary_term_saved', { term_length: term.term.length, path_id: context.path?.id || 'none' });
    }
  };

  return (
    <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{term.term}</p>
      <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{term.definition}</p>
      {term.why_it_matters && (
        <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-bold">Why it matters: </span>{term.why_it_matters}
        </p>
      )}
      {term.example && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
          <span className="font-bold">Example: </span>{term.example}
        </p>
      )}
      <button
        type="button"
        onClick={keep}
        disabled={busy || saved}
        className="touch-reach tp-meta mt-2.5 inline-flex items-center gap-1.5 font-bold disabled:opacity-70"
        style={{ color: saved ? 'var(--success-700)' : 'var(--brand-navy-700)' }}
      >
        {saved ? <><Check size={13} /> Saved to My Career Vocabulary</> : <><BookmarkPlus size={13} /> Save this term</>}
      </button>
    </div>
  );
}