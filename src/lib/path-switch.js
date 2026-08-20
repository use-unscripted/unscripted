/**
 * Switching the path being tested changes the answer to "which hypothesis is
 * this?" on every screen in the product: the rail, Test, Prove, Decide, the
 * Decision Matrix, the Conviction Lab, the evidence views.
 *
 * All of those read cached queries, and each one caches under its own key — some
 * of them keyed on the PREVIOUS path's name, which no amount of per-key
 * invalidation from here can enumerate. So the switch drops the whole query
 * cache rather than guessing at a list. It is one moment, chosen deliberately by
 * the student, and everything they see afterwards must come from the new path.
 */
export async function resetCacheForPathSwitch(queryClient) {
  if (!queryClient) return;
  // Anything mounted refetches immediately; everything else is marked stale so
  // it refetches the next time a screen asks for it.
  await queryClient.invalidateQueries();
}