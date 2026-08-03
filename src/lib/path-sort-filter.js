/**
 * Normalization maps and sort/filter utilities for PathRecommendations.
 * No stored data is modified — all transformations are purely in-memory.
 */

// ── Normalise raw string values ───────────────────────────────────────────────
function norm(raw) {
  if (!raw) return null;
  return String(raw).toLowerCase().replace(/[\s-]/g, '_');
}

// Confidence: Very Low=1 … Very High=5
const CONF_SCORE = {
  very_low: 1, low: 2, moderate: 3, medium: 3, high: 4, very_high: 5,
};

// Risk: Very Low=1 (best) … Very High=5 (worst)
const RISK_SCORE = {
  very_low: 1, low: 2, low_to_moderate: 2.5, moderate: 3, medium: 3,
  moderate_to_high: 3.5, high: 4, very_high: 5,
};

export function confScore(p) { return CONF_SCORE[norm(p.confidence_level)] ?? 3; }
export function riskScore(p) { return RISK_SCORE[norm(p.risk_level)] ?? 3; }

/**
 * Ordering key for readiness. NOT a display value.
 *
 * readiness_score is 0–10 (PathResults renders it as n/10). Live rows run
 * 0.6 to 9 and include fractional values, so this is a continuous score, not
 * an integer band. It used to default to 50, a leftover from an assumed
 * 0–100 scale, which put every unscored path above every scored one — the
 * exact opposite of the intended "readiness desc" ordering.
 *
 * UNSCORED is -1 rather than 0 so that a path the model genuinely scored 0
 * still outranks a path that was never scored at all. Those are different
 * facts and the sort shouldn't conflate them.
 *
 * Nothing renders this number: PathResults reads the raw field and prints
 * "Not scored" when it is missing. Keep it that way — a sentinel on screen
 * would be a lie, which is why sorting and display stay separate here.
 */
export const UNSCORED_READINESS = -1;

export function readinessScore(p) { return p.readiness_score ?? UNSCORED_READINESS; }

// ── Sort comparators ──────────────────────────────────────────────────────────
// All return negative / 0 / positive like Array.sort compareFn.
// Stable secondary: created_date descending, then id alphabetical.
function stable(a, b) {
  const da = new Date(a.created_date || 0).getTime();
  const db = new Date(b.created_date || 0).getTime();
  if (db !== da) return db - da;
  return (a.id || '').localeCompare(b.id || '');
}

export const SORT_OPTIONS = [
  { value: 'best_fit',       label: 'Best Overall Fit' },
  { value: 'confidence',     label: 'Highest Confidence' },
  { value: 'lowest_risk',    label: 'Lowest Risk' },
  { value: 'income',         label: 'Highest Income Potential' },
  { value: 'work_life',      label: 'Best Work-Life Balance' },
  { value: 'autonomy',       label: 'Most Autonomy' },
  { value: 'fastest_entry',  label: 'Fastest Time to Entry' },
  { value: 'newest',         label: 'Newest Recommendation' },
  { value: 'alpha',          label: 'Alphabetical' },
];

// Text-based heuristics for fields without structured enums
const INCOME_KEYWORDS   = ['very high', 'very_high', 'high income', 'high earning', '$500k', '$300k', '$200k', '$150k', 'top earner'];
const WORKLIFE_KEYWORDS = ['excellent', 'great', 'good', 'balanced', 'flexible'];
const AUTONOMY_KEYWORDS = ['full autonomy', 'high autonomy', 'independent', 'self-directed', 'freelance', 'founder'];
const FAST_KEYWORDS     = ['immediate', '< 1 year', 'less than 1', '6 months', '3 months', 'quick', 'fast'];

function textScore(text, keywords) {
  if (!text) return 0;
  const t = text.toLowerCase();
  return keywords.reduce((acc, kw) => acc + (t.includes(kw) ? 1 : 0), 0);
}

