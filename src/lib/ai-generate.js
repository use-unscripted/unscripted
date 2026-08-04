/**
 * Ask a model, check the answer, and hand the reasons back on a retry.
 *
 * The model never sees its own previous output, so "that was wrong" is useless
 * to it. What works is the specific instruction: the validator's rejection
 * reasons, written as things to fix, appended to the same prompt. That is what
 * path generation and the Mission Guide validator already do, and this is the
 * same loop factored out so every generation in the app gets it.
 *
 * Nothing is written to the database between attempts. A rejected response
 * costs one more model call and nothing else, which is the whole reason to
 * validate before the first save rather than after it.
 *
 * ## What lands in the failure log
 *
 * Every rejection, including ones a retry then fixed. Those are the valuable
 * rows: a model that fails once and recovers is drifting, and the student never
 * sees it, so nothing else in the product would ever tell us. They are marked
 * `recovered` so triage can separate "this is degrading" from "this broke".
 *
 * Only slugs are logged. See ai-failures.js.
 */
import { reportAiFailure } from '@/lib/ai-failures';

const MAX_REPORTED_PROBLEMS = 8;

/** Turn rejection reasons into an instruction the model can act on. */
export function buildCorrection(errors = []) {
  const listed = errors.slice(0, MAX_REPORTED_PROBLEMS);
  if (!listed.length) return '';
  return `\n\nYour previous attempt was rejected for these reasons:\n${
    listed.map(e => `- ${e}`).join('\n')
  }\nFix every one of them.`;
}

/**
 * @param {object} opts
 * @param {string} opts.feature one of AI_FEATURES, for the log
 * @param {string} opts.model the pinned model id, for the log
 * @param {(correction: string) => Promise<any>} opts.call makes the model call
 * @param {(raw: any) => {ok: boolean, data?: any, errors?: string[], codes?: string[]}} opts.validate
 * @param {number} [opts.attempts] total model calls allowed, including retries
 * @param {object} [opts.context] { path_id, experiment_id } for the log
 * @param {(warnings: string[]) => void} [opts.onWarnings] called per attempt
 *
 * @returns {Promise<{ok: boolean, data: any, errors: string[], codes: string[], attempts: number}>}
 *   Resolves with `ok: false` when every attempt was rejected. Rejects only if
 *   the model call itself threw, and records that before rethrowing. A
 *   validator that throws is caught and treated as a rejection, so a bug in a
 *   validator cannot escape as an unexplained failure with no row behind it.
 */
export async function generateValidated({
  feature,
  model,
  call,
  validate,
  attempts = 2,
  context = {},
  onWarnings,
}) {
  const rejected = [];
  let result = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let raw;
    try {
      raw = await call(attempt === 1 ? '' : buildCorrection(result?.errors));
    } catch (e) {
      // A transport or provider failure. Distinct from a bad answer, and the
      // distinction is the reason to record a stage at all.
      await reportAiFailure(feature, {
        stage: 'invoke_llm',
        attempts: attempt,
        model,
        ...context,
      });
      throw e;
    }

    try {
      result = validate(raw) || { ok: false, errors: [], codes: ['validator_returned_nothing'] };
    } catch {
      // A validator that throws is our bug, not the model's, and it must not
      // escape as an unexplained rejection with no row behind it.
      result = { ok: false, errors: [], codes: ['validator_threw'] };
    }

    if (onWarnings && result.warnings?.length) onWarnings(result.warnings);

    if (result.ok) {
      // Record the attempts that failed on the way here. The student saw none
      // of this, which is exactly why it needs a row. Not awaited: this is the
      // path where everything worked and the student is watching a spinner, so
      // they must never wait on bookkeeping.
      for (const codes of rejected) {
        reportAiFailure(feature, {
          stage: 'validate',
          codes,
          attempts: attempt,
          recovered: true,
          model,
          ...context,
        });
      }
      return { ...result, attempts: attempt };
    }

    rejected.push(result.codes || []);
  }

  // Every attempt's codes, de-duplicated. Keeping only the last one hid the
  // case where a retry failed differently, which is the shape that says a model
  // is getting worse rather than being unlucky once.
  const allCodes = [...new Set([...rejected.flat(), ...(result?.codes || [])])];

  await reportAiFailure(feature, {
    stage: 'validate',
    codes: allCodes,
    attempts,
    recovered: false,
    model,
    ...context,
  });

  return { ...result, attempts };
}
