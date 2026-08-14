/**
 * One step's wording at the current level. The authoritative text is what shows
 * while a rewrite is in flight and what shows if it fails, so this hook can never
 * leave a step blank.
 */
import { useEffect, useState } from 'react';
import { describeStepAtLevel } from '@/lib/language-transform';

export default function useStepLanguage({ step, level, careerName, objective, context }) {
  const authoritative = {
    title: step?.title || '',
    description: step?.description || '',
    terms: [],
    fallback: false,
  };
  const [state, setState] = useState({ ...authoritative, loading: false });

  const stepKey = `${step?.step_number ?? ''}|${step?.title || ''}|${step?.description || ''}`;

  useEffect(() => {
    let live = true;
    if (level === 'balanced') {
      setState({ ...authoritative, loading: false });
      return () => { live = false; };
    }
    setState(s => ({ ...s, ...authoritative, loading: true }));
    describeStepAtLevel({ level, step, careerName, objective, context })
      .then(res => { if (live) setState({ ...res, loading: false }); })
      .catch(() => { if (live) setState({ ...authoritative, loading: false, fallback: true }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, stepKey, careerName]);

  return state;
}