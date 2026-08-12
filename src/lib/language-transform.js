/**
 * Rewording one step's explanation for a language level, without touching what
 * the step requires.
 *
 * ## What is authoritative and what is display
 *
 * Authoritative, never sent back to the database and never rewritten here:
 * `step_number`, `done_when`, `proof_capture`, `artifact`, the outreach
 * requirement, the guide's deliverable, the evaluation criteria, deadlines.
 * Those are read straight off the MissionGuides record everywhere they appear.
 *
 * Display only: the step's title and its explanatory description. Those are the
 * two fields a level can change, and the change lives in a cache, not in the
 * record. So a failed rewrite, a stale cache, or a student switching level three
 * times in a row all end at the same place: the authoritative text.
 *
 * ## Balanced costs nothing
 *
 * Guides are already authored at Balanced, so that level returns the original
 * text with no model call at all. Only Plain and Industry ask a model, and the
 * answer is cached per level per content hash in localStorage, so re-reading a
 * step or coming back tomorrow is free and offline-safe.
 *
 * ## The validator is the safety rail
 *
 * A rewrite is rejected, and the original shown instead, if it is empty, absurdly
 * long (the shape of added requirements), drops to a stub, or introduces a link
 * the original did not have. Rejections are logged as content-free codes, the
 * same as every other generation in the app.
 */
import { base44 } from '@/api/base44Client';
import { PLAIN_PROSE_RULES, unwrapLLM } from '@/lib/llm';
import { generateValidated } from '@/lib/ai-generate';

const MODEL = 'gpt_5_mini';
const CACHE_PREFIX = 'ul:lang:v1:';

/** Stable, short, and content-derived, so edited source text invalidates itself. */
function hash(text) {
  let h = 5381;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const cacheKey = (level, source) => `${CACHE_PREFIX}${level}:${hash(source)}`;

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked storage is not a reason to fail the step.
  }
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const hasLink = (text) => /https?:\/\//i.test(text || '');

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    terms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          definition: { type: 'string' },
          why_it_matters: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['term', 'definition'],
      },
    },
  },
  required: ['title', 'description'],
};

const LEVEL_RULES = {
  plain: `Write for someone new to this field.
- Replace jargon with a plain description of the actual work. Keep the work itself exactly as demanding as it is.
- When an industry term genuinely matters, keep the term AND define it in the terms list. Do not delete it.
- Never imply the task is easy, quick, or optional.`,
  industry: `Write for someone already comfortable in this field.
- Use the terminology professionals in this field actually use, at normal density.
- Do not re-explain basics, and do not add complexity, extra scope, or invented technical detail to sound advanced.
- The task must stay identical in scope to the original.`,
};

function validate(raw, { title, description }) {
  const data = unwrapLLM(raw) || {};
  const outTitle = clean(data.title);
  const outDescription = clean(data.description);
  const codes = [];

  if (!outTitle) codes.push('title_missing');
  if (outTitle.length > 160) codes.push('title_too_long');
  if (!outDescription) codes.push('description_missing');
  // A rewrite that collapses to a fragment has dropped the instruction; one that
  // balloons has almost certainly added requirements of its own.
  if (outDescription && outDescription.length < Math.min(24, Math.floor(description.length * 0.35))) codes.push('description_too_short');
  if (outDescription.length > Math.max(600, description.length * 2.5 + 300)) codes.push('description_too_long');
  if (hasLink(outDescription) && !hasLink(description)) codes.push('link_added');

  const terms = (Array.isArray(data.terms) ? data.terms : [])
    .map(t => ({
      term: clean(t?.term).slice(0, 60),
      definition: clean(t?.definition).slice(0, 400),
      why_it_matters: clean(t?.why_it_matters).slice(0, 400) || undefined,
      example: clean(t?.example).slice(0, 400) || undefined,
    }))
    .filter(t => t.term && t.definition)
    .slice(0, 6);

  if (codes.length) return { ok: false, errors: codes.map(c => `Rejected: ${c}.`), codes };
  return { ok: true, data: { title: outTitle, description: outDescription, terms, source_title: title } };
}

