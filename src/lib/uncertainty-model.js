/**
 * Uncertainty model for Career Hypotheses.
 *
 * Sits on top of the existing hypothesis layer (career-hypothesis.js) and does
 * not replace any of it. Its only job is to make uncertainty explicit: for a
 * given career, which work characteristics actually matter, what we already know
 * about the student on each one, and which unknowns are holding confidence down.
 *
 * Two rules this module exists to enforce:
 *  - Evidence strength only rises when the student produces evidence. Nothing
 *    here reads a clock, so time passing cannot make us more confident.
 *  - Relevance is per career. Most variables are irrelevant to most careers and
 *    are left out rather than shown at zero.
 *
 * Choosing the next best experiment is deliberately NOT in here.
 */

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * The work characteristics we model. `keys` are matched against the career's own
 * name, category and description to decide relevance. `ask` is the question we
 * put to the student when the variable is still untested.
 */
export const WORK_VARIABLES = [
  { id: 'ambiguity_tolerance', label: 'Ambiguity tolerance', ask: 'How do you respond when the problem is not clearly defined?', keys: ['startup', 'founder', 'product', 'strategy', 'venture', 'entrepreneur', 'consult', 'research'] },
  { id: 'analytical_intensity', label: 'Analytical intensity', ask: 'Do you enjoy sustained analytical work, not just occasional analysis?', keys: ['analyst', 'analytic', 'data', 'finance', 'invest', 'bank', 'research', 'quant', 'engineer', 'consult'] },
  { id: 'quantitative_work', label: 'Quantitative work', ask: 'Do you enjoy working in numbers and models for hours at a time?', keys: ['finance', 'invest', 'bank', 'quant', 'data', 'account', 'actuar', 'trading', 'economic'] },
  { id: 'creativity', label: 'Creativity', ask: 'Do you enjoy generating original work rather than executing a defined brief?', keys: ['design', 'creative', 'brand', 'market', 'content', 'media', 'writ', 'art', 'product'] },
  { id: 'persuasion', label: 'Persuasion', ask: 'Do you enjoy repeated persuasion, or does it wear you down?', keys: ['sales', 'business development', 'market', 'brand', 'consult', 'law', 'fundrais', 'recruit', 'account manage'] },
  { id: 'communication', label: 'Communication', ask: 'How comfortable are you explaining your thinking to people who disagree?', keys: ['consult', 'market', 'sales', 'product', 'teach', 'polic', 'manage', 'communicat', 'client'] },
  { id: 'teamwork', label: 'Cross-functional teamwork', ask: 'Do you do your best work alongside other people?', keys: ['product', 'consult', 'manage', 'engineer', 'operations', 'health', 'agency', 'team'] },
  { id: 'independent_work', label: 'Independent work', ask: 'Can you sustain long stretches of work with nobody checking in?', keys: ['research', 'writ', 'freelance', 'founder', 'entrepreneur', 'creator', 'develop', 'academ'] },
  { id: 'leadership', label: 'Leadership', ask: 'Do you want responsibility for other people\u2019s work, not just your own?', keys: ['manage', 'lead', 'founder', 'director', 'operations', 'entrepreneur', 'chief'] },
  { id: 'autonomy', label: 'Autonomy', ask: 'Do you want to set your own direction, or do you prefer clear direction?', keys: ['founder', 'entrepreneur', 'freelance', 'creator', 'independent', 'venture', 'research'] },
  { id: 'structure', label: 'Structure', ask: 'Do you work better inside a defined process or outside one?', keys: ['bank', 'law', 'account', 'medic', 'health', 'government', 'polic', 'corporate', 'audit', 'compliance'] },
  { id: 'pace', label: 'Pace and intensity', ask: 'Can you sustain this field\u2019s working pace, not just tolerate it briefly?', keys: ['bank', 'consult', 'startup', 'trading', 'sales', 'agency', 'emergency', 'news'] },
  { id: 'interpersonal', label: 'Interpersonal interaction', ask: 'How much of your day do you want to spend with other people?', keys: ['sales', 'health', 'teach', 'client', 'consult', 'recruit', 'social', 'nurs', 'therap', 'human resource'] },
  { id: 'stakeholder_conflict', label: 'Stakeholder and conflict management', ask: 'Will you enjoy resolving competing priorities between people who both want something different?', keys: ['product', 'manage', 'consult', 'operations', 'polic', 'law', 'project', 'account manage', 'partner'] },
  { id: 'research', label: 'Research', ask: 'Do you enjoy open-ended investigation without a guaranteed answer?', keys: ['research', 'analyst', 'academ', 'science', 'polic', 'strategy', 'data', 'invest'] },
  { id: 'writing', label: 'Writing', ask: 'Do you enjoy writing as a core part of the work, not an occasional task?', keys: ['writ', 'content', 'journal', 'polic', 'law', 'market', 'communicat', 'research', 'academ'] },
  { id: 'problem_solving', label: 'Problem solving', ask: 'Do you enjoy problems that stay unsolved for days?', keys: ['engineer', 'develop', 'product', 'consult', 'data', 'science', 'operations', 'technic'] },
  { id: 'attention_to_detail', label: 'Attention to detail', ask: 'Can you hold a high accuracy standard over long stretches?', keys: ['account', 'audit', 'law', 'bank', 'medic', 'engineer', 'compliance', 'edit', 'quality'] },
  { id: 'repetitive_tolerance', label: 'Tolerance for repetition', ask: 'How do you handle work that repeats itself day to day?', keys: ['bank', 'account', 'audit', 'operations', 'sales', 'compliance', 'clinic', 'process'] },
  { id: 'decision_making', label: 'Decision making', ask: 'Are you comfortable deciding with incomplete information?', keys: ['product', 'manage', 'founder', 'invest', 'strategy', 'lead', 'trading', 'entrepreneur', 'medic'] },
  { id: 'risk_tolerance', label: 'Risk tolerance', ask: 'How much financial and career uncertainty can you actually live with?', keys: ['founder', 'entrepreneur', 'startup', 'venture', 'freelance', 'creator', 'trading', 'invest', 'sales'] },
];

