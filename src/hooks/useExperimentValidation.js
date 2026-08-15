import { useEffect, useState } from 'react';
import { loadExperimentValidation } from '@/lib/experiment-validation-load';

/**
 * The validation reading for one experiment. Returns null while loading, and a
 * reading with `validation: null` when nothing has been validated yet, which the
 * cards render as "Validation Still Developing" rather than hiding.
 */
export default function useExperimentValidation(experiment) {
  const [reading, setReading] = useState(null);

  useEffect(() => {
    let live = true;
    if (!experiment?.id) return () => { live = false; };
    loadExperimentValidation(experiment)
      .then(r => { if (live) setReading(r); })
      .catch(() => { if (live) setReading({ error: true }); });
    return () => { live = false; };
  }, [experiment?.id]);

  return reading;
}