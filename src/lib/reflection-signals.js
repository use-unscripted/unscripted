/**
 * Written reflections as structured evidence.
 *
 * A reflection is text, and text is the weakest kind of evidence in this system,
 * so this module is deliberately conservative. It only extracts a signal when a
 * work characteristic AND a clear feeling about it appear in the same clause —
 * "I liked figuring out the strategy, but hated presenting it" produces two
 * separate signals, while "it was a long week" produces none.
 *
 * What it will never do is draw a psychological conclusion. The output is the
 * same shape as a measurement-derived characteristic signal, at self-report
 * quality, so it joins the existing evidence weighting rather than bypassing it.
 */
import { evidenceSource } from '@/lib/evidence-graph';
import { WORK_VARIABLES } from '@/lib/uncertainty-model';

/** Phrases that clearly point at a work characteristic we already model. */
const CHARACTERISTIC_PHRASES = {
  ambiguity_tolerance: ['ambigu', 'not one obvious answer', 'no obvious answer', 'no right answer', 'open ended', 'open-ended', 'unclear', 'undefined', 'figure out what', 'vague'],
  analytical_intensity: ['analys', 'analyz', 'analytic', 'digging into the data', 'breaking down the problem'],
  quantitative_work: ['number', 'model', 'spreadsheet', 'excel', 'financial model', 'quantitative', 'math', 'valuation', 'calculat'],
  creativity: ['creative', 'design', 'original idea', 'from scratch', 'brainstorm', 'coming up with ideas'],
  persuasion: ['persuad', 'convinc', 'pitch', 'selling', 'sales call', 'cold outreach', 'cold email'],
  communication: ['present', 'presentation', 'explain', 'communicat', 'speaking', 'talking through'],
  teamwork: ['team', 'group work', 'collaborat', 'with other people', 'working with others', 'partner'],
  independent_work: ['on my own', 'by myself', 'alone', 'solo', 'independent'],
  leadership: ['lead', 'leading', 'manag', 'in charge', 'delegat'],
  autonomy: ['my own direction', 'own decisions', 'nobody telling me', 'freedom to', 'autonom'],
  structure: ['structure', 'process', 'checklist', 'template', 'clear steps', 'framework'],
  pace: ['fast paced', 'fast-paced', 'deadline', 'rushed', 'intense', 'time pressure', 'long hours'],
  interpersonal: ['interview', 'talking to people', 'client', 'meeting people', 'networking', 'conversation with'],
  stakeholder_conflict: ['stakeholder', 'competing priorities', 'disagree', 'conflict', 'push back', 'pushback'],
  research: ['research', 'reading up', 'investigat', 'looking into'],
  writing: ['writing', 'wrote', 'write up', 'draft', 'memo', 'essay'],
  problem_solving: ['problem solving', 'problem-solving', 'solving', 'puzzle', 'figuring out how'],
  attention_to_detail: ['detail', 'accuracy', 'precise', 'double check', 'double-check', 'proofread'],
  repetitive_tolerance: ['repetitive', 'over and over', 'same thing again', 'tedious', 'monotonous'],
  decision_making: ['deciding', 'decision', 'prioritis', 'prioritiz', 'trade off', 'trade-off', 'tradeoff'],
  risk_tolerance: ['risk', 'uncertain income', 'no safety net', 'financial risk'],
};

const POSITIVE = ['enjoyed', 'enjoy', 'liked', 'like', 'loved', 'love', 'favorite', 'favourite', 'fun', 'energis', 'energiz', 'excited', 'exciting', 'interesting', 'satisfying', 'rewarding', 'best part', 'good at', 'came easily', 'want to do more', 'would do again'];
const NEGATIVE = ['hated', 'hate', 'disliked', 'dislike', 'boring', 'bored', 'drain', 'exhaust', 'frustrat', 'tedious', 'dreaded', 'dread', 'anxious', 'stressful', 'worst part', 'struggled', 'not for me', 'never again', "didn't enjoy", 'did not enjoy', "didn't like", 'did not like'];

