/**
 * Shared helpers for `base44.integrations.Core.InvokeLLM`.
 *
 * ## Why every call site pins `model` explicitly
 *
 * With `model` omitted, every call rides the app-level default set in the Base44
 * editor UI. That default is not in `config.jsonc`, is invisible from the CLI and
 * from this repo, and can be changed by anyone with editor access with no code
 * change and no review. The cold outreach emails students send to real
 * professionals were running on it.
 *
 * So each call site now passes a literal model id. Literal, not a constant from
 * this file, on purpose: `grep -rn "model:" src` should show exactly which model
 * answers which prompt without a second lookup.
 *
 * ## The return-shape trap
 *
 * `InvokeLLM` with `response_json_schema` does not always return the schema
 * object at the top level — some models come back wrapped as
 * `{ response: {...} }` instead. Every call site in this app reads the bare shape
 * (`result.path_recommendations`, `result.risk_level`, …), so a wrapped reply
 * reads as `undefined` everywhere: no error, no exception, just empty output that
 * looks exactly like a model that refused to answer. That already shipped once —
 * the campus-events ranking pinned a wrapping model, returned nothing every time,
 * and was indistinguishable from "your campus has no events."
 *
 * Measured against the live app on 2026-07-31, identical prompt and schema,
 * 3 reps each on both a flat and a nested schema:
 *
 *   (model omitted — the app default)  bare
 *   gpt_5_mini                          bare
 *   gemini_3_flash                      bare
 *   gpt_5_4                             bare
 *   gpt_5_5                             bare
 *   gemini_3_1_pro                      bare
 *   claude_sonnet_4_6                   WRAPPED  ← the only one, but reliably so
 *   claude_opus_4_6                     bare
 *   claude_opus_4_7                     bare
 *   claude_opus_4_8                     bare
 *
 * The models pinned in this app are all `bare`, so `unwrapLLM` is a no-op today.
 * It is applied anyway at every structured call site: it costs nothing, and it is
 * what makes changing a pinned model later a safe edit instead of a silent
 * outage. Do not remove it, and do not pin `claude_sonnet_4_6` without it.
 */

/**
 * House style for every prompt that produces prose a student reads.
 *
 * Left to itself a model writes in the register everyone now recognises as
 * machine-written: em dashes in every other sentence, "it's not just X, it's Y",
 * three-item lists whether or not there are three things, and a closing line
 * about the exciting road ahead. On this product that register is expensive
 * twice over. Students paste these words into cold emails to real
 * professionals, and an obviously-generated email is a dead lead. And the guide
 * is our stated differentiator, so it cannot read like the free output of the
 * chatbot the student already has.
 *
 * Append this to any prompt whose output reaches a person. Skip it on prompts
 * that only return structured data with no sentences in it.
 */
export const PLAIN_PROSE_RULES = `

## How to write

Write like a competent person, not like an AI assistant.

- Never use an em dash (—) or an en dash (–). Use a period, a comma, a colon, or
  brackets instead. A hyphen between numbers in a range is fine.
- Straight quotes and apostrophes only. No curly ones. No emoji.
- Start with the point. No scene-setting windup, no "In today's world", no
  restating the question before answering it.
- Do not use: delve, navigate (figurative), leverage (verb), robust, vibrant,
  crucial, pivotal, seamless, testament, tapestry, landscape (figurative),
  underscore, showcase, foster, elevate, unlock, empower, journey (figurative).
- Do not write "not just X, but Y", "not only X but also Y", or any variation.
- Do not pad a list to three items to sound complete. Say however many there are.
- Do not end on encouragement, a summary, or a line about what comes next. Stop
  at the last concrete thing you have to say.
- Prefer "is" and "has" to "serves as", "stands as", "represents" and "boasts".
- Vary sentence length. Do not stack short dramatic fragments.`;

/**
 * Return the payload the caller's schema described, whether or not the model
 * wrapped it in `{ response: ... }`.
 *
 * Only unwraps a plain object under `response`. An array or a primitive there is
 * far more likely to be a real field a schema asked for than a model's wrapper,
 * so it is left alone. Non-object results (a bare string, from a call with no
 * `response_json_schema`) pass through untouched.
 */
export function unwrapLLM(result) {
  if (!result || typeof result !== 'object') return result;
  const inner = result.response;
  return inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : result;
}
