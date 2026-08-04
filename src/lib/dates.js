/**
 * The real file is base44/shared/dates.js.
 *
 * A backend function upload carries its own directory plus base44/shared/ and
 * nothing else, so anything a Deno function imports has to live there. This
 * line keeps the frontend and the tests working unchanged. The tests stay in
 * src/lib on purpose: a test file in base44/shared would be uploaded with
 * every backend function, campusEvents and the purge job included.
 */
export * from '../../base44/shared/dates.js';
