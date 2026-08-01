/**
 * The comparison categories, in one place, so all three paths are always
 * described by the SAME questions in the SAME order.
 *
 * Wording rule: a path is something you test, never a match or a perfect fit.
 * Nothing here promises an outcome.
 */
const list = (v) => (Array.isArray(v) ? v.filter(Boolean).join(' · ') : v || '');

export const COMPARISON_FIELDS = [
  { key: 'why', label: 'Why it was recommended', get: p => p.fit_reason || p.why_it_fits },
  { key: 'signals', label: 'Relevant interests and strengths', get: p => list(p.path_fit_signals) },
  { key: 'goals', label: 'Goals supported', get: p => p.goals_supported || p.goals },
  { key: 'lifestyle', label: 'Lifestyle and work environment', get: p => p.lifestyle_implications },
  { key: 'tradeoffs', label: 'Important tradeoffs', get: p => p.main_tradeoffs },
  { key: 'risks', label: 'Risks and uncertainty', get: p => p.concern || p.why_it_may_not_fit },
  { key: 'gaps', label: 'Skills or exposure still needed', get: p => list(p.current_gaps) || list(p.skill_gaps) },
  { key: 'experiment', label: 'Recommended first experiment', get: p => p.first_experiment },
  {
    key: 'confidence',
    label: 'Confidence level',
    get: p => {
      const level = p.confidence_level ? `${p.confidence_level[0].toUpperCase()}${p.confidence_level.slice(1)}` : '';
      const why = p.confidence_explanation || '';
      return [level, why].filter(Boolean).join(' — ');
    },
  },
];

export const RISK_LABEL = { low: 'Lower risk', medium: 'Moderate risk', high: 'Higher risk' };