export function sortPaths(paths, sortBy) {
  const arr = [...paths]; // never mutate the original
  arr.sort((a, b) => {
    switch (sortBy) {
      case 'best_fit':
        // 1. confidence desc  2. risk asc  3. readiness desc
        if (confScore(b) !== confScore(a)) return confScore(b) - confScore(a);
        if (riskScore(a) !== riskScore(b)) return riskScore(a) - riskScore(b);
        if (readinessScore(b) !== readinessScore(a)) return readinessScore(b) - readinessScore(a);
        return stable(a, b);
      case 'confidence':
        if (confScore(b) !== confScore(a)) return confScore(b) - confScore(a);
        return stable(a, b);
      case 'lowest_risk':
        if (riskScore(a) !== riskScore(b)) return riskScore(a) - riskScore(b);
        return stable(a, b);
      case 'income': {
        const d = (p) => p.generated_detail || {};
        const sa = textScore([a.lifestyle_implications, d(a).income_trajectory].join(' '), INCOME_KEYWORDS);
        const sb = textScore([b.lifestyle_implications, d(b).income_trajectory].join(' '), INCOME_KEYWORDS);
        if (sb !== sa) return sb - sa;
        return stable(a, b);
      }
      case 'work_life': {
        const d = (p) => p.generated_detail || {};
        const sa = textScore([a.lifestyle_implications, d(a).lifestyle].join(' '), WORKLIFE_KEYWORDS);
        const sb = textScore([b.lifestyle_implications, d(b).lifestyle].join(' '), WORKLIFE_KEYWORDS);
        if (sb !== sa) return sb - sa;
        return stable(a, b);
      }
      case 'autonomy': {
        const d = (p) => p.generated_detail || {};
        const sa = textScore([a.lifestyle_implications, d(a).lifestyle, a.why_it_fits].join(' '), AUTONOMY_KEYWORDS);
        const sb = textScore([b.lifestyle_implications, d(b).lifestyle, b.why_it_fits].join(' '), AUTONOMY_KEYWORDS);
        if (sb !== sa) return sb - sa;
        return stable(a, b);
      }
      case 'fastest_entry': {
        const d = (p) => p.generated_detail || {};
        const sa = textScore([d(a).time_to_competitive, a.why_it_fits].join(' '), FAST_KEYWORDS);
        const sb = textScore([d(b).time_to_competitive, b.why_it_fits].join(' '), FAST_KEYWORDS);
        if (sb !== sa) return sb - sa;
        return stable(a, b);
      }
      case 'newest':
        return stable(a, b);
      case 'alpha':
        return (a.path_name || '').localeCompare(b.path_name || '');
      default:
        return stable(a, b);
    }
  });
  return arr;
}

// ── Status groups for filter UI ───────────────────────────────────────────────
export const ACTIVE_STATUSES  = ['active', 'exploring', 'draft'];
export const PAUSED_STATUSES  = ['paused'];
export const HISTORY_STATUSES = ['completed', 'archived', 'deprioritized'];

export function filterPaths(paths, filters) {
  return paths.filter(p => {
    // Status group
    if (filters.statusGroup !== 'all') {
      if (filters.statusGroup === 'active'  && !ACTIVE_STATUSES.includes(p.status))  return false;
      if (filters.statusGroup === 'paused'  && !PAUSED_STATUSES.includes(p.status))  return false;
      if (filters.statusGroup === 'history' && !HISTORY_STATUSES.includes(p.status)) return false;
    }
    // Risk
    if (filters.risk !== 'all') {
      const key = norm(p.risk_level);
      if (filters.risk === 'low'    && !['very_low','low','low_to_moderate'].includes(key)) return false;
      if (filters.risk === 'medium' && !['moderate','medium'].includes(key))               return false;
      if (filters.risk === 'high'   && !['moderate_to_high','high','very_high'].includes(key)) return false;
    }
    // Confidence
    if (filters.confidence !== 'all') {
      const s = confScore(p);
      if (filters.confidence === 'high'   && s < 4) return false;
      if (filters.confidence === 'medium' && (s < 3 || s > 3)) return false;
      if (filters.confidence === 'low'    && s > 2) return false;
    }
    // Category
    if (filters.category !== 'all' && (p.path_category || '') !== filters.category) return false;
    return true;
  });
}

export const DEFAULT_FILTERS = {
  statusGroup: 'all',
  risk: 'all',
  confidence: 'all',
  category: 'all',
};

// Read/write sort+filters to URL search params
export function filtersToParams(sortBy, filters) {
  const p = new URLSearchParams();
  if (sortBy !== 'best_fit') p.set('sort', sortBy);
  Object.entries(filters).forEach(([k, v]) => { if (v !== 'all') p.set(k, v); });
  return p.toString();
}

export function filtersFromParams(search) {
  const p = new URLSearchParams(search);
  return {
    sortBy: p.get('sort') || 'best_fit',
    filters: {
      statusGroup: p.get('statusGroup') || 'all',
      risk:        p.get('risk')        || 'all',
      confidence:  p.get('confidence')  || 'all',
      category:    p.get('category')    || 'all',
    },
  };
}