/** Words that mark a corrected expectation, which we record as belief change. */
const BELIEF = ['thought it would', 'thought i would', 'expected', 'assumed', 'surprised', 'turned out', 'i was wrong', 'did not expect', "didn't expect"];

/** The reflection fields we read, and what each one already implies. */
const FIELDS = [
  { field: 'energy_sources', bias: 'positive', label: 'what gave you energy' },
  { field: 'energy_drains', bias: 'negative', label: 'what drained you' },
  { field: 'lessons', bias: null, label: 'what you learned' },
  { field: 'surprises', bias: null, label: 'what surprised you' },
  { field: 'assumptions_changed', bias: null, label: 'what changed your mind' },
  { field: 'supporting_evidence', bias: null, label: 'the evidence you cited' },
  { field: 'path_feedback', bias: null, label: 'how your interest changed' },
];

const hasAny = (text, list) => list.some(w => text.includes(w));

/** Split into clauses, so "liked X but hated Y" cannot become one verdict. */
const clauses = (text) => String(text || '')
  .toLowerCase()
  .split(/[.;!?\n]|,\s*(?:but|although|though|however|whereas|and)\s+|\s+(?:but|although|though|however|whereas)\s+/)
  .map(c => c.trim())
  .filter(Boolean);

const variableFor = (id) => WORK_VARIABLES.find(v => v.id === id);

/**
 * Structured signals from one reflection.
 * Each entry names the characteristic, the direction, and the student's own
 * words that produced it, so nothing is asserted without a quotable source.
 */
export function extractReflectionSignals(reflection) {
  if (!reflection) return [];
  const out = [];
  const seen = new Set();

  FIELDS.forEach(({ field, bias, label }) => {
    clauses(reflection[field]).forEach(clause => {
      const positive = hasAny(clause, POSITIVE);
      const negative = hasAny(clause, NEGATIVE);
      // A clause pulling both ways says nothing clear enough to use.
      if (positive && negative) return;
      const polarity = positive ? 'positive' : negative ? 'negative' : bias;
      if (!polarity) return;

      Object.entries(CHARACTERISTIC_PHRASES).forEach(([id, phrases]) => {
        if (!phrases.some(p => clause.includes(p))) return;
        const key = `${id}:${polarity}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          id,
          label: variableFor(id)?.label || id,
          polarity,
          field,
          field_label: label,
          quote: clause.length > 140 ? `${clause.slice(0, 137)}...` : clause,
          belief_correction: hasAny(clause, BELIEF),
          reflection_id: reflection.id,
          date: reflection.created_date,
          path_name: reflection.path_name || null,
          experiment_id: reflection.experiment_id || null,
        });
      });
    });
  });

  return out;
}

/**
 * Reflection extractions in the same shape characteristicSignals produces, so
 * they can be merged into the existing evidence weighting. Reflection readings
 * sit closer to neutral than a measured rating on purpose: written text is a
 * weaker instrument than a scored check-in.
 */
export function reflectionCharacteristicSignals(reflections = []) {
  const byId = new Map();
  reflections.forEach(r => {
    extractReflectionSignals(r).forEach(x => {
      if (!byId.has(x.id)) {
        byId.set(x.id, { id: x.id, label: x.label, enjoyment: [], energy: [], desire: [], frustration: [], sources: [], experiments: [], extractions: [] });
      }
      const b = byId.get(x.id);
      const reading = x.polarity === 'positive' ? 7.5 : 3.5;
      b.enjoyment.push(reading);
      b.energy.push(reading);
      b.extractions.push(x);
      b.sources.push(evidenceSource({
        kind: 'reflection',
        detail: `You wrote about ${x.label.toLowerCase()} in ${x.field_label}: "${x.quote}"`,
        date: x.date,
        link: '/evidence?tab=reflect',
        nodeId: `reflection:${x.reflection_id}`,
      }));
    });
  });
  return [...byId.values()];
}

export default extractReflectionSignals;