/** Variables that matter on almost any career, so they are never left unmodelled. */
const BASELINE_IDS = ['ambiguity_tolerance', 'communication', 'pace', 'problem_solving', 'decision_making'];

const RELEVANCE_WEIGHT = { high: 3, medium: 2, low: 1 };

/** Relevance of each variable to this specific career. */
function relevanceFor(variable, haystack) {
  const hits = variable.keys.filter(k => haystack.includes(k)).length;
  if (hits >= 2) return 'high';
  if (hits === 1) return 'medium';
  return BASELINE_IDS.includes(variable.id) ? 'medium' : 'low';
}

/**
 * What the student's onboarding answers already tell us about a variable.
 * Stated preferences are real evidence, but weak evidence: they are what the
 * student believes about themselves before doing the work.
 */
function statedTendency(variable, profile = {}) {
  const band = (n, low, high) => (n >= 4 ? high : n <= 2 ? low : null);
  const p = profile;
  switch (variable.id) {
    case 'autonomy':
      return band(p.priority_autonomy, 'Prefers clear direction', 'Wants to set their own direction');
    case 'structure':
      return band(p.priority_stability, 'Comfortable outside defined process', 'Prefers a defined process');
    case 'creativity':
      return band(p.priority_creativity, 'Prefers executing a clear brief', 'Drawn to original work');
    case 'leadership':
      return band(p.priority_ownership, 'Prefers owning their own work', 'Wants responsibility for others');
    case 'risk_tolerance':
      if (typeof p.willing_financial_risk !== 'boolean') return null;
      return p.willing_financial_risk ? 'Says they can carry financial risk' : 'Says they need financial security';
    case 'pace':
      if (typeof p.willing_long_hours !== 'boolean') return null;
      return p.willing_long_hours ? 'Says they can work long hours early on' : 'Wants sustainable hours';
    default:
      return null;
  }
}

/**
 * The uncertainty map for one career hypothesis.
 *
 * Pure. `act` is the path's own activity (completed experiments, proof,
 * reflections) as already computed by the hypothesis layer.
 */
export function deriveUncertaintyMap(path, { profile = {}, act = {} } = {}) {
  const haystack = [path.path_name, path.path_category, path.why_it_fits, path.fit_reason, path.description]
    .filter(Boolean).join(' ').toLowerCase();

  const completed = act.completedExps?.length || 0;
  const proofs = act.proof?.length || 0;
  const reflections = act.reflections?.length || 0;

  // Evidence earned by doing the work. Every term here is a count of something
  // the student produced, which is what keeps time out of this number.
  const earned = Math.min(completed * 18 + proofs * 14 + reflections * 10, 70);

  const variables = WORK_VARIABLES
    .map(v => {
      const relevance = relevanceFor(v, haystack);
      const tendency = statedTendency(v, profile);
      const sources = [];
      if (tendency) sources.push('Your onboarding answers');
      if (completed) sources.push('Your experiments');
      if (proofs) sources.push('Your proof of work');
      if (reflections) sources.push('Your reflections');

      const strength = clamp((tendency ? 25 : 0) + (relevance === 'low' ? earned * 0.5 : earned));
      return {
        variable: v.id,
        label: v.label,
        question: v.ask,
        relevance,
        evidence_strength: strength,
        tendency: tendency || null,
        tendency_confidence: tendency ? clamp(strength * 0.8) : 0,
        sources,
        needs_more_evidence: relevance !== 'low' && strength < 60,
      };
    })
    .filter(v => v.relevance !== 'low' || v.evidence_strength > 0);

  const rank = (v) => RELEVANCE_WEIGHT[v.relevance] * 100 - v.evidence_strength;
  const unknowns = variables.filter(v => v.needs_more_evidence).sort((a, b) => rank(b) - rank(a));

  return {
    variables: variables.sort((a, b) => rank(b) - rank(a)),
    known: variables.filter(v => v.evidence_strength >= 60),
    developing: variables.filter(v => v.evidence_strength >= 25 && v.evidence_strength < 60),
    untested: variables.filter(v => v.evidence_strength < 25),
    top_unknowns: unknowns.slice(0, 4),
    biggest_question: unknowns[0]?.question || null,
  };
}

/** The 2-4 highest-value unanswered questions, in the hypothesis panel's shape. */
export function uncertaintyQuestions(map) {
  return map.top_unknowns.map(v => ({
    question: v.question,
    why_it_matters: `${v.label} is ${v.relevance === 'high' ? 'especially important' : 'relevant'} on this path and is still ${v.evidence_strength < 25 ? 'untested' : 'only partly tested'}.`,
  }));
}