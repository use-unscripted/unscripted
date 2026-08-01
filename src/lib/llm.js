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
