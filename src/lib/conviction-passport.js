/**
 * The Career Conviction Passport: a written summary of HOW a student reached a
 * decision about one path, available once that path is Decision Ready.
 *
 * The wording is generated from the Conviction Review, which is itself built
 * only from records the student produced. Two rules hold here:
 *   - the passport summarises how the decision was reached, and never claims the
 *     career is the correct one
 *   - nothing is final until the student approves it. A generated passport is
 *     saved as a draft and stays a draft until they say so.
 */
import { base44 } from '@/api/base44Client';

const line = (x) => (x ? `${x.text}${x.source ? ` (source: ${x.source})` : ''}` : 'nothing recorded');

const SCHEMA = {
  type: 'object',
  properties: {
    how_you_decided: { type: 'string' },
    what_you_know: { type: 'string' },
    what_remains_uncertain: { type: 'string' },
    strongest_support: { type: 'string' },
    strongest_contradiction: { type: 'string' },
    biggest_change: { type: 'string' },
    tradeoffs_accepted: { type: 'string' },
    what_could_change_your_mind: { type: 'string' },
  },
  required: ['how_you_decided', 'what_you_know', 'what_remains_uncertain'],
};

export const PASSPORT_FIELDS = [
  { id: 'how_you_decided', label: 'How you reached this decision' },
  { id: 'what_you_know', label: 'What you know' },
  { id: 'what_remains_uncertain', label: 'What is still uncertain' },
  { id: 'strongest_support', label: 'Strongest evidence for' },
  { id: 'strongest_contradiction', label: 'Strongest evidence against' },
  { id: 'biggest_change', label: 'The biggest assumption that changed' },
  { id: 'tradeoffs_accepted', label: 'The tradeoffs you have faced' },
  { id: 'what_could_change_your_mind', label: 'What could still change your mind' },
];

/** The most recent passport on file for a path, whatever its status. */
export async function loadPassport(pathId) {
  const rows = await base44.entities.CareerConvictionPassport
    .filter({ path_id: pathId }, '-created_date', 5)
    .catch(() => []);
  return (Array.isArray(rows) ? rows : []).find(r => r.status !== 'discarded') || null;
}

/**
 * Generate a draft passport from the review. Saves it as a DRAFT — never as
 * final. `existingId` rewrites an unapproved draft rather than piling up rows.
 */
export async function generatePassport({ path, review, existingId = null }) {
  const prompt = [
    'You are writing a "Career Conviction Passport" for a student who has tested a career path with real work.',
    'Summarise ONLY how they reached their decision, using the evidence below. Do not predict success, do not say the career is right or wrong for them, and do not add facts that are not listed here.',
    'Write in second person, plain language, two or three sentences per field. Do not use em-dashes.',
    `Path: ${path.path_name}`,
    `Decision readiness: ${review.readiness?.label}`,
    `Evidence basis: ${review.basis.experiments} completed tests, ${review.basis.checkIns} post-test check-ins, ${review.basis.dimensionsRead} of ${review.basis.dimensionsTotal} key dimensions read.`,
    `What they know: ${review.known.map(line).join(' | ') || 'nothing recorded'}`,
    `What they do not know: ${review.unknown.map(u => u.text).join(' | ') || 'nothing outstanding recorded'}`,
    `Strongest supporting evidence: ${line(review.support)}`,
    `Strongest contradicting evidence: ${line(review.against)}`,
    `Biggest assumption that changed, in their own words: ${review.changedAssumption || 'nothing recorded'}`,
    `Important tradeoffs: ${review.tradeoffs.map(t => `${t.label} (${t.status})`).join(' | ') || 'none recorded'}`,
    `What could still change their mind: ${review.mindChangers.join(' | ') || 'nothing recorded'}`,
  ].join('\n');

  const out = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });

  const fields = {
    path_id: path.id,
    path_name: path.path_name,
    readiness_state: review.readiness?.label || '',
    status: 'draft',
    how_you_decided: out.how_you_decided || '',
    what_you_know: out.what_you_know || '',
    what_remains_uncertain: out.what_remains_uncertain || '',
    strongest_support: out.strongest_support || '',
    strongest_contradiction: out.strongest_contradiction || '',
    biggest_change: out.biggest_change || '',
    tradeoffs_accepted: out.tradeoffs_accepted || '',
    what_could_change_your_mind: out.what_could_change_your_mind || '',
    evidence_basis: review.basis,
    generated_at: new Date().toISOString(),
  };

  return existingId
    ? base44.entities.CareerConvictionPassport.update(existingId, fields)
    : base44.entities.CareerConvictionPassport.create(fields);
}

/** The student's approval is what makes it final. */
export const approvePassport = (id) =>
  base44.entities.CareerConvictionPassport.update(id, {
    status: 'approved',
    approved_at: new Date().toISOString(),
  });

export const discardPassport = (id) =>
  base44.entities.CareerConvictionPassport.update(id, { status: 'discarded' });