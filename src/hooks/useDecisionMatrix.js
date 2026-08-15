import { useEffect, useState } from 'react';
import { loadDecisionMatrix } from '@/lib/decision-matrix-load';

/** Loads the matrix once per mount. Read-only, so nothing needs invalidating. */
export default function useDecisionMatrix() {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let alive = true;
    loadDecisionMatrix()
      .then(data => { if (alive) setState({ loading: false, data }); })
      .catch(() => { if (alive) setState({ loading: false, data: null }); });
    return () => { alive = false; };
  }, []);

  return state;
}