/**
 * The step as the student should read it at this level.
 *
 * Always resolves. On any failure it returns the authoritative text with
 * `fallback: true`, so a step can never render blank because a rewrite failed.
 */
export async function describeStepAtLevel({ level, step, careerName, objective, context = {} }) {
  const title = clean(step?.title);
  const description = clean(step?.description);
  const original = { title, description, terms: [], level: 'balanced', fallback: false };

  if (level === 'balanced' || !LEVEL_RULES[level] || (!title && !description)) return original;

  const key = cacheKey(level, `${careerName || ''}|${title}|${description}`);
  const cached = readCache(key);
  if (cached) return { ...cached, level, fallback: false, cached: true };

  const prompt = `Reword one step of a career experiment for a student, at a specific language level.

CAREER FIELD: ${careerName || 'not specified'}
WHAT THE EXPERIMENT IS TESTING: ${objective || 'not specified'}

THE AUTHORITATIVE STEP (do not change what it requires):
Title: ${title}
Explanation: ${description}

LANGUAGE LEVEL: ${level}
${LEVEL_RULES[level]}

HARD RULES
- Preserve the meaning and the scope exactly. Same task, same effort.
- Do not add a requirement, a deliverable, a deadline, a tool, or a person to contact.
- Do not remove a requirement or soften what has to be produced.
- Do not invent facts about the industry, companies, numbers, or people.
- Do not mention proof, evidence, completion criteria, or evaluation. Those are handled elsewhere.
- Do not include links.
- Return the reworded title and explanation only, plus up to 4 field specific terms
  you used or replaced, each with a short student-facing definition, why it matters,
  and a one line example when useful.${PLAIN_PROSE_RULES}`;

  try {
    const result = await generateValidated({
      feature: 'language_transform',
      model: MODEL,
      attempts: 2,
      context: { path_id: context.path_id, experiment_id: context.experiment_id },
      call: (correction) => base44.integrations.Core.InvokeLLM({
        prompt: prompt + correction,
        response_json_schema: SCHEMA,
        model: MODEL,
      }),
      validate: (raw) => validate(raw, { title, description }),
    });

    if (!result?.ok || !result.data) return { ...original, fallback: true };
    const value = { title: result.data.title, description: result.data.description, terms: result.data.terms };
    writeCache(key, value);
    return { ...value, level, fallback: false };
  } catch {
    // Transport failure. Already logged by generateValidated.
    return { ...original, fallback: true };
  }
}

const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    term: { type: 'string' },
    definition: { type: 'string' },
    why_it_matters: { type: 'string' },
    example: { type: 'string' },
  },
  required: ['term', 'definition'],
};

/**
 * "What does this mean?" for a phrase inside the step the student is on.
 * Returns null rather than a guess when it cannot answer.
 */
export async function explainPhrase({ phrase, careerName, stepTitle, stepDescription }) {
  const asked = clean(phrase);
  if (!asked) return null;

  const key = `${CACHE_PREFIX}term:${hash(`${careerName || ''}|${asked}`)}`;
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt: `A student is part-way through a career experiment and asked what a phrase means.

CAREER FIELD: ${careerName || 'not specified'}
THE STEP THEY ARE ON: ${clean(stepTitle)}
${clean(stepDescription).slice(0, 600)}

THE PHRASE THEY ASKED ABOUT: ${asked}

Explain it for a student, in the context of this step. Keep the definition to two
sentences. Say why it matters in one sentence. Add a one line example only if it
helps. Do not invent specific numbers, companies, or facts. Do not add anything the
student now has to do.${PLAIN_PROSE_RULES}`,
      response_json_schema: EXPLAIN_SCHEMA,
      model: MODEL,
    });

    const data = unwrapLLM(raw) || {};
    const out = {
      term: clean(data.term) || asked,
      definition: clean(data.definition),
      why_it_matters: clean(data.why_it_matters) || undefined,
      example: clean(data.example) || undefined,
    };
    if (!out.definition) return null;
    writeCache(key, out);
    return out;
  } catch {
    return null;
  }
}