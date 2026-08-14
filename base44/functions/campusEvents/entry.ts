/**
 * campusEvents — real upcoming events at the student's own campus.
 *
 * Every event returned by this function came out of the school's own calendar
 * feed. Nothing here is model-authored. That is the whole point: a guide that
 * invents a panel in a room that does not exist sends a student to an empty
 * building, and there is no recovering the trust after that.
 *
 * The model is used for exactly one thing — guessing a school's web domain from
 * the free text a student typed. That guess is then VERIFIED by probing the
 * actual endpoint, so a hallucinated domain fails to resolve instead of
 * producing fake events.
 *
 * Four calendar platforms are supported, probed in this order: Localist
 * (Concept3D), LiveWhale, Campus Labs Engage, and Trumba. A sweep of 24
 * Northeast schools found no single platform covers even half of them —
 * Localist alone reaches ~40%. Each adapter owns its own probe, fetch, and
 * normalize, and they all converge on one event shape so nothing downstream
 * has to know which platform a school runs.
 *
 * Nothing about a school is assumed from its domain. Subdomain conventions are
 * inconsistent (Villanova's LiveWhale is on calendar., not events.), a host
 * that answers can still be the wrong thing (events.villanova.edu is a plain
 * web page), and Trumba slugs are not derivable at all. So every probe parses
 * the JSON and checks its shape; a 200, a redirect, and a reachable host prove
 * nothing on their own.
 *
 * A school on none of them used to return zero events, and this file used to
 * say that was the correct outcome rather than a gap to paper over with
 * scraping. That has been reversed deliberately, on evidence, and the reasoning
 * matters more than the conclusion.
 *
 * The objection to scraping was never that reading a page is beneath us. It was
 * that a scraped event might be invented, and an invented event sends a student
 * to an empty building. That objection is answered by proof rather than by
 * abstinence: every event read off a page is checked back against that page's
 * own text, and nothing is stored whose title and date are not both found
 * there. Measured over 178 schools, 598 of 598 titles came back word for word.
 *
 * What changed the answer is that "no feed" turned out to describe most of the
 * schools we cannot read. A fingerprint of all 1,124 of them says there is no
 * adapter left worth writing, so refusing to read pages was not holding a line
 * on quality. It was declining to serve about a third of US colleges.
 *
 * See the `scraped` adapter below. It never renders a page and never calls a
 * model at request time: a scheduled job does that offline and stores the
 * result, and the adapter only reads it.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 45;
const MAX_DAYS = 120;
const FEED_PAGE_SIZE = 100; // Localist's per-page ceiling
const PROBE_TIMEOUT_MS = 6000;
/** Once a host has answered as a calendar it is no longer a guess — see probeJson. */
const PROBE_BODY_TIMEOUT_MS = 12000;
const FEED_TIMEOUT_MS = 9000;

/** Villanova and Tufts answer a bare Deno UA with 403; they serve a browser fine. */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Re-probe a school that previously came back with no feed, but not often. */
const NEGATIVE_RECHECK_DAYS = 30;

/**
 * The domain we probe is produced by our own model, not by the caller, and we
 * only ever prepend a fixed subdomain to it. This still gates it: no IPs, no
 * internal names, and a TLD a real school actually uses.
 */
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const ALLOWED_TLDS = ['edu', 'ca', 'uk', 'au', 'nz', 'ie', 'org', 'net', 'com'];
/**
 * Names that must never be fetched server-side — matched by host LABEL, never by
 * substring.
 *
 * Substring matching refused far more than it meant to. Every Localist host
 * contains ".local" inside ".localist.com", so the link-local guard was quietly
 * rejecting one of the largest calendar platforms we support: a school whose own
 * /events redirects onto <slug>.enterprise.localist.com read as a school with no
 * calendar, and nothing anywhere said why.
 *
 * What is refused is unchanged — link-local and internal names, and the cloud
 * metadata endpoint. They are now refused because of what they are named rather
 * than because a real hostname happened to contain those letters. This sits
 * behind ALLOWED_TLDS, which already excludes every one of these suffixes; it is
 * kept as defence in depth, so it must be exactly as strict and no wider.
 */
const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.lan', '.localdomain'];
const BLOCKED_HOST_LABELS = ['localhost', 'metadata'];

export function isBlockedHost(domain: string): boolean {
  const host = String(domain || '').toLowerCase();
  if (BLOCKED_HOST_SUFFIXES.some(suffix => host === suffix.slice(1) || host.endsWith(suffix))) {
    return true;
  }
  return host.split('.').some(label => BLOCKED_HOST_LABELS.includes(label));
}

const SUBDOMAIN_CANDIDATES = ['events', 'calendar', 'calendars'];

// ── Text helpers ────────────────────────────────────────────────────────────

/**
 * U+00A0 through U+00FF in entity-name order. Campus content is full of these
 * — "Caf&eacute; Democracy" is a real Rutgers listing — and a student reading
 * "Caf&eacute;" in a guide has been shown the CMS's plumbing.
 */
const LATIN1_ENTITY_NAMES = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml ' +
  'Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times ' +
  'Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml ' +
  'igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide ' +
  'oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ');

/** Case-sensitive: &Eacute; and &eacute; are different letters. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', bull: '•', trade: '™', euro: '€',
  ...Object.fromEntries(
    LATIN1_ENTITY_NAMES.map((name, i) => [name, String.fromCharCode(0xa0 + i)]),
  ),
};

/** One pass. Anything it does not recognize is left exactly as it was found. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X'
        ? parseInt(ref.slice(2), 16)
        : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[ref] ?? match;
  });
}

/**
 * Every platform but Localist hands back HTML — sometimes a full `<p><a href>`
 * blob in a field as innocuous as `location`, sometimes entity-encoded text in
 * the title itself ("Women&#39;s Soccer"). None of it can reach a student.
 *
 * Tags come off before entities are decoded, and decoding runs exactly once.
 * The other order would turn a literal "&lt;script&gt;" into a live tag, and a
 * second pass would delete the "< 5%" that a first pass just produced —
 * stripping tags after decoding cannot tell prose from markup.
 */
export function plainText(value: unknown): string {
  if (value == null) return '';
  const stripped = String(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

/**
 * A link is not prose: stripping tags or collapsing whitespace would corrupt
 * it. Entities still have to go — LiveWhale stores external links HTML-escaped
 * ("...detail&amp;id=99955"), and a browser sent that reads the query
 * parameter as "amp;id" and lands on the wrong page.
 */
function cleanUrl(value: unknown): string {
  if (value == null) return '';
  return decodeEntities(String(value)).trim();
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'your',
  'you', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'like',
  'want', 'more', 'most', 'very', 'really', 'some', 'any', 'all', 'not', 'but',
  'out', 'get', 'got', 'how', 'what', 'when', 'where', 'who', 'why', 'can',
  'just', 'also', 'been', 'being', 'over', 'than', 'then', 'them', 'they',
  'work', 'working', 'job', 'jobs', 'career', 'careers', 'field', 'industry',
  'people', 'person', 'thing', 'things', 'love', 'enjoy', 'interested',
  'interest', 'interests', 'maybe', 'something', 'someone', 'college',
  'university', 'student', 'students', 'major', 'minor', 'degree', 'study',
  'studying', 'learn', 'learning', 'good', 'great', 'best', 'better', 'new',
]);

export function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|of|at)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Interest terms worth matching on — long enough to mean something. */
export function termsFrom(...sources: unknown[]): string[] {
  const seen = new Set<string>();
  for (const source of sources) {
    const flat = Array.isArray(source) ? source.join(' ') : source;
    if (typeof flat !== 'string') continue;
    for (const raw of flat.toLowerCase().split(/[^a-z0-9+#]+/)) {
      const word = raw.trim();
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      seen.add(word);
    }
  }
  return [...seen];
}

// ── Domain resolution ───────────────────────────────────────────────────────

export function isProbeableDomain(domain: string): boolean {
  if (!domain || domain.length > 100) return false;
  if (!DOMAIN_RE.test(domain)) return false;
  if (/^\d+\./.test(domain)) return false; // bare IP
  if (isBlockedHost(domain)) return false;
  const tld = domain.split('.').pop() || '';
  return ALLOWED_TLDS.includes(tld);
}

function stripWww(domain: string): string {
  return domain.replace(/^www\./, '');
}

/** "fairfield.edu" -> "fairfield". Trumba and Campus Labs key off this label. */
function domainLabel(domain: string): string {
  return domain.split('.')[0] || '';
}

// ── Adapter plumbing ────────────────────────────────────────────────────────

/**
 * One calendar platform. `probe` verifies a school actually runs this platform
 * and returns the URL to remember; `fetch` turns that URL back into raw
 * platform events; `normalize` flattens one of those into the shared shape.
 *
 * The split matters because the URL is all we persist. A school is probed once
 * ever, and every later request goes straight from stored URL to fetch.
 */
interface Adapter {
  name: string;
  probe(domain: string): Promise<string | null>;
  // `seriesDates` is how many dates one repeating event contributes. Only iCal
  // carries repeat rules — every other platform's feed hands us dated instances
  // already — so the rest of the adapters take it and have nothing to do.
  //
  // `store` is the same shape of argument for the one adapter that reads rows
  // instead of making a request. Every other adapter ignores it, and the
  // scraped one returns nothing without it rather than throwing, so a caller
  // that does not pass it degrades to "this school has no events".
  // deno-lint-ignore no-explicit-any
  fetch(feedUrl: string, days: number, seriesDates?: number, store?: any): Promise<any[]>;
  // deno-lint-ignore no-explicit-any
  normalize(raw: any, feedUrl: string): NormalizedEvent;
}

// ── Redirects, when the URL came from the caller ────────────────────────────

/**
 * Answers "may we fetch this?" for one URL. Null means don't ask — follow
 * redirects the way the rest of this function always has.
 */
type HopGuard = ((url: string) => boolean) | null;

/** A redirect chain is still a chain of requests we chose to make. */
const MAX_REDIRECT_HOPS = 5;

/**
 * fetch(), but a guarded URL is re-checked at every hop.
 *
 * `redirect: 'follow'` hands the destination to whoever answers, which is fine
 * everywhere the URL is one we built ourselves. It is not fine for a URL a
 * student pasted: checking only the first URL makes every rule in
 * checkSubmittedUrl one-shot, and an open redirect on the school's own domain
 * — .edu sites are full of them, every proxy login and share link is one —
 * turns "the school's own site" into "anywhere", including hosts and ports the
 * check refuses outright. The body then comes back to the student as a
 * calendar, so it is not even blind.
 *
 * So for those, redirects are followed manually and every destination has to
 * pass the same gate the pasted URL did.
 */
async function guardedFetch(
  url: string,
  init: RequestInit,
  guard: HopGuard,
): Promise<Response> {
  if (!guard) return await fetch(url, { ...init, redirect: 'follow' });

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) return res;

    await res.body?.cancel().catch(() => {});

    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch (_) {
      throw new Error('Calendar feed redirected somewhere unreadable');
    }
    if (!guard(next)) throw new Error('Calendar feed redirected off the school');
    current = next;
  }
  throw new Error('Calendar feed redirected too many times');
}

/** GET a candidate URL and hand back parsed JSON, or null for anything else. */
async function probeJson(
  url: string,
  guard: HopGuard = null,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  // Two budgets, because a probe is answering two different questions and only
  // the first one is a guess.
  //
  // Until the headers arrive, the host is a guess — mostly a subdomain that does
  // not exist — and the tight budget is what stops a school with no calendar
  // spending a student's whole request on dead hosts.
  //
  // Once a host has answered 200 with a JSON content type, it is not a guess any
  // more: it is a calendar, and the only question left is how big. Holding it to
  // the guess budget silently punished exactly the schools with the most events.
  // Florida Tech publishes 558 future events and Texas A&M publishes 1,000; both
  // are near a megabyte, both took longer than the guess budget under load, and
  // both were recorded nationally as schools with no calendar at all. A large
  // calendar reading as an absent one is the worst direction for this to fail in.
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await guardedFetch(url, {
      headers: { Accept: 'application/json', ...extraHeaders },
      signal: controller.signal,
    }, guard);
    // An unread body holds the connection open; these probes lose far more often
    // than they win, so the losers have to be closed explicitly.
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), PROBE_BODY_TIMEOUT_MS);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try every candidate host at once but answer in the caller's preference order.
 *
 * Sequentially this is up to eight 6s timeouts per domain and three domains per
 * student, which blows the function's own request budget on any school that
 * runs no calendar at all. The extra requests are public unauthenticated GETs
 * to hosts that mostly do not resolve.
 */
async function firstValidUrl(
  candidates: string[],
  isValid: (payload: unknown) => boolean,
  extraHeaders: Record<string, string> = {},
): Promise<string | null> {
  // Every request starts now, but they are read back in preference order, so
  // the first candidate answering in 40ms returns in 40ms instead of waiting
  // out a 6s timeout on a sibling subdomain that does not exist. Losing
  // probes are already caught, so nothing is left unhandled.
  const attempts = candidates.map(async (url) => {
    try {
      return isValid(await probeJson(url, null, extraHeaders));
    } catch (_) {
      return false; // Unreachable, timed out, or not JSON.
    }
  });
  for (let i = 0; i < attempts.length; i++) {
    if (await attempts[i]) return candidates[i];
  }
  return null;
}

/**
 * Trumba and Campus Labs have no server-side date window, so it is applied
 * here. Every platform then answers the same question the caller asked, and a
 * student planning 45 days out is not shown a concert in April.
 */
function withinWindow(start: string, days: number): boolean {
  const at = new Date(start).getTime();
  return Number.isFinite(at) && at <= Date.now() + days * 86400000;
}

/** A started timed event is still worth offering for an hour. */
const STARTED_GRACE_MS = 3600000;
/** An all-day event is worth offering until its day is over. */
const WHOLE_DAY_MS = 86400000;

/** "2026-08-03" with nothing after it. There is no clock anywhere in that. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Is this event still ahead of the student?
 *
 * A timed event carries a real clock, so "started an hour ago" is the line. An
 * all-day event has no clock at all: it names a whole day, and it is upcoming
 * until the END of that day, not until the start of it. Reading a bare day as
 * an instant is what told a weekly all-day club it met next Tuesday on the
 * Tuesday it was actually running.
 *
 * ## What "the end of its day" means here, and what it costs
 *
 * 24 hours after whatever instant the start value parses to — never end-of-day
 * in a named zone. A `VALUE=DATE` value carries no zone, and this file's rule
 * everywhere else is to refuse rather than guess one (a `TZID` is passed
 * through unresolved for the same reason). Guessing here would move a listing
 * by a day, which is the failure this whole function is built to avoid.
 *
 * That makes it server-timezone-independent by construction: `new Date()` on a
 * bare `YYYY-MM-DD` is UTC midnight by spec on every host, so the window closes
 * at 00:00 UTC the next day whatever the box is set to.
 *
 * **The tradeoff, plainly.** 00:00 UTC is 8pm US Eastern, 5pm Pacific. So on a
 * US campus an all-day event stops being offered in the last few hours of its
 * own evening rather than at local midnight, and east of Greenwich it lingers
 * an hour or two into the next morning. Both are small and only one direction
 * is dangerous: showing a day that has passed walks a student into an empty
 * room, and showing nothing is the lesser harm. This errs toward nothing
 * everywhere the campus is west of us, which is every US school.
 *
 * Where a feed does carry an offset the answer is exact for free — Localist and
 * LiveWhale stamp an all-day event at real local midnight, so +24h lands on
 * local end-of-day.
 *
 * ## Why the flag is not the only test
 *
 * `all_day` is used where a feed sets it, but two feeds hand us a bare day
 * without it: Localist falls back to `first_date` when an event has no
 * instance, and its `all_day` comes off the instance that isn't there; Drupal's
 * date field can be date-only and that adapter has no all-day flag to set. A
 * value with no time in it is not a moment under any reading, so it gets the
 * whole-day window whether or not the feed admitted what it was.
 *
 * ## How the end date is used, and why it can only ever extend
 *
 * A start alone cannot describe a three-day orientation fair or a month-long
 * exhibition: anchored to the start, the window shuts 24h in whatever the
 * event's real length is, so it is offered on day one and gone on day two. The
 * end is therefore consulted, and across this file it always names the LAST DAY
 * the event runs — see `icsInclusiveEnd` for the one feed that states it the
 * other way.
 *
 * The two windows are combined with `Math.max`, which is the whole safety
 * argument: whatever an end says, the answer is never earlier than the
 * start-only answer was. A missing, malformed, or nonsense-early end therefore
 * cannot drop a listing that shows today — it can only fail to extend one. That
 * matters because the previous attempt in this area was reverted for losing five
 * real events while gaining none, and an end date is the least trustworthy field
 * in every feed here.
 */
export function stillUpcoming(
  start: string,
  end: string,
  allDay: boolean,
  now: number,
): boolean {
  const at = new Date(start).getTime();
  if (!Number.isFinite(at)) return false;
  const wholeDay = allDay || DATE_ONLY.test(String(start).trim());
  const fromStart = at + (wholeDay ? WHOLE_DAY_MS : STARTED_GRACE_MS);
  return Math.max(fromStart, closesAfterEnd(end)) >= now;
}

/**
 * The instant an event's own end stops being in the future, or `-Infinity` when
 * the feed gave us nothing usable — which is the common case, since several
 * platforms omit an end entirely and one omits it for any event lasting a single
 * day.
 *
 * A bare day gets the same whole-day treatment as a bare start: it names the
 * last day, so it runs until that day is over. A timestamped end is a real
 * moment and gets the same hour of grace a timed start does.
 */
function closesAfterEnd(end: string): number {
  const text = String(end || '').trim();
  if (!text) return -Infinity;
  const at = new Date(text).getTime();
  if (!Number.isFinite(at)) return -Infinity;
  return at + (DATE_ONLY.test(text) ? WHOLE_DAY_MS : STARTED_GRACE_MS);
}

/**
 * The shape the client consumes. A platform that does not carry a field leaves
 * it empty — never filled in from a sibling field, a default, or a guess. An
 * absent room is worse than useless if it is invented; it walks a student into
 * the wrong building.
 */
function emptyEvent() {
  return {
    id: '',
    title: '',
    description: '',
    url: '',
    ics_url: '',
    start: '',
    end: '',
    all_day: false,
    location: '',
    room: '',
    address: '',
    // Three states, and the third one is the common one. Most calendar formats
    // carry no price at all — an iCal file has nowhere to put one — so `false`
    // here would have every event off a pasted club portal telling a student it
    // costs money. `null` means we do not know, and nothing renders a claim
    // from it. Only set true or false where the feed actually said so.
    is_free: null as boolean | null,
    ticket_url: '',
    has_register: false,
    departments: [] as string[],
    topics: [] as string[],
    types: [] as string[],
    audience: [] as string[],
    keywords: [] as string[],
  };
}

type NormalizedEvent = ReturnType<typeof emptyEvent>;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(plainText).filter(Boolean);
}

// ── Adapter: Localist (Concept3D) ───────────────────────────────────────────

/**
 * Is this really a Localist calendar? A 200 is not enough — plenty of hosts
 * answer /api/2/events with an HTML error page or a catch-all JSON blob.
 */
export function looksLikeLocalist(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  return Array.isArray(body.events) && typeof body.page === 'object' && body.page !== null;
}

export async function probeLocalist(domain: string): Promise<string | null> {
  const bases = SUBDOMAIN_CANDIDATES.map(sub => `https://${sub}.${domain}/api/2/events`);
  const hit = await firstValidUrl(bases.map(b => `${b}?days=1&pp=1`), looksLikeLocalist);
  return hit ? hit.split('?')[0] : null;
}

export async function fetchFeed(feedUrl: string, days: number) {
  const url = `${feedUrl}?days=${days}&pp=${FEED_PAGE_SIZE}&distinct=true`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!looksLikeLocalist(body)) throw new Error('Calendar feed returned an unexpected shape');
  return (body.events || [])
    // deno-lint-ignore no-explicit-any
    .map((wrapper: any) => wrapper?.event || wrapper)
    .filter(Boolean);
}

/** Localist nests instances as [{ event_instance: {...} }]; older feeds do not. */
// deno-lint-ignore no-explicit-any
function firstInstance(event: any) {
  const raw = Array.isArray(event?.event_instances) ? event.event_instances[0] : null;
  return raw?.event_instance || raw || null;
}

// deno-lint-ignore no-explicit-any
function filterNames(event: any, group: string): string[] {
  const entries = event?.filters?.[group];
  if (!Array.isArray(entries)) return [];
  // deno-lint-ignore no-explicit-any
  return entries.map((e: any) => e?.name).filter(Boolean);
}

// deno-lint-ignore no-explicit-any
export function normalizeEvent(event: any): NormalizedEvent {
  const instance = firstInstance(event);
  return {
    ...emptyEvent(),
    id: String(event.id),
    title: event.title || '',
    // Already plain text — running it through plainText would eat a literal
    // "<" a student is meant to read.
    description: (event.description_text || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    url: event.localist_url || event.url || '',
    ics_url: instance?.ical_url || event.localist_ics_url || '',
    start: instance?.start || event.first_date || '',
    end: instance?.end || '',
    all_day: Boolean(instance?.all_day),
    location: event.location_name || event.location || '',
    room: event.room_number || '',
    address: event.address || '',
    // Localist's `free` is a checkbox that defaults to off, so `free: false` is
    // nobody having ticked it far more often than it is a price. Ticking it on
    // is the only thing here that means anything.
    is_free: event.free === true ? true : null,
    ticket_url: event.ticket_url || '',
    // A Localist "ticket" link is a sign-up page, not a till. On Fairfield's
    // live feed 21 of 25 events carry one and they are Zoom webinar
    // registrations and GiveCampus RSVPs — free things you have to sign up
    // for. So it proves registration and says nothing about money.
    has_register: Boolean(event.has_register || event.ticket_url),
    // deno-lint-ignore no-explicit-any
    departments: (event.departments || []).map((d: any) => d?.name).filter(Boolean),
    topics: filterNames(event, 'event_topics'),
    types: filterNames(event, 'event_types'),
    audience: filterNames(event, 'event_audience'),
    keywords: Array.isArray(event.keywords) ? event.keywords.filter(Boolean) : [],
  };
}

const localistAdapter: Adapter = {
  name: 'localist',
  probe: probeLocalist,
  fetch: fetchFeed,
  normalize: normalizeEvent,
};

// ── Adapter: LiveWhale ──────────────────────────────────────────────────────

/**
 * LiveWhale returns a skeleton record by default. The extra fields are opt-in
 * through PATH SEGMENTS — query params are accepted and silently ignored,
 * which looks identical to a school that simply has no locations on file.
 */
const LIVEWHALE_FIELDS = 'location,summary,description,event_types,tags,group_title,registration';

/**
 * Two response shapes, both real. Newer installs wrap events in {meta, data};
 * Trinity and Seton Hall answer the bare /live/json/events with a naked array
 * and only switch to the envelope once path segments are appended. Requiring
 * the envelope at probe time made both look like schools with no calendar.
 *
 * The array form is still checked field by field — `date_iso` is what
 * separates it from Trumba's bare array, which carries `startDateTime`.
 */
export function looksLikeLiveWhale(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return Boolean(first && typeof first === 'object' && first.title && first.date_iso);
  }
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  return Array.isArray(body.data) && typeof body.meta === 'object' && body.meta !== null;
}

// deno-lint-ignore no-explicit-any
function liveWhaleRows(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  // deno-lint-ignore no-explicit-any
  const data = (body as any)?.data;
  return Array.isArray(data) ? data : [];
}

async function probeLiveWhale(domain: string): Promise<string | null> {
  const bases = ['events', 'calendar'].map(sub => `https://${sub}.${domain}/live/json/events`);
  // Not every school gives LiveWhale a subdomain. Angelo State serves 763 future
  // events straight off its main site at www.angelo.edu/live/json/events, and a
  // subdomain-only guess reads that as a school with no calendar. This is the one
  // extra candidate worth its cost on every school: the path is distinctive
  // enough that a site not running LiveWhale answers 404 immediately.
  bases.push(`https://www.${domain}/live/json/events`);
  return await firstValidUrl(bases, looksLikeLiveWhale);
}

async function fetchLiveWhale(feedUrl: string, days: number) {
  // meta.total_results runs to ~1000 on a big school and per_page cannot be
  // lowered below 100. One page is the shortlist; paging further would cost
  // ten round trips to feed a ranking pass that only keeps 20.
  const url = `${feedUrl}/days/${days}/response_fields/${LIVEWHALE_FIELDS}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!looksLikeLiveWhale(body)) throw new Error('Calendar feed returned an unexpected shape');
  // /days/N/ does not cap the window on any install measured — UConn asked for
  // 7 days and returned events 9 days out, Trinity asked for 45 and returned
  // events 53 days out. It behaves like a paging hint, not a filter, so the
  // window is enforced here the same way it is for Trumba and Campus Labs.
  // deno-lint-ignore no-explicit-any
  return liveWhaleRows(body).filter((e: any) =>
    e && !e.is_canceled && withinWindow(e.date_iso, days)
  );
}

// deno-lint-ignore no-explicit-any
function normalizeLiveWhale(event: any): NormalizedEvent {
  return {
    ...emptyEvent(),
    id: String(event.id ?? ''),
    title: plainText(event.title),
    // summary is the short blurb, description the long one; both arrive as HTML.
    description: plainText(event.summary || event.description).slice(0, 600),
    url: cleanUrl(event.url),
    start: event.date_iso || '',
    end: event.date2_iso || '',
    all_day: Boolean(event.is_all_day), // 1/0, not a JSON boolean
    location: plainText(event.location || event.location_title),
    types: cleanList(event.event_types),
    // The feed exposes has_registration; older installs send `registration`.
    has_register: Boolean(event.has_registration ?? event.registration),
    departments: event.group_title ? [plainText(event.group_title)] : [],
    keywords: cleanList(event.tags),
  };
}

const liveWhaleAdapter: Adapter = {
  name: 'livewhale',
  probe: probeLiveWhale,
  fetch: fetchLiveWhale,
  normalize: normalizeLiveWhale,
};

// ── Adapter: Trumba ─────────────────────────────────────────────────────────

const TRUMBA_HOSTS = ['https://www.trumba.com/calendars', 'https://25livepub.collegenet.com/calendars'];

/** A bare JSON array whose first entry carries the two fields we depend on. */
export function looksLikeTrumba(payload: unknown): boolean {
  if (!Array.isArray(payload) || !payload.length) return false;
  const first = payload[0];
  return Boolean(first && typeof first === 'object' && first.title && first.startDateTime);
}

/** How much of a calendar page to scan; the embed snippet is near the top. */
const TRUMBA_HTML_SCAN_BYTES = 500_000;
const TRUMBA_MAX_SLUGS = 3;

/** Pages a school is most likely to embed its Trumba calendar on, in preference order. */
function trumbaPageCandidates(domain: string): string[] {
  return [
    `https://www.${domain}/calendar`,  // finds UNH
    `https://www.${domain}/events`,
    `https://events.${domain}`,        // finds Tufts; its /calendar and /events both 404
    `https://calendar.${domain}`,
  ];
}

const TRUMBA_SLUG_PATTERNS = [
  /webName["']?\s*:\s*["']([A-Za-z0-9._-]+)["']/g,
  /25livepub\.collegenet\.com\/calendars\/([A-Za-z0-9._-]+)/g,
  // Some schools embed no script at all, only a subscribe link — Emory's page
  // names its calendar exactly once, as trumba.com/eventactions/emory-events.
  /trumba\.com\/(?:calendars|eventactions)\/([A-Za-z0-9._-]+)/g,
];

/**
 * Read the front of a page and stop. A university homepage can be megabytes of
 * inlined markup, and the Trumba embed is a script tag near the top.
 */
async function fetchPage(
  url: string,
  maxChars: number,
  guard: HopGuard = null,
): Promise<{ finalHost: string; finalUrl: string; html: string }> {
  const res = await guardedFetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml,*/*', 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  }, guard);

  // Where the request actually ended up, which is often not where it was sent.
  const finalUrl = res.url || url;
  let finalHost = '';
  try {
    finalHost = stripWww(new URL(finalUrl).hostname.toLowerCase());
  } catch (_) {
    finalHost = '';
  }

  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {});
    return { finalHost, finalUrl, html: '' };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let html = '';
  try {
    while (html.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return { finalHost, finalUrl, html: html.slice(0, maxChars) };
}

async function fetchHtmlHead(url: string, maxChars: number): Promise<string> {
  return (await fetchPage(url, maxChars)).html;
}

function trumbaSlugsFrom(html: string): string[] {
  const slugs: string[] = [];
  for (const pattern of TRUMBA_SLUG_PATTERNS) {
    for (const match of html.matchAll(pattern)) {
      const slug = match[1].replace(/\.json$/i, '');
      if (slug && !slugs.includes(slug)) slugs.push(slug);
    }
  }
  return slugs;
}

/**
 * Trumba slugs are publisher-chosen and genuinely not derivable: Tufts is
 * "tufts", but Providence is "pc-ext_open_pub" and UNH is
 * "university-of-new-hampshire-events". The slug therefore has to be read out
 * of the page that embeds the calendar.
 *
 * A school whose page does not name a slug simply does not resolve. Guessing
 * variants would be brute-forcing someone else's calendar namespace, and a
 * wrong slug means sending a student to another school's events.
 */
async function probeTrumba(domain: string): Promise<string | null> {
  const pages = await Promise.all(trumbaPageCandidates(domain).map(async (url) => {
    try {
      return await fetchHtmlHead(url, TRUMBA_HTML_SCAN_BYTES);
    } catch (_) {
      return ''; // 403, timeout, no such host — just means no slug from here.
    }
  }));

  const slugs: string[] = [];
  for (const html of pages) {
    for (const slug of trumbaSlugsFrom(html)) {
      if (!slugs.includes(slug)) slugs.push(slug);
    }
  }

  // The domain label goes last, behind anything the page actually named. It is
  // still a guess, so it only gets to answer when discovery found nothing —
  // and like every other candidate it has to validate against a real feed
  // before it is returned.
  const candidates = slugs.slice(0, TRUMBA_MAX_SLUGS);
  const label = domainLabel(domain);
  if (label && !candidates.includes(label)) candidates.push(label);

  for (const slug of candidates) {
    const hit = await firstValidUrl(TRUMBA_HOSTS.map(host => `${host}/${slug}.json`), looksLikeTrumba);
    if (hit) return hit;
  }
  return null;
}

async function fetchTrumba(feedUrl: string, days: number) {
  const res = await fetch(feedUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!looksLikeTrumba(body)) throw new Error('Calendar feed returned an unexpected shape');
  // deno-lint-ignore no-explicit-any
  return body.filter((e: any) => e && !e.canceled && withinWindow(e.startDateTime, days));
}

// deno-lint-ignore no-explicit-any
function trumbaFields(event: any): { types: string[]; keywords: string[] } {
  const fields = Array.isArray(event?.customFields) ? event.customFields : [];
  const types: string[] = [];
  const keywords: string[] = [];
  for (const field of fields) {
    const value = plainText(field?.value);
    if (!value) continue;
    if (field?.label === 'Event Type') types.push(value);
    // Publishers use custom fields for prose too — a stripped registration
    // blurb is not a keyword, and it would outweigh the title when scoring.
    else if (value.length <= 100) keywords.push(value);
  }
  return { types, keywords };
}

// deno-lint-ignore no-explicit-any
function normalizeTrumba(event: any): NormalizedEvent {
  const { types, keywords } = trumbaFields(event);
  return {
    ...emptyEvent(),
    id: String(event.eventID ?? ''),
    title: plainText(event.title),
    description: plainText(event.description).slice(0, 600),
    url: cleanUrl(event.permaLinkUrl || event.webLink),
    // No offset on these ("2026-08-12T18:30:00") — it is campus-local time and
    // stays that way. Stamping a timezone on it would be inventing one.
    start: event.startDateTime || '',
    end: event.endDateTime || '',
    all_day: Boolean(event.allDay),
    location: plainText(event.location),
    types,
    keywords,
  };
}

const trumbaAdapter: Adapter = {
  name: 'trumba',
  probe: probeTrumba,
  fetch: fetchTrumba,
  normalize: normalizeTrumba,
};

// ── Adapter: Campus Labs Engage ─────────────────────────────────────────────

/**
 * Student-organization events rather than the institutional calendar, which
 * makes this the most useful feed of the four for a career experiment and the
 * reason it is worth probing even when nothing else matched.
 */
export function looksLikeCampusLabs(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  // Non-empty on purpose. Several schools serve a well-formed feed that has
  // been empty for years; caching one wins the probe and then permanently
  // shadows a working calendar on another platform.
  return Array.isArray(body.value) && body.value.length > 0;
}

function campusLabsSlug(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.split('.')[0] || '';
  } catch (_) {
    return '';
  }
}

async function probeCampusLabs(domain: string): Promise<string | null> {
  const slug = domainLabel(domain);
  if (!slug) return null;
  const base = `https://${slug}.campuslabs.com/engage/api/discovery/event/search`;
  const hit = await firstValidUrl(
    [`${base}?endsAfter=${encodeURIComponent(new Date().toISOString())}&take=1`],
    looksLikeCampusLabs,
  );
  return hit ? base : null;
}

async function fetchCampusLabs(feedUrl: string, days: number) {
  const url = `${feedUrl}?endsAfter=${encodeURIComponent(new Date().toISOString())}&take=${FEED_PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.value)) throw new Error('Calendar feed returned an unexpected shape');
  // Anything not Approved is a draft, a denial, or a cancellation.
  // deno-lint-ignore no-explicit-any
  return body.value.filter((e: any) => e?.status === 'Approved' && withinWindow(e.startsOn, days));
}

// deno-lint-ignore no-explicit-any
function normalizeCampusLabs(event: any, feedUrl: string): NormalizedEvent {
  const slug = campusLabsSlug(feedUrl);
  return {
    ...emptyEvent(),
    id: String(event.id ?? ''),
    title: plainText(event.name),
    description: plainText(event.description).slice(0, 600),
    url: slug && event.id ? `https://${slug}.campuslabs.com/engage/event/${event.id}` : '',
    start: event.startsOn || '',
    end: event.endsOn || '',
    location: plainText(event.location),
    types: cleanList(event.categoryNames),
    departments: event.organizationName ? [plainText(event.organizationName)] : [],
  };
}

const campusLabsAdapter: Adapter = {
  name: 'campuslabs',
  probe: probeCampusLabs,
  fetch: fetchCampusLabs,
  normalize: normalizeCampusLabs,
};

// ── Adapter: CampusGroups ───────────────────────────────────────────────────

/**
 * CampusGroups, the platform the paste screen names by example.
 *
 * It is Anthology's *other* student-life product and it is not Campus Labs
 * Engage, despite the adjacent branding. Engage answers a REST discovery API;
 * CampusGroups answers `/mobile_ws/v17/mobile_events_list` and nothing else,
 * and its own web page is a JavaScript shell with no feed link in the markup.
 * Discovery used to send `*.campusgroups.com` at Engage's endpoint, get
 * nothing, fall through to reading the shell, and give up — so the one vendor
 * the copy tells students to paste was the one we could not read.
 *
 * ## The payload is positional, and that is the whole risk
 *
 * Each row carries a `fields` header naming what `p0`…`pN` mean:
 *
 *   { fields: "date_separator,eventId,eventName,eventDates,…",
 *     p0: "false", p1: "376101", p2: "How to Stop Living in Fundraising Mode" }
 *
 * So `p1` is only the id because this row's header says so. Reading positions
 * directly would work today and silently return somebody else's field the
 * first time Anthology inserts a column — the endpoint is already on v17. The
 * header is mapped every time, per row, and a row whose header omits a field
 * simply does not have it.
 */

/** The one endpoint, and the only query it answers usefully. */
const CAMPUS_GROUPS_PATH = '/mobile_ws/v17/mobile_events_list';
const CAMPUS_GROUPS_QUERY = `?range=0&limit=${FEED_PAGE_SIZE}&filter4=upcoming`;

/**
 * A location that says to sign in is not a location.
 *
 * CampusGroups renders the string a signed-out reader gets into the same field
 * a real room name goes in, so it arrives looking like data. Rendering it walks
 * a student to "Private Location (sign in to display)".
 */
const CAMPUS_GROUPS_HIDDEN_LOCATION = /\b(sign in|register|log in)\b.*\bdisplay\b/i;

/** One row's named fields, or null when the row is a date separator. */
// deno-lint-ignore no-explicit-any
function campusGroupsRow(row: any): Record<string, string> | null {
  if (!row || typeof row !== 'object') return null;
  const names = String(row.fields || '').split(',');
  const out: Record<string, string> = {};
  names.forEach((name, i) => {
    const value = row[`p${i}`];
    if (name && typeof value === 'string') out[name] = value;
  });
  return out.eventId ? out : null;
}

// deno-lint-ignore no-explicit-any
function campusGroupsRows(payload: any): Record<string, string>[] {
  if (!Array.isArray(payload)) return [];
  return payload.map(campusGroupsRow).filter(Boolean) as Record<string, string>[];
}

/**
 * Non-empty on purpose, for the reason spelled out on Campus Labs above, and
 * this platform makes the trap concrete: `fairfield.campusgroups.com` answers
 * 200 with zero events. Accepting that would win the probe and permanently
 * shadow Fairfield's working Localist feed, which is the one calendar in this
 * codebase we know serves real events every day.
 */
export function looksLikeCampusGroups(payload: unknown): boolean {
  return campusGroupsRows(payload).length > 0;
}

/**
 * Their accessibility label is the only reliable date in the payload.
 *
 * `eventDates` is display HTML — "Wed, Aug 5, 2026" over "4 PM – 6 PM", with no
 * year on the end of a range and no offset anywhere. The aria label spells the
 * whole thing out including the zone:
 *
 *   "…. Wednesday, 05 August 2026 At 4:00 PM, EDT (GMT-4)."
 *
 * Read from the end, because an event is perfectly entitled to have a date in
 * its own title. Returns '' rather than a guess — a wrong date walks a student
 * to an empty room, which is the failure this whole file is written to avoid.
 */
const CAMPUS_GROUPS_WHEN =
  /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+At\s+(\d{1,2}):(\d{2})\s*(AM|PM))?(?:\s*,\s*[A-Z]{2,5}\s*\(GMT([+-]\d{1,2})(?::?(\d{2}))?\))?/gi;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function campusGroupsWhen(aria: string): { start: string; allDay: boolean } {
  const matches = [...String(aria || '').matchAll(CAMPUS_GROUPS_WHEN)];
  const m = matches[matches.length - 1];
  if (!m) return { start: '', allDay: false };

  const [, day, monthName, year, hour, minute, meridiem, tzHour, tzMinute] = m;
  const month = MONTHS.indexOf(String(monthName).toLowerCase());
  if (month < 0) return { start: '', allDay: false };

  // No time in the label means the event carries a date and nothing else.
  if (!hour) {
    return { start: `${year}-${pad2(month + 1)}-${pad2(Number(day))}T00:00:00Z`, allDay: true };
  }

  let h = Number(hour) % 12;
  if (String(meridiem).toUpperCase() === 'PM') h += 12;

  // Without an offset the instant is unknowable, so it is left as a local
  // wall-clock time rather than being silently declared UTC — five hours wrong
  // is worse than unzoned.
  const offset = tzHour
    ? `${Number(tzHour) < 0 ? '-' : '+'}${pad2(Math.abs(Number(tzHour)))}:${pad2(Number(tzMinute || 0))}`
    : '';

  return {
    start: `${year}-${pad2(month + 1)}-${pad2(Number(day))}T${pad2(h)}:${pad2(Number(minute))}:00${offset}`,
    allDay: false,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function campusGroupsOrigin(feedUrl: string): string {
  try {
    return new URL(feedUrl).origin;
  } catch (_) {
    return '';
  }
}

/**
 * The shared JSON probe cannot be used here, and that is the whole reason this
 * platform stayed invisible.
 *
 * CampusGroups serves this endpoint as `content-type: text/html` while the body
 * is JSON. `probeJson` requires the header to say json and discards everything
 * else unread, so every portal in the vendor's estate looked like a web page to
 * discovery no matter which URL was tried. Parsing the body is the only honest
 * test of what it is.
 *
 * `guard` is threaded because callers on the student-submitted path re-check
 * every redirect hop; dropping it there silently reopens the SSRF this file was
 * patched for.
 */
async function probeCampusGroupsAt(host: string, guard: HopGuard = null): Promise<string | null> {
  const base = `https://${host}${CAMPUS_GROUPS_PATH}`;
  let res: Response;
  try {
    res = await guardedFetch(base + CAMPUS_GROUPS_QUERY, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    }, guard);
  } catch (_) {
    return null;
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  try {
    return looksLikeCampusGroups(JSON.parse(await res.text())) ? base : null;
  } catch (_) {
    return null; // Really was a web page.
  }
}

async function probeCampusGroups(domain: string): Promise<string | null> {
  const slug = domainLabel(domain);
  if (!slug) return null;
  return await probeCampusGroupsAt(`${slug}.campusgroups.com`);
}

/**
 * Raw rows out, exactly as every other adapter's fetch does. The header
 * mapping belongs in normalize, so that what a test hands normalize is the
 * shape the vendor actually sends rather than something fetch already tidied.
 */
async function fetchCampusGroups(feedUrl: string, days: number) {
  const res = await fetch(feedUrl + CAMPUS_GROUPS_QUERY, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const payload = await res.json();
  if (!looksLikeCampusGroups(payload)) {
    throw new Error('Calendar feed returned an unexpected shape');
  }
  // deno-lint-ignore no-explicit-any
  return (payload as any[]).filter(row => {
    const fields = campusGroupsRow(row);
    if (!fields) return false;
    const { start } = campusGroupsWhen(fields.ariaEventDetails);
    return Boolean(start) && withinWindow(start, days);
  });
}

// deno-lint-ignore no-explicit-any
function normalizeCampusGroups(raw: any, feedUrl: string): NormalizedEvent {
  const event = campusGroupsRow(raw) || {};
  const origin = campusGroupsOrigin(feedUrl);
  const { start, allDay } = campusGroupsWhen(event.ariaEventDetails);
  const location = plainText(event.eventLocation);
  const price = String(event.eventPriceRange || '').trim();

  return {
    ...emptyEvent(),
    id: String(event.eventId ?? ''),
    title: plainText(event.eventName),
    // The list endpoint carries no description. Left empty rather than filled
    // from the category or the club name, both of which read as a blurb and
    // are not one.
    url: origin && event.eventUrl ? origin + event.eventUrl : '',
    start,
    all_day: allDay,
    location: CAMPUS_GROUPS_HIDDEN_LOCATION.test(location) ? '' : location,
    // "FREE" is the only price this field states outright; a range like
    // "$5 - $20" is a real cost, and empty means nobody filled it in.
    is_free: /^free$/i.test(price) ? true : price ? false : null,
    has_register: /register|rsvp|tickets?/i.test(String(event.eventButtonLabel || '')),
    types: cleanList([event.eventCategory]),
    departments: event.clubName ? [plainText(event.clubName)] : [],
  };
}

const campusGroupsAdapter: Adapter = {
  name: 'campusgroups',
  probe: probeCampusGroups,
  fetch: fetchCampusGroups,
  normalize: normalizeCampusGroups,
};

// ── Adapter: Modern Campus ──────────────────────────────────────────────────

/**
 * Modern Campus (formerly OmniUpdate), and the richest data of anything here.
 *
 * South Florida and San Diego State both sat in the "no calendar we can read"
 * list, and both were running this: a documented, unauthenticated REST API with
 * full descriptions, categories, organizers, rooms and images. Their public
 * pages are empty shells that load a widget, which is why nothing in the HTML
 * ever named a feed.
 *
 * ## Discovery is an id in the markup, not a guessable path
 *
 * Every calendar is a UUID and the endpoint is useless without it. The page
 * that embeds the widget names it outright:
 *
 *   <omnicms-calendar data-calendar-id="03614054-50cb-4e9d-82e6-3565ba147743">
 *
 * so the id is readable from the HTML source with no browser, which is what
 * makes this discoverable at all.
 */

const MODERN_CAMPUS_API = 'https://api.calendar.moderncampus.net/pubcalendar';

/**
 * The pages a school most often puts the widget on.
 *
 * Kept short deliberately: this is the only probe here that costs a page read
 * rather than one API call, and it runs against both www and the bare domain.
 * A school is probed once and the answer is stored, so six reads once is
 * affordable — sixteen would not be.
 */
const MODERN_CAMPUS_PAGES = ['/calendar/', '/events/', '/events-calendar'];

const MODERN_CAMPUS_ID =
  /data-calendar-id\s*=\s*["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/gi;

/** Every Modern Campus calendar id named in a page's markup. */
export function modernCampusIdsFrom(html: string): string[] {
  return [...new Set([...String(html || '').matchAll(MODERN_CAMPUS_ID)].map(m => m[1].toLowerCase()))];
}

function modernCampusWindow(days: number): string {
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return `?start=${day(now)}&end=${day(end)}`;
}

/**
 * Non-empty, for the same reason every other probe here insists on it: a
 * school can run a well-formed calendar that has had nothing on it for years,
 * and caching one shadows a platform that would have answered.
 */
export function looksLikeModernCampus(payload: unknown): boolean {
  // deno-lint-ignore no-explicit-any
  return Array.isArray(payload) && payload.some((e: any) => e?.title && (e.startDate || e.startDatetime));
}

async function probeModernCampus(domain: string): Promise<string | null> {
  for (const host of [`www.${domain}`, domain]) {
    for (const path of MODERN_CAMPUS_PAGES) {
      let html = '';
      try {
        html = (await fetchPage(`https://${host}${path}`, DISCOVERY_SCAN_BYTES)).html;
      } catch (_) {
        continue;
      }
      const hit = await firstValidModernCampus(modernCampusIdsFrom(html));
      if (hit) return hit;
    }
  }
  return null;
}

/** The first of these calendar ids that answers with real events. */
async function firstValidModernCampus(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const bases = ids.slice(0, 4).map(id => `${MODERN_CAMPUS_API}/${id}/events`);
  const hit = await firstValidUrl(
    bases.map(base => base + modernCampusWindow(DEFAULT_DAYS)),
    looksLikeModernCampus,
  );
  return hit ? hit.split('?')[0] : null;
}

async function fetchModernCampus(feedUrl: string, days: number) {
  const res = await fetch(feedUrl + modernCampusWindow(days), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error('Calendar feed returned an unexpected shape');
  // Anything not CONFIRMED is a draft, a pending submission, or a cancellation.
  // deno-lint-ignore no-explicit-any
  return body.filter((e: any) => !e?.status || e.status === 'CONFIRMED');
}

/**
 * Two date shapes, and they map exactly onto the two this file already has.
 *
 *   startDatetime  "2026-08-04T14:30"  wall-clock, no offset — emitted as-is,
 *                                      the same treatment iCal and Trumba get,
 *                                      because a student standing on that
 *                                      campus reads the clock on the wall
 *   startDate      "2026-07-13"        all-day — emitted date-only and flagged
 *
 * The calendar's IANA zone is available from the metadata endpoint and is
 * deliberately not used. Converting a wall-clock time with it would be the one
 * thing `icsDate` is written not to do.
 */
function modernCampusWhen(date: unknown, dateTime: unknown): { value: string; allDay: boolean } {
  const dt = String(dateTime || '').trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dt)) {
    // Seconds are optional in what they send and required by what we emit.
    return { value: dt.length === 16 ? `${dt}:00` : dt, allDay: false };
  }
  const d = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return { value: d, allDay: true };
  return { value: '', allDay: false };
}

// deno-lint-ignore no-explicit-any
function normalizeModernCampus(event: any): NormalizedEvent {
  const start = modernCampusWhen(event.startDate, event.startDatetime);
  const end = modernCampusWhen(event.endDate, event.endDatetime);
  const ticket = String(event.ticketOption || '').trim();

  return {
    ...emptyEvent(),
    id: String(event.id ?? ''),
    title: plainText(event.title),
    // descriptionText is their own plain-text rendering of the HTML body.
    description: plainText(event.descriptionText || event.description).slice(0, 600),
    start: start.value,
    end: end.value,
    all_day: start.allDay,
    location: plainText(event.location),
    room: plainText(event.locationRoom),
    // Their "other" location is a place that is not a campus building — an away
    // fixture's town, an off-campus venue.
    address: plainText(event.locationOther),
    is_free: /^free$/i.test(ticket) ? true : ticket ? false : null,
    ticket_url: cleanUrl(event.ticketUrl),
    // Same reading as CampusGroups: a ticket link is a sign-up page, and their
    // own button says so — "RSVP", "Register Here", "Reserve your spot".
    has_register: Boolean(event.ticketUrl || event.ticketButtonLabel),
    types: cleanList([event.categoryName]),
    departments: event.organizer ? [plainText(event.organizer)] : [],
    keywords: cleanList(event.tags),
  };
}

const modernCampusAdapter: Adapter = {
  name: 'moderncampus',
  probe: probeModernCampus,
  fetch: fetchModernCampus,
  normalize: normalizeModernCampus,
};

// ── Adapter: Presence ───────────────────────────────────────────────────────

/**
 * Presence, which this file has been refusing to read on purpose.
 *
 * `presence.io` has been on the vendor allowlist with a comment admitting we
 * had no adapter — kept there so a student who pasted their real portal got an
 * honest "we could not read that" rather than "that address is somewhere
 * else". This is the endpoint that retires the comment.
 *
 * One address pattern serves every school on the platform:
 *
 *   https://api.presence.io/<slug>/v1/events
 *
 * Confirmed against six: San Diego State, Keene State, Bloomsburg, Salem
 * State, Westfield State and Plymouth State. Unauthenticated, real UTC
 * timestamps, descriptions, locations and the hosting organisation.
 */

const PRESENCE_API = 'https://api.presence.io';

export function looksLikePresence(payload: unknown): boolean {
  // deno-lint-ignore no-explicit-any
  return Array.isArray(payload) && payload.some((e: any) => e?.eventName && e?.startDateTimeUtc);
}

function presenceSlug(feedUrl: string): string {
  try {
    return new URL(feedUrl).pathname.split('/').filter(Boolean)[0] || '';
  } catch (_) {
    return '';
  }
}

async function probePresence(domain: string): Promise<string | null> {
  const slug = domainLabel(domain);
  if (!slug) return null;
  const base = `${PRESENCE_API}/${slug}/v1/events`;
  return await firstValidUrl([base], looksLikePresence) ? base : null;
}

async function fetchPresence(feedUrl: string, days: number) {
  const res = await fetch(feedUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error('Calendar feed returned an unexpected shape');
  // The endpoint returns the whole history, and says outright which are over.
  // deno-lint-ignore no-explicit-any
  return body.filter((e: any) => !e?.hasEventEnded && withinWindow(e?.startDateTimeUtc, days));
}

// deno-lint-ignore no-explicit-any
function normalizePresence(event: any, feedUrl: string): NormalizedEvent {
  // The row carries its own subdomain; the feed URL is the fallback for a row
  // that does not, so a link is never built from the wrong school.
  const slug = String(event.subdomain || '').trim() || presenceSlug(feedUrl);

  return {
    ...emptyEvent(),
    id: String(event.eventNoSqlId ?? ''),
    title: plainText(event.eventName),
    description: plainText(event.description).slice(0, 600),
    url: slug && event.uri ? `https://${slug}.presence.io/event/${event.uri}` : '',
    start: event.startDateTimeUtc || '',
    end: event.endDateTimeUtc || '',
    location: plainText(event.location),
    // rsvpStatus is a mode rather than a flag, so the link is the honest signal.
    has_register: Boolean(event.rsvpLink),
    departments: event.organizationName ? [plainText(event.organizationName)] : [],
    keywords: cleanList(event.tags),
  };
}

const presenceAdapter: Adapter = {
  name: 'presence',
  probe: probePresence,
  fetch: fetchPresence,
  normalize: normalizePresence,
};

// ── Adapter: EMS Master Calendar (Dean Evans) ───────────────────────────────

/**
 * EMS Master Calendar — the public face of the room-booking system a lot of
 * mid-size universities already run. Sacred Heart and James Madison are the two
 * our own students attend, and both read as "no calendar" until this existed.
 *
 * It is the only platform in this file that publishes no feed. The page builds
 * its list from an ASP.NET PageMethod, so reading it means doing what the page
 * does:
 *
 *   1. one request to MasterCalendar.aspx purely for its ASP.NET_SessionId
 *   2. POST MasterCalendar.aspx/GetMoreData with a month and a page number
 *   3. unwrap {"d": "<json string>"} and parse that string as JSON again
 *
 * Step 1 is not optional and skipping it does not look like an error. Without
 * the cookie the POST answers 200 with `{"PageCount":0,"listData":[]}` — a
 * well-formed empty month, which reads as a school with nothing on rather than
 * as us using the endpoint wrong. Everything below is written against that
 * failure: a miss has to be a real miss.
 *
 * Most installs also expose RSS, and it is deliberately not used. James
 * Madison's is its *academic* calendar — 93 deadlines carrying no times, no
 * places and no categories — while the calendar a student actually wants holds
 * ~350 events a month and exists only behind the PageMethod. Sacred Heart's RSS
 * is the fuller source of the two there, but picking per school on a guess is
 * worse than reading the calendar the school itself shows the public, which is
 * what this does. Measured on Sacred Heart's September: 199 events through the
 * PageMethod against 211 in the RSS, so the gap only exists out of term.
 */

/**
 * Requests one fetch may spend on POSTs, across every month it walks.
 *
 * Sacred Heart's September is 7 pages and James Madison's is 8, so a 45-day
 * window over two months could otherwise cost 15 round trips with a student
 * watching a spinner. Pages come back in date order, so a budget spent from the
 * front keeps the soonest events and drops the furthest-out ones, which is the
 * right thing to lose.
 */
const EMS_PAGE_BUDGET = 6;

/** A 120-day window touches five months; four is the honest working ceiling. */
const EMS_MAX_MONTHS = 4;

/**
 * displayView is the index of the selected button in the page's own view bar:
 * 0 day, 1 week, 2 month. Month is the widest range the endpoint offers — 3 and
 * above answer for a single day in January and mean nothing.
 */
const EMS_MONTH_VIEW = '2';

/** "8/20/2026 7:00:00 PM", and a 24-hour install would drop the meridiem. */
const EMS_WHEN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;

/**
 * Not optional, and its absence is the second thing here that fails quietly.
 *
 * EMS picks the culture it formats dates in off this header. A request without
 * one gets 200 and 1.8KB of "Master Calendar Error" instead of the calendar,
 * and — because the error page is served by a different handler — no session
 * cookie either, so the POST behind it then answers its well-formed empty
 * month. Both live installs need it; curl happens to get away without it,
 * which is exactly how this stayed hidden through a shell-based dig.
 */
const EMS_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': BROWSER_UA,
};

/** The path is fixed relative to whichever folder the calendar is installed in. */
function emsMethodUrl(feedUrl: string): string {
  return `${feedUrl.split('?')[0]}/GetMoreData`;
}

function emsDetailUrl(feedUrl: string, id: unknown): string {
  const idText = String(id ?? '').trim();
  if (!idText || !/^\d+$/.test(idText)) return '';
  return feedUrl.split('?')[0].replace(
    /MasterCalendar\.aspx$/i,
    `EventDetails.aspx?EventDetailId=${idText}`,
  );
}

/**
 * The session cookie, which is the entire difference between a real month and
 * a convincing empty one.
 *
 * HEAD first because the page it is asking is 85–170KB of markup we have no use
 * for, and IIS hands out the cookie on a HEAD just as readily. A server that
 * refuses HEAD gets a GET whose body is dropped unread.
 */
async function emsSession(pageUrl: string, guard: HopGuard = null): Promise<string> {
  for (const method of ['HEAD', 'GET']) {
    let res: Response;
    try {
      res = await guardedFetch(pageUrl, {
        method,
        headers: { Accept: 'text/html,application/xhtml+xml,*/*', ...EMS_HEADERS },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }, guard);
    } catch (_) {
      continue;
    }
    const cookie = emsCookie(res);
    const refusedHead = res.status === 405 || res.status === 501;
    await res.body?.cancel().catch(() => {});
    if (cookie) return cookie;
    // A HEAD that was answered and simply carried no session cookie is an
    // answer: this is not the calendar. Only a server refusing the method
    // earns the second, expensive request — every host discovery hands us
    // pays for this probe, and most of them are not EMS at all.
    if (!refusedHead) return '';
  }
  return '';
}

/**
 * Set-Cookie is the one header that legitimately repeats, and this response
 * carries two of them. `getSetCookie()` keeps them apart where it exists;
 * `get()` folds them into one comma-joined line, so the pattern has to match
 * mid-string either way.
 */
function emsCookie(res: Response): string {
  const headers = res.headers as unknown as { getSetCookie?: () => string[] };
  const lines = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [res.headers.get('set-cookie') || ''];
  for (const line of lines) {
    const found = /(ASP\.NET_SessionId=[^;,\s]+)/i.exec(line || '');
    if (found) return found[1];
  }
  return '';
}

/** The first of each month the window touches, capped. */
function emsMonths(days: number): string[] {
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400000);
  const span = (end.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - now.getUTCMonth()) + 1;
  const count = Math.min(Math.max(span, 1), EMS_MAX_MONTHS);

  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(`${first.getUTCFullYear()}-${pad2(first.getUTCMonth() + 1)}-01`);
  }
  return months;
}

/**
 * One page of one month.
 *
 * The date goes out ISO rather than in the page's own M/D/YYYY, because the
 * page formats it to the browser's locale and every request here asks for the
 * first of a month — exactly the value a d/m/y install would read as a
 * different month. .NET parses ISO the same way under any culture, and both
 * live installs accept it.
 */
async function emsPage(
  feedUrl: string,
  cookie: string,
  startDate: string,
  pageIndex: number,
  guard: HopGuard = null,
  // deno-lint-ignore no-explicit-any
): Promise<{ pageCount: number; rows: any[] } | null> {
  const res = await guardedFetch(emsMethodUrl(feedUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Cookie: cookie,
      'X-Requested-With': 'XMLHttpRequest',
      ...EMS_HEADERS,
    },
    body: JSON.stringify({
      pageIndex: String(pageIndex),
      startDate,
      displayView: EMS_MONTH_VIEW,
      eventTypeIds: '',
      locationIds: '',
      sublocationIds: '',
      departmentIds: '',
      keyword: '',
    }),
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  }, guard);

  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return null;
  }

  // Two parses, not one: the PageMethod envelope holds the payload as a string.
  // deno-lint-ignore no-explicit-any
  let inner: any;
  try {
    const envelope = await res.json();
    inner = JSON.parse(String(envelope?.d ?? ''));
  } catch (_) {
    return null;
  }

  const rows = Array.isArray(inner?.listData) ? inner.listData : null;
  if (!rows) return null;
  const pageCount = Number(inner?.params?.[0]?.PageCount);
  return { pageCount: Number.isFinite(pageCount) ? pageCount : 0, rows };
}

/** Wall-clock components as an instant, so durations can be added to them. */
function emsMoment(value: unknown): number | null {
  const found = EMS_WHEN.exec(String(value || '').trim());
  if (!found) return null;
  const [, month, day, year, hour, minute, second, meridiem] = found;

  let hours = Number(hour);
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (/pm/i.test(meridiem)) hours = hours === 12 ? 12 : hours + 12;
    else if (hours === 12) hours = 0;
  }
  if (hours > 23) return null;

  const at = Date.UTC(
    Number(year), Number(month) - 1, Number(day),
    hours, Number(minute), Number(second || 0),
  );
  if (!Number.isFinite(at)) return null;

  // Date.UTC rolls a bad field over instead of refusing it, so "13/40/2026"
  // becomes a real day in February. A date that does not read back as the one
  // that was written is not a date we can show anybody.
  const back = new Date(at);
  if (back.getUTCMonth() !== Number(month) - 1 || back.getUTCDate() !== Number(day)) return null;
  return at;
}

/**
 * Back to a wall-clock string with no offset on it, which is the same treatment
 * iCal, Trumba and Modern Campus get. EMS states the calendar's own UTC offset
 * on every row and it is deliberately unused: a student standing on that campus
 * reads the clock on the wall, and applying an offset is the one thing `icsDate`
 * is written not to do.
 */
function emsStamp(at: number, dateOnly: boolean): string {
  const iso = new Date(at).toISOString();
  return dateOnly ? iso.slice(0, 10) : iso.slice(0, 19);
}

/**
 * EMS is a room-booking system before it is a calendar, so one event booked
 * into four rooms arrives as four rows — James Madison's home fixtures come
 * with their locker rooms attached.
 *
 * They collapse on title and start. Where the rows disagree about the place,
 * the place is dropped rather than picked: the first row of that soccer group
 * is a locker room, and naming it walks a student into the wrong building,
 * which this file holds to be worse than saying nothing.
 */
// deno-lint-ignore no-explicit-any
function emsDedupe(rows: any[]): any[] {
  // deno-lint-ignore no-explicit-any
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = `${plainText(row?.Title).toLowerCase()}|${row?.EventDateTime?.EventDateTime || ''}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    // The fullest description wins the group; a bare room booking carries none.
    const best = group.reduce((a, b) =>
      String(b?.Description || '').length > String(a?.Description || '').length ? b : a
    );
    const places = new Set(group.map(r => plainText(r?.Location?.Name)).filter(Boolean));
    return places.size > 1 ? { ...best, Location: null } : best;
  });
}

async function fetchEms(feedUrl: string, days: number) {
  const cookie = await emsSession(feedUrl);
  if (!cookie) throw new Error('Calendar feed would not start a session');

  const earliest = Date.now() - 3600000; // Same floor the request-time filters use.
  const latest = Date.now() + days * 86400000;
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  let budget = EMS_PAGE_BUDGET;

  for (const month of emsMonths(days)) {
    if (budget <= 0) {
      console.warn('[campusEvents] EMS page budget spent before the window ended', {
        feedUrl,
        days,
        stoppedBefore: month,
      });
      break;
    }

    const first = await emsPage(feedUrl, cookie, month, 1);
    budget--;
    if (!first) continue;
    rows.push(...first.rows);

    // PageCount is per install, not per vendor — Sacred Heart pages by 30 and
    // James Madison by 50 — so the count it reports is the only safe bound.
    const wanted = Math.max(0, first.pageCount - 1);
    const affordable = Math.min(wanted, budget);
    if (affordable > 0) {
      const rest = await Promise.all(
        Array.from({ length: affordable }, (_, i) =>
          emsPage(feedUrl, cookie, month, i + 2).catch(() => null)),
      );
      budget -= affordable;
      for (const page of rest) if (page) rows.push(...page.rows);
    }
    if (wanted > affordable) {
      console.warn('[campusEvents] EMS month truncated', {
        feedUrl,
        month,
        readPages: affordable + 1,
        totalPages: first.pageCount,
      });
    }
  }

  // A month view always starts at the 1st, so the current month arrives with
  // everything already past still in it.
  return emsDedupe(rows.filter((row) => {
    if (row?.Cancel) return false;
    const at = emsMoment(row?.EventDateTime?.EventDateTime);
    return at !== null && at >= earliest && at <= latest;
  }));
}

// deno-lint-ignore no-explicit-any
function normalizeEms(event: any, feedUrl: string): NormalizedEvent {
  const when = event?.EventDateTime || {};
  const at = emsMoment(when.EventDateTime);
  const allDay = Boolean(event?.isAllDay);
  // Their own field, their own typo.
  const minutes = Number(when.EventDuaration);

  // No end when they say there is none, and none invented for an all-day event
  // that lasts a day — a same-date end tells a student nothing.
  let end = '';
  if (at !== null && !event?.NoEndTime && Number.isFinite(minutes) && minutes > 0) {
    if (!allDay) end = emsStamp(at + minutes * 60000, false);
    else if (minutes > 1440) end = emsStamp(at + (minutes - 1) * 60000, true);
  }

  return {
    ...emptyEvent(),
    id: String(event?.Id ?? ''),
    title: plainText(event?.Title),
    description: plainText(event?.Description).slice(0, 600),
    url: emsDetailUrl(feedUrl, event?.Id),
    start: at === null ? '' : emsStamp(at, allDay),
    end,
    all_day: allDay,
    // Building and room arrive concatenated into one name with no separator —
    // "Edgerton Center for the Performing Arts Edgerton Atrium" — so splitting
    // them would be a guess. The whole string is the location and room stays
    // empty.
    location: plainText(event?.Location?.Name),
    address: plainText(event?.Location?.Address),
    types: cleanList([event?.EventTypeName]),
    keywords: typeof event?.EventKeyWords === 'string'
      ? cleanList(event.EventKeyWords.split(','))
      : cleanList(event?.EventKeyWords),
  };
}

/**
 * Every address an EMS install was actually found at.
 *
 * Not guessed: the 1,583 schools the national sweep resolved to nothing were
 * re-probed for all of these on 2026-08-03, and ten of them answered. The
 * hosted tenancy is <label>.emscloudservice.com/calendar and the label was the
 * domain's own on all six that use it — Sacred Heart, Cleveland State, Ohlone,
 * Georgia Highlands, Wisconsin-Green Bay, LeTourneau. The self-hosted four sit
 * on ems., calendar. or events. under /MasterCalendar — James Madison,
 * Shippensburg, Nassau Community, Southern Illinois.
 */
function emsCandidates(domain: string): string[] {
  const label = domainLabel(domain);
  const candidates = ['ems', 'calendar', 'events']
    .map(sub => `https://${sub}.${domain}/MasterCalendar/MasterCalendar.aspx`);
  if (label) {
    candidates.unshift(`https://${label}.emscloudservice.com/calendar/MasterCalendar.aspx`);
  }
  return candidates;
}

/**
 * Does a real month come back from this address?
 *
 * Non-empty, for the reason every probe here insists on it, and checked across
 * the window rather than the current month alone: a school probed in July would
 * otherwise fail on an empty summer and be written off for thirty days.
 */
async function probeEmsAt(feedUrl: string, guard: HopGuard = null): Promise<string | null> {
  let cookie = '';
  try {
    cookie = await emsSession(feedUrl, guard);
  } catch (_) {
    return null;
  }
  if (!cookie) return null;

  for (const month of emsMonths(DEFAULT_DAYS)) {
    let page: { pageCount: number; rows: unknown[] } | null = null;
    try {
      page = await emsPage(feedUrl, cookie, month, 1, guard);
    } catch (_) {
      return null;
    }
    // deno-lint-ignore no-explicit-any
    if (page?.rows.some((row: any) => row?.Title && emsMoment(row?.EventDateTime?.EventDateTime))) {
      return feedUrl;
    }
  }
  return null;
}

/**
 * All four addresses at once, answered in preference order — the same trick
 * `firstValidUrl` plays, and for the same reason. Three of the four are hosts
 * that will not resolve for most schools, and waiting each one out in turn puts
 * three timeouts in front of a student watching a spinner.
 */
async function probeEms(domain: string): Promise<string | null> {
  const attempts = emsCandidates(domain).map(candidate =>
    probeEmsAt(candidate).catch(() => null)
  );
  for (const attempt of attempts) {
    const hit = await attempt;
    if (hit) return hit;
  }
  return null;
}

/** The calendar folder is named by the install, so a discovered host tries both. */
const EMS_PATHS = ['/MasterCalendar/MasterCalendar.aspx', '/calendar/MasterCalendar.aspx'];

/** The pages an EMS install serves, any of which a student may be looking at. */
const EMS_PAGE_NAMES = /^(.*\/)(?:MasterCalendar|EventDetails|RSSFeeds|DateBrowser|Search)\.aspx$/i;

/**
 * The MasterCalendar page behind an address a student pasted, or nothing.
 *
 * Deliberately narrow: it answers only for a URL that already names an EMS page
 * or sits on the vendor's own hosting. Anything looser would spend a session
 * request and a POST on every pasted link in the product, and EMS is the rarest
 * platform this file reads.
 */
export function emsBaseFrom(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (_) {
    return '';
  }

  const named = EMS_PAGE_NAMES.exec(parsed.pathname);
  if (named) return `${parsed.origin}${named[1]}MasterCalendar.aspx`;

  // On the vendor's hosting the folder is whatever the school was given, so the
  // address a student copied out of the browser is the only source for it. A
  // path segment carrying a dot is a file rather than that folder.
  if (!stripWww(parsed.hostname.toLowerCase()).endsWith('emscloudservice.com')) return '';
  const last = parsed.pathname.split('/').pop() || '';
  if (last.includes('.')) return '';
  const folder = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `${parsed.origin}${folder}MasterCalendar.aspx`;
}

const emsAdapter: Adapter = {
  name: 'ems',
  probe: probeEms,
  fetch: fetchEms,
  normalize: normalizeEms,
};

// ── Adapter: iCalendar (.ics) ───────────────────────────────────────────────

/**
 * Plain iCalendar. Not a vendor but a standard, which is exactly why it earns
 * its place: Duke, Boston University, Iowa State, Western and Babson run five
 * different calendar systems and every one of them publishes an .ics.
 *
 * It is last in preference for a reason. iCal carries a title, a time and a
 * place and almost nothing else — no topics, no audience, no event types — so
 * ranking a student's interests against it is weaker than against any of the
 * JSON platforms. A school that has both should be read through the richer one.
 */

const ICS_FEED_TIMEOUT_MS = 12_000; // These are whole-calendar dumps, not pages.
const ICS_MAX_BYTES = 4_000_000;

/**
 * A runaway guard, not a page size.
 *
 * VEVENTs come in the order the calendar felt like writing them, which is not
 * date order — Syracuse publishes 1,506. A cap low enough to bite would
 * therefore throw away the future and keep the past, and the feed would read as
 * empty rather than large. The real bound is ICS_MAX_BYTES; this only stops a
 * pathological file from spinning.
 *
 * This used to also cite Duke as opening on entries from 2007. That was wrong —
 * those dates are in its VTIMEZONE block, not its events. The ordering point
 * stands on its own; the example did not.
 */
const ICS_MAX_EVENTS = 20_000;

/**
 * Longer than the JSON probes get. Those ask for one event; an .ics probe has
 * to pull the entire calendar before it can tell whether the file is one at
 * all. Iowa State's is 197KB of 266 events, and the six seconds a JSON probe
 * runs on lost it outright.
 */
const ICS_PROBE_TIMEOUT_MS = 12_000;

/** Cheap guesses, tried before anything gets read. */
const ICS_PATHS = ['/events.ics', '/calendar.ics', '/webcal', '/ical', '/events/feed/ical'];

/**
 * Off-site hosts allowed to serve a school's calendar.
 *
 * Normally a discovered URL has to sit inside the school's own domain. Google
 * Calendar is the documented exception: plenty of smaller schools embed one
 * rather than run calendar software, and its public .ics is a fixed, readable
 * shape.
 */
/**
 * Hosts that are calendars in their own right, so a school linking one is
 * naming its own calendar rather than sending us somewhere else. Both are
 * reached only by deriving a feed URL from a link the school itself published.
 */
const ICS_VENDOR_HOSTS = ['calendar.google.com', 'calendarwiz.com'];

/**
 * RFC 5545 line folding: a line starting with a space or tab continues the one
 * before it. Unfolding first means a wrapped SUMMARY is one value, not two.
 */
function unfoldIcs(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** iCal escapes commas, semicolons and newlines inside text values. */
function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  url: string;
  categories: string[];
  start: string;
  end: string;
  allDay: boolean;
}

type IcsDateKind = 'utc' | 'local' | 'date';

/**
 * A moment from a calendar, kept as civil fields rather than an instant.
 *
 * `at` is those fields run through Date.UTC — the true instant when the value
 * was UTC, and a bare "what the wall clock said" number when it wasn't.
 *
 * For `local` and `date`, stepping that number is what keeps daylight saving
 * out of recurrence: adding seven days to a wall-clock Tuesday at 5pm lands on
 * a Tuesday at 5pm in March and in November alike, because no offset was ever
 * applied to lose an hour to.
 *
 * For `utc` the same step pins the UTC clock instead, so a series anchored in
 * winter reads an hour late once the campus moves to summer time. That is the
 * RFC's own reading of a UTC-stamped recurrence, it is an hour on the right
 * day, and it is currently theoretical: across 178 live school feeds, all 133
 * repeating events are wall-clock or date-only and not one is UTC-stamped.
 * Correcting it needs the school's timezone, which a `Z` value does not carry.
 */
interface IcsMoment {
  at: number;
  kind: IcsDateKind;
}

/**
 * One DTSTART/DTEND value, as a moment we can both render and step forward.
 *
 * Three forms, three deliberate treatments:
 *
 *   20260803T103000Z    UTC. Converted to a real offset-bearing timestamp.
 *   20260803T103000     Wall-clock, with or without a TZID. Emitted as-is,
 *                       with no offset, exactly as the Trumba adapter already
 *                       does — a student standing on that campus reads the
 *                       clock on the wall, and inventing an offset from a TZID
 *                       we may not hold tz data for is how a listing moves by
 *                       an hour.
 *   20260803            All-day. Emitted date-only and flagged, because
 *                       stamping midnight on it lands the student a day early
 *                       west of Greenwich.
 */
function icsDate(value: string): IcsMoment | null {
  const text = (value || '').trim();

  const utc = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    const at = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    return Number.isFinite(at) ? { at, kind: 'utc' } : null;
  }

  const local = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    const at = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    return Number.isFinite(at) ? { at, kind: 'local' } : null;
  }

  const dateOnly = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    const at = Date.UTC(+y, +mo - 1, +d);
    return Number.isFinite(at) ? { at, kind: 'date' } : null;
  }

  return null;
}

/**
 * iCal is the one feed here that states an all-day end exclusively: RFC 5545
 * writes a one-day event on the 3rd as DTEND 20260804, and the 1st-to-3rd fair
 * as DTEND 20260804 as well. Everywhere else in this file — EMS computes it that
 * way deliberately, and the calendar export adds a day back when it writes its
 * own DTEND — an all-day end names the LAST DAY the event runs.
 *
 * So it is converted once, here, rather than left for each reader to remember.
 * Getting this wrong is not abstract: an exclusive end reaching the export
 * writes a three-day fair into a student's calendar as four days.
 *
 * A one-day event collapses to an end equal to its start, and is dropped here —
 * a same-date end tells a student nothing, which is the rule the EMS adapter
 * already states, and it is what keeps a single day out of a student's calendar
 * as two.
 *
 * Only `date` values move. A timestamped DTEND is already a real closing moment
 * under every reading.
 */
function icsInclusiveEnd(end: IcsMoment | null, start: IcsMoment): IcsMoment | null {
  if (!end || end.kind !== 'date') return end;
  const last = { at: end.at - WHOLE_DAY_MS, kind: 'date' as const };
  return last.at > start.at ? last : null;
}

/** The string the client renders — byte-for-byte what each form came in as. */
function icsMomentValue(moment: IcsMoment | null): string {
  if (!moment) return '';
  const d = new Date(moment.at);
  if (moment.kind === 'utc') return d.toISOString();

  const pad = (n: number) => String(n).padStart(2, '0');
  // The year is padded too. A feed carrying a typo'd year would otherwise
  // render "999-01-01", which no Date parse accepts, so the event is discarded
  // a step later as unreadable rather than shown as the odd date it is.
  const day = `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (moment.kind === 'date') return day;
  return `${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// ── Recurrence ──────────────────────────────────────────────────────────────

/**
 * Repeating events are where a campus calendar keeps the things a student can
 * actually walk into every week — club meetings, office hours, language tables.
 * They were dropped outright until now, which cost us those entirely: a feed of
 * nothing but weekly meetings read to us as an empty calendar.
 *
 * **How much this is worth is measured and modest.** Across the 38 .ics feeds
 * the national sweep resolved, 133 events carry a repeat rule and 11 of them
 * have an upcoming date. It buys nothing at all on Localist, LiveWhale, Campus
 * Labs, Trumba or Drupal, which expand recurrence server-side and hand us dated
 * instances — and those are most schools, and are preferred over .ics anyway.
 * Google-Calendar-backed feeds are the realistic source of event-level repeats.
 *
 * Do not repeat the claim that Duke publishes live weekly entries dated 2007.
 * It was in this file before recurrence existed and it is wrong: Duke's feed
 * has 40 events and zero event-level rules. The 2007 dates are `20070311` and
 * `20071104` inside its VTIMEZONE block — the US daylight-saving change — which
 * is what a grep for DTSTART across the whole file finds.
 *
 * The rule that makes this safe is that we only expand rules we can follow
 * exactly, and drop the rest untouched. A wrong date here is not a cosmetic
 * bug — it walks a student to a room on a day nothing is happening — so
 * anything needing interpretation (BYSETPOS, BYWEEKNO, a rule that disagrees
 * with its own DTSTART, a multi-day week anchored in UTC where the local
 * weekday cannot be known) is treated the way every recurring event used to be.
 */

/**
 * How many future dates one repeating series contributes — the caller's call,
 * because the right answer is genuinely opposite on the two surfaces.
 *
 * A **list** wants one. The picker shows six events and ranks twenty, and both
 * order by date once relevance ties. Measured on the real feeds that carry
 * repeating events: emitting every date let one weekly club take five of the
 * six shown and eighteen of the twenty ranked, the same title over and over,
 * pushing out that many different real things.
 *
 * A **month grid** wants all of them. A club that meets every Tuesday belongs
 * on every Tuesday square; showing it once on a month of dates is as wrong
 * there as showing it six times in a list.
 *
 * So the default is one and the grid asks for more, rather than either surface
 * being quietly served the other's answer.
 */
const RECURRENCE_DEFAULT_DATES = 1;
const RECURRENCE_MAX_DATES = 12;

/** Feeds are read for a window; a rule is only ever walked far enough to fill it. */
const ICS_RECURRENCE_WINDOW_DAYS = 60;

/** A rule that has not produced a usable date in this many tries has stopped. */
const RECURRENCE_MAX_STEPS = 120;

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Parts we can honour exactly. Anything else means the whole rule is dropped. */
const RRULE_KNOWN_PARTS = new Set([
  'FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST',
]);

interface Recurrence {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number;       // 0 — runs forever
  until: number;       // civil ms, or Infinity
  byday: string[];
  bymonthday: number[];
}

/** How a supported rule steps forward, or null when we will not guess. */
type RecurrenceShape = 'stride' | 'weekly-days' | 'monthly-day' | 'monthly-nth';

function parseRrule(value: string): Recurrence | null {
  const rule: Recurrence = {
    freq: 'WEEKLY', interval: 1, count: 0, until: Infinity, byday: [], bymonthday: [],
  };
  let sawFreq = false;

  for (const part of value.split(';')) {
    if (!part.trim()) continue;
    const eq = part.indexOf('=');
    if (eq < 1) return null;

    const name = part.slice(0, eq).trim().toUpperCase();
    const raw = part.slice(eq + 1).trim();
    if (!RRULE_KNOWN_PARTS.has(name)) return null;

    switch (name) {
      case 'FREQ': {
        const freq = raw.toUpperCase();
        if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
        rule.freq = freq;
        sawFreq = true;
        break;
      }
      case 'INTERVAL': {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 52) return null;
        rule.interval = n;
        break;
      }
      case 'COUNT': {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) return null;
        rule.count = n;
        break;
      }
      case 'UNTIL': {
        // UNTIL is normally UTC while a wall-clock series is not, so this can
        // be a few hours out at the very end of a series — never more, and
        // only ever on the last date.
        const bound = icsDate(raw);
        if (!bound) return null;
        rule.until = bound.at;
        break;
      }
      case 'BYDAY':
        rule.byday = raw.split(',').map(d => d.trim().toUpperCase()).filter(Boolean);
        break;
      case 'BYMONTHDAY': {
        const days = raw.split(',').map(d => Number(d.trim()));
        // Negative days ("the last of the month") are a rule we do not follow.
        if (days.some(n => !Number.isInteger(n) || n < 1 || n > 31)) return null;
        rule.bymonthday = days;
        break;
      }
      case 'WKST':
        // Only changes multi-day weeks repeating every other week, which is
        // one of the shapes below that gets dropped anyway.
        break;
    }
  }

  return sawFreq ? rule : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The day of the month the nth given weekday falls on, or 0 if there isn't one. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
  const total = daysInMonth(year, month);
  if (nth > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
    return day <= total ? day : 0;
  }
  const lastDow = new Date(Date.UTC(year, month, total)).getUTCDay();
  const day = total - ((lastDow - weekday + 7) % 7) + (nth + 1) * 7;
  return day >= 1 ? day : 0;
}

/** "1MO", "-1FR" — an ordinal weekday, or null if this isn't one. */
function ordinalWeekday(code: string): { nth: number; weekday: number } | null {
  const m = code.match(/^(-?\d)([A-Z]{2})$/);
  if (!m) return null;
  const nth = Number(m[1]);
  const weekday = WEEKDAY_CODES.indexOf(m[2]);
  if (weekday < 0 || nth === 0 || nth > 5 || nth < -1) return null;
  return { nth, weekday };
}

/**
 * Which of our stepping strategies this rule can be followed by, if any.
 *
 * Every branch that returns null is a rule we could produce a plausible date
 * for and refuse to. The recurring theme: DTSTART is the anchor we trust, and a
 * rule that contradicts it is a rule we do not understand well enough to use.
 */
function recurrenceShape(rule: Recurrence, start: IcsMoment): RecurrenceShape | null {
  const startDate = new Date(start.at);
  const hasOrdinal = rule.byday.some(d => /\d/.test(d));

  switch (rule.freq) {
    case 'DAILY':
      return rule.byday.length || rule.bymonthday.length ? null : 'stride';

    case 'WEEKLY': {
      if (rule.bymonthday.length || hasOrdinal) return null;
      // One weekday is the same statement DTSTART already makes, so stride from
      // DTSTART and never read the weekday. That is what makes this correct for
      // a UTC-stamped evening event, whose UTC weekday is the day after the one
      // the student would call it — and why a disagreement is only worth
      // reading as one on a wall clock, where the two are comparable.
      if (rule.byday.length === 1 && start.kind !== 'utc'
        && rule.byday[0] !== WEEKDAY_CODES[startDate.getUTCDay()]) return null;
      if (rule.byday.length <= 1) return 'stride';
      // Several weekdays in a week means matching weekdays, which we can only
      // do against a wall clock — in UTC the local weekday is unknowable.
      if (start.kind === 'utc' || rule.interval !== 1 || rule.count) return null;
      return rule.byday.every(d => WEEKDAY_CODES.includes(d)) ? 'weekly-days' : null;
    }

    case 'MONTHLY': {
      if (rule.byday.length && rule.bymonthday.length) return null;
      if (rule.byday.length) {
        if (rule.byday.length > 1) return null;
        const ordinal = ordinalWeekday(rule.byday[0]);
        if (!ordinal) return null;
        // The rule has to describe the date DTSTART already gives, or the two
        // disagree and we would be picking a winner.
        if (ordinal.weekday !== startDate.getUTCDay()) return null;
        const own = nthWeekdayOfMonth(
          startDate.getUTCFullYear(), startDate.getUTCMonth(), ordinal.weekday, ordinal.nth,
        );
        return own === startDate.getUTCDate() ? 'monthly-nth' : null;
      }
      if (rule.bymonthday.length > 1) return null;
      if (rule.bymonthday.length && rule.bymonthday[0] !== startDate.getUTCDate()) return null;
      return 'monthly-day';
    }

    case 'YEARLY':
      return rule.byday.length || rule.bymonthday.length ? null : 'stride';
  }

  return null;
}

/** The i-th date of a rule counted from DTSTART, or null where the calendar has none. */
function occurrenceAt(
  start: IcsMoment, rule: Recurrence, shape: RecurrenceShape, i: number,
): number | null {
  const d = new Date(start.at);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const timeOfDay = start.at - midnight;

  if (shape === 'stride') {
    if (rule.freq === 'DAILY') return start.at + i * rule.interval * 86400000;
    if (rule.freq === 'WEEKLY') return start.at + i * rule.interval * 7 * 86400000;
    // YEARLY — a Feb 29 series simply has no date in most years.
    const year = d.getUTCFullYear() + i * rule.interval;
    if (d.getUTCDate() > daysInMonth(year, d.getUTCMonth())) return null;
    return Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) + timeOfDay;
  }

  const monthIndex = d.getUTCMonth() + i * rule.interval;
  const year = d.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;

  if (shape === 'monthly-nth') {
    const ordinal = ordinalWeekday(rule.byday[0]);
    if (!ordinal) return null;
    const day = nthWeekdayOfMonth(year, month, ordinal.weekday, ordinal.nth);
    return day ? Date.UTC(year, month, day) + timeOfDay : null;
  }

  // monthly-day — a series on the 31st skips the months without one.
  const day = d.getUTCDate();
  if (day > daysInMonth(year, month)) return null;
  return Date.UTC(year, month, day) + timeOfDay;
}

/**
 * Roughly how many steps of this rule fit before `target`, never overshooting.
 *
 * Duke's 2007 weekly master is a thousand occurrences from today, and walking
 * them one at a time is the difference between a parse and a hang.
 */
function stepsBefore(start: IcsMoment, rule: Recurrence, shape: RecurrenceShape, target: number): number {
  if (target <= start.at) return 0;
  const elapsed = target - start.at;

  let steps: number;
  if (shape === 'monthly-day' || shape === 'monthly-nth') {
    const from = new Date(start.at);
    const to = new Date(target);
    const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
      + (to.getUTCMonth() - from.getUTCMonth());
    steps = Math.floor(months / rule.interval);
  } else if (rule.freq === 'YEARLY') {
    steps = Math.floor(elapsed / (365.25 * 86400000) / rule.interval);
  } else if (rule.freq === 'WEEKLY') {
    steps = Math.floor(elapsed / (7 * 86400000 * rule.interval));
  } else {
    steps = Math.floor(elapsed / (86400000 * rule.interval));
  }

  return Math.max(0, steps - 1);
}

/**
 * The next dates a repeating event actually lands on, inside the read window.
 *
 * Candidates are tested as the strings they will be emitted as, through the
 * same Date parse the request-time filter uses, so a date that survives here
 * cannot be dropped as stale one step later.
 */
function expandRecurrence(
  start: IcsMoment,
  rule: Recurrence,
  shape: RecurrenceShape,
  skip: Set<number>,
  windowDays: number,
  now: number,
  wanted: number,
): IcsMoment[] {
  const found: IcsMoment[] = [];
  // Exactly the window `stillUpcoming` applies at request time: an hour's grace
  // on a clock, the whole day on a bare day. `start.kind === 'date'` is the same
  // test that sets `allDay` on every occurrence emitted below, so the two agree
  // by construction rather than by coincidence.
  //
  // This floor and those filters have to move together or not at all. Lowering
  // only this one was tried on 2026-08-03 and reverted the same day: the
  // expansion started handing back today's date, the request filter still threw
  // it away as stale, and because callers ask for ONE date per series (see
  // `seriesDates`) the series spent its only slot on a value no student ever
  // saw — a weekly all-day club went from a wrong date to nothing at all.
  // Measured across all 38 real school feeds: 5 upcoming listings lost over 28
  // days, none gained. If you change either number, change both.
  const earliest = now - (start.kind === 'date' ? WHOLE_DAY_MS : STARTED_GRACE_MS);
  const latest = now + windowDays * 86400000;

  const take = (at: number): boolean => {
    // A date arithmetic can no longer represent is the end of this series, not
    // a thrown RangeError out of toISOString and a feed that reads as broken.
    if (!Number.isFinite(at) || Math.abs(at) > 8.64e15) return false;
    if (at > rule.until) return false;
    if (skip.has(at)) return true;
    const rendered = new Date(icsMomentValue({ at, kind: start.kind })).getTime();
    if (!Number.isFinite(rendered) || rendered > latest) return false;
    if (rendered >= earliest) found.push({ at, kind: start.kind });
    return found.length < wanted;
  };

  if (shape === 'weekly-days') {
    // Wall-clock only, every week, so whole weeks can be skipped and the
    // remainder walked a day at a time against the weekday list.
    const wanted = new Set(rule.byday.map(d => WEEKDAY_CODES.indexOf(d)));
    const weeks = Math.max(0, Math.floor((earliest - start.at) / (7 * 86400000)) - 1);
    let at = start.at + weeks * 7 * 86400000;
    for (let step = 0; step <= windowDays + 14; step++, at += 86400000) {
      if (!wanted.has(new Date(at).getUTCDay())) continue;
      if (!take(at)) break;
    }
    return found;
  }

  const first = stepsBefore(start, rule, shape, earliest);
  let misses = 0;
  for (let i = first; !rule.count || i < rule.count; i++) {
    const at = occurrenceAt(start, rule, shape, i);
    if (at === null) {
      if (++misses > RECURRENCE_MAX_STEPS) break;
      continue;
    }
    misses = 0;
    if (!take(at)) break;
    if (i - first > RECURRENCE_MAX_STEPS) break;
  }

  return found;
}

// ── Reading the file ────────────────────────────────────────────────────────

/** One VEVENT's properties. Repeatable ones (EXDATE) keep every line. */
interface IcsRecord {
  props: Record<string, string>;
  exdates: string[];
}

function collectVevents(text: string): IcsRecord[] {
  const records: IcsRecord[] = [];
  let current: IcsRecord | null = null;

  for (const line of unfoldIcs(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = { props: {}, exdates: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) records.push(current);
      current = null;
      if (records.length >= ICS_MAX_EVENTS) break;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon < 1) continue;
    // "DTSTART;TZID=America/New_York" -> name DTSTART, params discarded.
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);

    if (name === 'EXDATE') current.exdates.push(value);
    else if (!(name in current.props)) current.props[name] = value;
  }

  return records;
}

/**
 * A calendar telling us about itself, rather than about an event.
 *
 * Deliberately narrow. This drops real rows out of a student's calendar, so it
 * matches the vendor notices actually observed and nothing that merely reads
 * like a warning — a genuine campus event can quite reasonably be titled
 * "Warning signs of burnout".
 */
export function isFeedStatusNotice(summary: string): boolean {
  const text = String(summary || '').trim().toLowerCase();
  return text === 'warning: ical feeds disabled' ||
    text === 'warning: ical feed disabled' ||
    text === 'ical feeds are disabled';
}

/**
 * Every VEVENT in a calendar, minus the ones we cannot date honestly.
 *
 * A repeating event contributes its next `seriesDates` real dates; a rule we
 * cannot follow exactly still contributes nothing at all.
 *
 * `windowDays` bounds how far a rule is walked and nothing else — a one-off
 * event is read the same whatever it is set to.
 */
export function parseIcsEvents(
  text: string,
  windowDays: number = ICS_RECURRENCE_WINDOW_DAYS,
  seriesDates: number = RECURRENCE_DEFAULT_DATES,
): IcsEvent[] {
  const wanted = Math.min(Math.max(Math.floor(seriesDates) || 1, 1), RECURRENCE_MAX_DATES);
  const records = collectVevents(text);
  const now = Date.now();

  // A VEVENT carrying RECURRENCE-ID is one instance of a series pulled out and
  // rewritten — moved, renamed or cancelled. It is emitted on its own terms
  // below, and its original slot has to come off the master, or the series
  // re-announces the meeting at the time it was moved away from.
  const overridden = new Map<string, IcsMoment[]>();
  for (const record of records) {
    const uid = record.props.UID;
    const instance = uid ? icsDate(record.props['RECURRENCE-ID'] || '') : null;
    if (!uid || !instance) continue;
    if (!overridden.has(uid)) overridden.set(uid, []);
    overridden.get(uid)!.push(instance);
  }

  const events: IcsEvent[] = [];

  for (const record of records) {
    const props = record.props;
    const start = icsDate(props.DTSTART || '');
    if (!start) continue;

    // Some calendars answer a disabled export with a well-formed VEVENT whose
    // only job is to say the export is disabled. Randolph Community College's
    // CalendarWiz returns exactly one event, today, titled "Warning: iCal feeds
    // disabled" — so the feed parses, validates, and puts a fake event in front
    // of a student. A status message dressed as an event is worse than an empty
    // calendar, because nothing downstream can tell it is not real.
    if (isFeedStatusNotice(props.SUMMARY || '')) continue;

    // A cancelled event is the one thing worse than no event: the student goes.
    // Every other adapter already drops these — Localist by `is_canceled`,
    // LiveWhale by `canceled`, Campus Labs by requiring "Approved" — and iCal
    // was the only one still handing them through.
    if ((props.STATUS || '').trim().toUpperCase() === 'CANCELLED') continue;

    const end = icsInclusiveEnd(icsDate(props.DTEND || ''), start);
    const base = {
      uid: props.UID || '',
      summary: unescapeIcsText(props.SUMMARY || ''),
      description: unescapeIcsText(props.DESCRIPTION || ''),
      location: unescapeIcsText(props.LOCATION || ''),
      url: props.URL || '',
      categories: (props.CATEGORIES || '')
        .split(',')
        .map(c => unescapeIcsText(c).trim())
        .filter(Boolean),
    };

    if (!props.RRULE) {
      events.push({
        ...base,
        start: icsMomentValue(start),
        end: icsMomentValue(end),
        allDay: start.kind === 'date',
      });
      continue;
    }

    const rule = parseRrule(props.RRULE);
    const shape = rule && recurrenceShape(rule, start);
    if (!rule || !shape) continue;

    // An exclusion says a date is NOT happening, so failing to apply one is the
    // same harm as inventing a date. Both forms are compared as raw civil
    // numbers, which only means anything when they were written the same way —
    // so a mismatched form drops the series rather than quietly ignoring the
    // exclusion and announcing a meeting that was cancelled or moved.
    const exclusions: IcsMoment[] = [...(overridden.get(base.uid) || [])];
    for (const line of record.exdates) {
      for (const value of line.split(',')) {
        const excluded = icsDate(value);
        if (excluded) exclusions.push(excluded);
      }
    }
    if (exclusions.some(e => e.kind !== start.kind)) continue;
    const skip = new Set<number>(exclusions.map(e => e.at));

    // Only a duration we can trust: an end read in a different form than its
    // start is not one we can carry across occurrences.
    const duration = end && end.kind === start.kind && end.at > start.at ? end.at - start.at : 0;

    for (const occurrence of expandRecurrence(start, rule, shape, skip, windowDays, now, wanted)) {
      events.push({
        ...base,
        // RFC identity for one date of a series is its UID plus that date, and
        // the client needs them distinct — it keys and stores events by id.
        uid: base.uid ? `${base.uid}-${icsMomentValue(occurrence)}` : '',
        start: icsMomentValue(occurrence),
        end: duration ? icsMomentValue({ at: occurrence.at + duration, kind: end!.kind }) : '',
        allDay: start.kind === 'date',
      });
    }
  }

  return events;
}

/**
 * A calendar is only useful to us if it still has something ahead of today.
 *
 * Not a fourth copy of `stillUpcoming` — this decides whether a whole feed is
 * worth keeping, not whether one listing is shown, so it is deliberately the
 * looser test: a day's grace on everything, timed events included. It already
 * accepts an all-day event happening today (its UTC midnight is inside the
 * day), so the all-day window costs it nothing, and tightening it to the
 * per-listing rule could only throw away a school we can read.
 */
export function looksLikeIcal(text: unknown): boolean {
  if (typeof text !== 'string' || !text.includes('BEGIN:VCALENDAR')) return false;
  const events = parseIcsEvents(text);
  if (!events.length) return false;
  const cutoff = Date.now() - 86400000;
  return events.some((e) => {
    const at = new Date(e.start).getTime();
    return Number.isFinite(at) && at >= cutoff;
  });
}

async function fetchIcsOnce(
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
  guard: HopGuard = null,
): Promise<string> {
  const res = await guardedFetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  }, guard);
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {});
    return '';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let text = '';
  try {
    while (text.length < ICS_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return text;
}

/**
 * Fetch a calendar, trying both client identities before believing a refusal.
 *
 * Schools disagree about who is allowed to read a public feed, and they
 * disagree in both directions. Villanova and Tufts answer a plain Deno request
 * with 403 and serve a browser fine. Iowa State does the exact opposite: its
 * WAF returns a 200 carrying a 247-byte "Request Rejected" page to the browser
 * user-agent, and hands over all 266 events to a default one — which is the
 * more honest exchange anyway, since an .ics is published for calendar clients
 * and not for browsers.
 *
 * So neither identity can be the only one tried. A response that is not a
 * calendar is retried under the other, and only then treated as a miss. Both
 * requests are ordinary public GETs for a feed the school publishes to be
 * subscribed to.
 */
async function fetchIcsText(url: string, timeoutMs: number, guard: HopGuard = null): Promise<string> {
  const attempts: Record<string, string>[] = [
    { Accept: 'text/calendar,text/plain,*/*' },
    { Accept: 'text/calendar,text/plain,*/*', 'User-Agent': BROWSER_UA },
  ];
  for (const headers of attempts) {
    let text = '';
    try {
      text = await fetchIcsOnce(url, timeoutMs, headers, guard);
    } catch (_) {
      continue; // Unreachable or timed out under this identity; try the other.
    }
    if (text.includes('BEGIN:VCALENDAR')) return text;
  }
  return '';
}

/** webcal:// is http's calendar-shaped twin; nothing else about it differs. */
export function normalizeIcsUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://');
}

/**
 * A Google Calendar embed names the same calendar its .ics does.
 *
 * Schools too small to run calendar software very often just drop a Google
 * Calendar iframe on the page. The embed's `src` is the calendar id, and the
 * public .ics for that id is a fixed rewrite of it — no guessing involved, and
 * it fails closed if the calendar was never shared publicly.
 */
export function googleCalendarIcsFrom(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    if (stripWww(url.hostname.toLowerCase()) !== 'calendar.google.com') return '';
    if (!url.pathname.includes('/embed')) return '';
    const src = url.searchParams.get('src');
    if (!src) return '';
    return `https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`;
  } catch (_) {
    return '';
  }
}

/**
 * CalendarWiz embeds an iframe keyed by a slug, and publishes that same
 * calendar as plain iCal. Arkansas State Beebe's holds 297 future events, and
 * the slug — the only unknown — is stated on the school's own events page.
 *
 * The capitalisation is not a style choice. `CalendarWiz_iCal.php` is the only
 * spelling that answers; the all-lowercase path 404s.
 */
export function calendarWizIcsFrom(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    if (stripWww(url.hostname.toLowerCase()) !== 'calendarwiz.com') return '';
    const slug = url.searchParams.get('crd');
    // The slug goes into a URL we then fetch, so it is checked rather than
    // trusted: this string came off a page we do not control.
    if (!slug || !/^[A-Za-z0-9_-]{1,64}$/.test(slug)) return '';
    return `https://www.calendarwiz.com/CalendarWiz_iCal.php?crd=${slug}`;
  } catch (_) {
    return '';
  }
}

/** Is this .ics URL one the school itself is entitled to point us at? */
export function isAllowedIcsUrl(url: string, domain: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(normalizeIcsUrl(url));
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  // This URL came off a remote page and is about to be fetched server-side.
  // Same-site is not enough on its own: a school's own domain can also cover
  // internal hosts, and an explicit port would turn calendar discovery into a
  // way to knock on them. Calendars are served on the default port.
  if (parsed.port) return false;
  const host = stripWww(parsed.hostname.toLowerCase());
  if (ICS_VENDOR_HOSTS.includes(host)) return true;
  return isProbeableDomain(host) && sameSite(host, domain);
}

/**
 * Every calendar subscription link a page points at, in the order it names them.
 *
 * The file extension is not a reliable tell. Boston University's whole
 * university calendar is served from /phpbin/calendar/ical.php, and matching
 * only on ".ics" walks straight past it — so a path segment of "ical" counts
 * too, as does the rel=alternate link tag that exists precisely to advertise
 * this.
 */
export function icsLinksFrom(html: string, domain: string, baseUrl = ''): string[] {
  const found: string[] = [];
  const patterns = [
    /(?:href|src)\s*=\s*["']([^"']+?\.ics(?:\?[^"']*)?)["']/gi,
    /(webcal:\/\/[^\s"'<>]+)/gi,
    /<link[^>]+type\s*=\s*["']text\/calendar["'][^>]*?href\s*=\s*["']([^"']+)["']/gi,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*?type\s*=\s*["']text\/calendar["']/gi,
    /(?:href|src)\s*=\s*["']([^"']*\/ical(?:\.php|\.aspx|\.cgi)?(?:\?[^"']*)?)["']/gi,
    // A bare absolute .ics anywhere in the markup. Portals hand the URL to a
    // script rather than putting it in an href — Babson's subscribe link never
    // appears as one — and the same-site check below is what keeps this safe.
    /(https?:\/\/[^\s"'<>]+?\.ics)\b/gi,
    /["'](https?:\/\/calendar\.google\.com\/calendar\/ical\/[^\s"'<>]+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      // Subscribe links are routinely relative ("/phpbin/calendar/ical.php"),
      // so they are resolved against the page that named them before the
      // same-site check — which is what makes that check mean anything.
      let url = normalizeIcsUrl(decodeEntities(match[1]));
      if (baseUrl && !/^https?:\/\//i.test(url)) {
        try {
          url = new URL(url, baseUrl).toString();
        } catch (_) {
          continue;
        }
      }
      if (!isAllowedIcsUrl(url, domain) || found.includes(url)) continue;
      found.push(url);
      if (found.length >= 8) return found;
    }
  }

  for (const match of html.matchAll(/["'](https?:\/\/calendar\.google\.com\/calendar\/embed\?[^"'<>]+)["']/gi)) {
    const ics = googleCalendarIcsFrom(decodeEntities(match[1]));
    if (ics && !found.includes(ics)) {
      found.push(ics);
      if (found.length >= 8) return found;
    }
  }

  // Same shape of trick for CalendarWiz: the page embeds the viewer, and the
  // viewer's slug is also the key to a plain iCal export.
  for (const match of html.matchAll(/["'](https?:\/\/(?:www\.)?calendarwiz\.com\/[^"'<>]*crd=[^"'<>]+)["']/gi)) {
    const ics = calendarWizIcsFrom(decodeEntities(match[1]));
    if (ics && !found.includes(ics)) {
      found.push(ics);
      if (found.length >= 8) return found;
    }
  }

  return found;
}

/** First candidate that parses as a calendar with something still ahead. */
async function firstValidIcs(candidates: string[], guard: HopGuard = null): Promise<string | null> {
  const attempts = candidates.map(async (url) => {
    try {
      return looksLikeIcal(await fetchIcsText(url, ICS_PROBE_TIMEOUT_MS, guard));
    } catch (_) {
      return false;
    }
  });
  for (let i = 0; i < attempts.length; i++) {
    if (await attempts[i]) return candidates[i];
  }
  return null;
}

/** Guessable .ics locations only. Discovered ones come via probeCalendar. */
async function probeIcalGuesses(domain: string): Promise<string | null> {
  const candidates: string[] = [];
  for (const sub of SUBDOMAIN_CANDIDATES) {
    for (const path of ICS_PATHS) candidates.push(`https://${sub}.${domain}${path}`);
  }
  return await firstValidIcs(candidates);
}

async function fetchIcal(feedUrl: string, days: number, seriesDates?: number) {
  const text = await fetchIcsText(feedUrl, ICS_FEED_TIMEOUT_MS);
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Calendar feed returned an unexpected shape');
  }
  return parseIcsEvents(text, days, seriesDates).filter(e => withinWindow(e.start, days));
}

// deno-lint-ignore no-explicit-any
function normalizeIcal(event: any): NormalizedEvent {
  return {
    ...emptyEvent(),
    id: String(event.uid || `${event.start}-${event.summary}`),
    title: plainText(event.summary),
    description: plainText(event.description).slice(0, 600),
    url: cleanUrl(event.url),
    start: event.start || '',
    end: event.end || '',
    all_day: Boolean(event.allDay),
    location: plainText(event.location),
    keywords: cleanList(event.categories),
  };
}

const icalAdapter: Adapter = {
  name: 'ical',
  probe: probeIcalGuesses,
  fetch: fetchIcal,
  normalize: normalizeIcal,
};

// ── Adapter: The Events Calendar (WordPress) ────────────────────────────────

/**
 * "The Events Calendar" is a WordPress plugin rather than a campus product,
 * which is exactly why it turns up: a school with no calendar budget installs
 * the same plugin a bakery would. It ships a REST route that returns proper
 * structured events, so it is read through that and not through the page.
 *
 * Worth having over the plugin's .ics export because the JSON carries venue,
 * categories and tags, and those are what the ranking pass actually matches a
 * student's interests against.
 */

const TRIBE_PATH = '/wp-json/tribe/events/v1/events';

/**
 * The plugin answered in its own shape, whether or not this window holds
 * anything.
 *
 * Kept apart from `looksLikeTribe` because the two questions are asked at
 * different moments and only one of them is about coverage. Probing has to
 * insist on a real event — an empty feed is a miss, deliberately. Fetching does
 * not: by then the school is already known to run the plugin, and a date window
 * with nothing in it is an ordinary quiet fortnight, not a broken feed.
 *
 * Conflating them cost a real school. Connors State publishes one future event;
 * the probe found it, then the windowed fetch came back `{"events":[]}` and
 * threw, so the school read as broken rather than as quiet.
 */
export function isTribeShape(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return Array.isArray((payload as Record<string, unknown>).events);
}

/** Events with a real start_date, not merely a 200 from some other plugin. */
export function looksLikeTribe(payload: unknown): boolean {
  if (!isTribeShape(payload)) return false;
  const events = (payload as Record<string, unknown>).events as unknown[];
  if (!events.length) return false;
  // deno-lint-ignore no-explicit-any
  const first = events[0] as any;
  return Boolean(
    first && typeof first === 'object' &&
    typeof first.title === 'string' &&
    typeof first.start_date === 'string' && first.start_date.length >= 10,
  );
}

async function probeTribe(domain: string): Promise<string | null> {
  // www first: a WordPress site that answers on the apex usually redirects
  // there anyway, and Tiffin only answers on www.
  const hosts = [`www.${domain}`, domain, ...SUBDOMAIN_CANDIDATES.map(s => `${s}.${domain}`)];
  const hit = await firstValidUrl(
    hosts.map(h => `https://${h}${TRIBE_PATH}?per_page=1`),
    looksLikeTribe,
  );
  return hit ? hit.split('?')[0] : null;
}

async function fetchTribe(feedUrl: string, days: number) {
  const start = new Date();
  const end = new Date(Date.now() + days * 86400000);
  const url = `${feedUrl}?per_page=50&start_date=${start.toISOString().slice(0, 10)}` +
    `&end_date=${end.toISOString().slice(0, 10)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!isTribeShape(body)) throw new Error('Calendar feed returned an unexpected shape');
  // deno-lint-ignore no-explicit-any
  return (body.events as any[]).filter(e => e && withinWindow(tribeDate(e.start_date), days));
}

/**
 * "2026-08-03 14:00:00" -> "2026-08-03T14:00:00".
 *
 * The plugin reports the site's local wall-clock with no zone, and that is
 * kept rather than resolved, the same as Trumba and iCal. A student on that
 * campus reads the clock on the wall.
 */
function tribeDate(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(' ', 'T');
}

// deno-lint-ignore no-explicit-any
function normalizeTribe(event: any): NormalizedEvent {
  const venue = event.venue && typeof event.venue === 'object' ? event.venue : {};
  return {
    ...emptyEvent(),
    id: String(event.id ?? event.global_id ?? ''),
    title: plainText(event.title),
    description: plainText(event.description || event.excerpt).slice(0, 600),
    url: cleanUrl(event.url),
    start: tribeDate(event.start_date),
    end: tribeDate(event.end_date),
    all_day: Boolean(event.all_day),
    location: plainText(venue.venue),
    address: plainText(venue.address),
    // The Events Calendar writes an empty cost string for a free event and a
    // price for a paid one. Absent means the field was never filled in.
    is_free: event.cost === '' ? true
      : event.cost ? false
      : typeof event.is_free === 'boolean' ? event.is_free
      : null,
    ticket_url: cleanUrl(event.website),
    // deno-lint-ignore no-explicit-any
    types: cleanList((event.categories || []).map((c: any) => c?.name)),
    // deno-lint-ignore no-explicit-any
    keywords: cleanList((event.tags || []).map((t: any) => t?.name)),
  };
}

const tribeAdapter: Adapter = {
  name: 'wptribe',
  probe: probeTribe,
  fetch: fetchTribe,
  normalize: normalizeTribe,
};

// ── Adapter: Drupal JSON:API ────────────────────────────────────────────────

/**
 * Drupal runs a very large share of .edu sites, and its JSON:API module hands
 * back the school's own Event content type as typed data. Cooper Union and
 * Arizona State both publish this way and neither runs a calendar vendor at
 * all, so without this they read as having no calendar.
 *
 * Nothing here is guessed from prose. The resource type is read out of the
 * site's own /jsonapi index rather than assembled from a pattern, because the
 * type name is the school's choice — Cooper's is "node--event", Arizona
 * State's is "node--asu_event". The start time is then taken only from a field
 * the site itself typed as a date, and a node without one is dropped rather
 * than dated from something nearby.
 */

const DRUPAL_INDEX = '/jsonapi';
const DRUPAL_MAX_TYPES = 3;

/**
 * Field names Drupal sites actually use for when an event happens.
 *
 * Order is priority: an explicit start beats a range, which beats a bare date.
 * A field outside this list is never read as a time, however date-like its
 * contents look — that is the line between reading a typed field and guessing.
 */
const DRUPAL_DATE_FIELDS = [
  'field_event_date',
  'field_date_range',
  'field_start_date',
  'field_event_start',
  'field_when',
  'field_date',
  'field_dates',
];

/**
 * An ISO-8601 instant, which is the only thing accepted as an event's start.
 *
 * Drupal presents the same field three ways depending on how the site set it
 * up: a bare string, a `{value}` object, or — for anything multi-value or a
 * date range — an array of those. Cooper Union's is
 * `[{value, end_value}]`, so unwrapping one layer short reads every event as
 * undated.
 */
function drupalDate(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  const raw = first && typeof first === 'object'
    ? (first as Record<string, unknown>).value
    : first;
  const text = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(text) ? text.replace(' ', 'T') : '';
}

// deno-lint-ignore no-explicit-any
function drupalStart(attributes: any): string {
  if (!attributes || typeof attributes !== 'object') return '';
  for (const field of DRUPAL_DATE_FIELDS) {
    const found = drupalDate(attributes[field]);
    if (found) return found;
  }
  return '';
}

/** A JSON:API collection of nodes, at least one of which is a dated event. */
export function looksLikeDrupalEvents(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data) || !data.length) return false;
  // deno-lint-ignore no-explicit-any
  return data.some((node: any) =>
    node?.attributes && typeof node.attributes.title === 'string' && drupalStart(node.attributes)
  );
}

/**
 * Event collections the site advertises, straight out of its own index.
 *
 * Only types whose name contains "event" are considered, and only three of
 * them, so this cannot wander into the rest of a school's content model.
 */
async function drupalEventEndpoints(host: string): Promise<string[]> {
  let payload: unknown;
  try {
    payload = await probeJson(`https://${host}${DRUPAL_INDEX}`);
  } catch (_) {
    return [];
  }
  const links = (payload as Record<string, any>)?.links;
  if (!links || typeof links !== 'object') return [];

  const found: string[] = [];
  for (const [name, link] of Object.entries(links)) {
    if (!/^node--.*event/i.test(name)) continue;
    const href = typeof link === 'string' ? link : (link as Record<string, unknown>)?.href;
    const url = cleanUrl(href);
    // The index is the school's own document, but it is still a remote one, so
    // the URL it names has to sit on the host we asked.
    if (!url) continue;
    try {
      if (stripWww(new URL(url).hostname.toLowerCase()) !== stripWww(host)) continue;
    } catch (_) {
      continue;
    }
    found.push(url);
    if (found.length >= DRUPAL_MAX_TYPES) break;
  }
  return found;
}

async function probeDrupal(domain: string): Promise<string | null> {
  const hosts = [`www.${domain}`, domain, ...SUBDOMAIN_CANDIDATES.map(s => `${s}.${domain}`)];
  for (const host of hosts) {
    const endpoints = await drupalEventEndpoints(host);
    if (!endpoints.length) continue;
    const hit = await firstValidUrl(
      endpoints.map(e => `${e}?page[limit]=5`),
      looksLikeDrupalEvents,
    );
    if (hit) return hit.split('?')[0];
  }
  return null;
}

async function fetchDrupal(feedUrl: string, days: number) {
  const res = await fetch(`${feedUrl}?page[limit]=50&sort=-created`, {
    headers: { Accept: 'application/vnd.api+json,application/json' },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const body = await res.json();
  if (!looksLikeDrupalEvents(body)) throw new Error('Calendar feed returned an unexpected shape');
  // deno-lint-ignore no-explicit-any
  return (body.data as any[]).filter((node) => {
    const start = drupalStart(node?.attributes);
    return start && withinWindow(start, days);
  });
}

// deno-lint-ignore no-explicit-any
function normalizeDrupal(event: any, feedUrl: string): NormalizedEvent {
  const attributes = event?.attributes || {};
  let url = '';
  try {
    const alias = attributes.path?.alias;
    if (alias) url = new URL(alias, new URL(feedUrl).origin).toString();
  } catch (_) {
    url = '';
  }
  return {
    ...emptyEvent(),
    id: String(event?.id || ''),
    title: plainText(attributes.title),
    description: plainText(
      attributes.body?.summary || attributes.body?.processed || attributes.body?.value,
    ).slice(0, 600),
    url,
    start: drupalStart(attributes),
    location: plainText(attributes.field_location || attributes.field_place),
  };
}

const drupalAdapter: Adapter = {
  name: 'drupal',
  probe: probeDrupal,
  fetch: fetchDrupal,
  normalize: normalizeDrupal,
};

// ── Adapter: RSS 1.0 with the event module ──────────────────────────────────

/**
 * RSS 1.0 (RDF) carrying the `ev:` event module. A real calendar, in a format
 * that is not RSS 2.0 with extra tags: it is a different document shape, and
 * every way an RSS 2.0 reader gets it wrong is silent.
 *
 * Ohio State is why this exists. Their university-wide events page is an
 * infinite redirect loop under every client identity we have, and the only
 * machine-readable calendar they publish is the Office of Student Life one at
 * activities.osu.edu. Two of our own students attend, and until this adapter
 * existed their row was switched off, because the alternative on offer was
 * Oregon State's calendar.
 *
 * The three structural differences, all of which return zero events rather
 * than an error:
 *
 * - The root element is `rdf:RDF`, not `rss`.
 * - `item` elements are SIBLINGS of `channel`, not children of it. A reader
 *   that descends into `channel` looking for items finds none, and a school
 *   with a full calendar reads as a school with an empty one.
 * - When the event happens is not in the item under any RSS 2.0 name. The
 *   event module carries it, and `pubDate` is when somebody typed the listing
 *   in. Reading `pubDate` as the start would date every event to its data
 *   entry day, which is precisely the misread date this whole function exists
 *   to avoid.
 *
 * The module's prefix is read out of the document's own namespace
 * declarations. A prefix is a local choice and nothing more: a feed binding
 * `http://purl.org/rss/1.0/modules/event/` to "event" or "evt" is exactly as
 * correct as one binding it to "ev", and hardcoding the letters would read
 * that feed as having no dates at all. A document that declares the module
 * nowhere has no event dates in it and is refused, rather than fished for
 * something date-shaped.
 *
 * ## Timezones
 *
 * Ohio State stamps a real UTC offset on every value ("2026-08-16T15:00:00
 * -04:00", Eastern with daylight saving already applied). That is an
 * unambiguous instant, so it is passed through exactly as published and
 * nothing is converted, shifted or re-stamped.
 *
 * A value with no offset is campus wall-clock and is passed through
 * unresolved, the same as Trumba, WordPress and a `TZID` in an .ics. A student
 * standing on that campus reads the clock on the wall, and synthesising an
 * offset from tz data we may not hold moves a listing by an hour.
 *
 * A bare `YYYY-MM-DD` stays date-only and is marked all-day. The event module
 * has no all-day flag, and stamping midnight on a bare day shows it a day
 * early anywhere west of Greenwich.
 */

/** The namespaces this reads. Prefixes for all of them come from the document. */
const RSS1_RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RSS1_CORE_NS = 'http://purl.org/rss/1.0/';
const RSS1_EVENT_NS = 'http://purl.org/rss/1.0/modules/event/';
const RSS1_CONTENT_NS = 'http://purl.org/rss/1.0/modules/content/';
const RSS1_DC_NS = 'http://purl.org/dc/elements/1.1/';

const RSS1_FEED_TIMEOUT_MS = 12_000;
/** Same budget as an .ics probe: this pulls a whole calendar before it can judge it. */
const RSS1_PROBE_TIMEOUT_MS = 12_000;
const RSS1_MAX_BYTES = 2_000_000;

/**
 * A runaway guard, not a page size.
 *
 * Nothing here pages: an RSS 1.0 feed is whatever the publisher chose to put in
 * one document, and Ohio State's is a fixed 50 items whatever you ask it for.
 * The cap is only so a pathological file cannot spin, and it is set far above
 * any real feed so that it can never be the thing that decides what a student
 * is shown.
 */
const RSS1_MAX_ITEMS = 5_000;

/** How much of a page to read while looking for a feed link. */
const RSS1_HTML_SCAN_BYTES = 500_000;
/** Feed links worth validating off one school. Each costs a whole-document read. */
const RSS1_MAX_FEED_LINKS = 4;

/** Namespace URIs compare without case or a trailing slash, and nothing else. */
function rss1Namespace(uri: unknown): string {
  return String(uri || '').trim().toLowerCase().replace(/\/+$/, '');
}

/** A literal used inside a built pattern has to stay a literal. */
function rss1Escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every prefix this document binds to one namespace, in declaration order.
 *
 * More than one is legal and does happen, so this answers with all of them
 * rather than the first: a feed that declares both `ev:` and `event:` and uses
 * the second one on half its items is well-formed, and reading only the first
 * would drop those items.
 */
export function rss1Prefixes(xml: unknown, namespace: string): string[] {
  const want = rss1Namespace(namespace);
  const found: string[] = [];
  const declarations = /xmlns:([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*["']([^"']*)["']/g;
  for (const match of String(xml || '').matchAll(declarations)) {
    if (rss1Namespace(match[2]) !== want) continue;
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** Is this namespace the document's default, so its elements carry no prefix? */
function rss1IsDefault(xml: string, namespace: string): boolean {
  const match = /xmlns\s*=\s*["']([^"']*)["']/.exec(xml);
  return Boolean(match && rss1Namespace(match[1]) === rss1Namespace(namespace));
}

/**
 * Every spelling one element name can have in this document.
 *
 * A module element is only ever read under a prefix the document actually
 * bound, or bare when the module is the default namespace. There is no fallback
 * to the conventional prefix: an undeclared module is a module the feed is not
 * using, and guessing at it would be reading a tag whose meaning nobody stated.
 */
function rss1ModuleNames(xml: string, namespace: string, local: string): string[] {
  const names = rss1Prefixes(xml, namespace).map(prefix => `${prefix}:${local}`);
  if (rss1IsDefault(xml, namespace)) names.push(local);
  return names;
}

/**
 * The same, for RSS 1.0's own elements, which are bare in every real feed
 * because the core namespace is conventionally the default one.
 *
 * The bare name is accepted whether or not the default namespace was declared.
 * An `<item>` inside an RDF document is the RSS item under any reading, and a
 * feed that forgets the declaration is untidy rather than ambiguous.
 */
function rss1CoreNames(xml: string, local: string): string[] {
  const names = rss1Prefixes(xml, RSS1_CORE_NS).map(prefix => `${prefix}:${local}`);
  names.push(local);
  return names;
}

/** The whole of each element with one of these names, outermost text first. */
function rss1Blocks(xml: string, names: string[]): string[] {
  if (!names.length) return [];
  const alt = names.map(rss1Escape).join('|');
  const pattern = new RegExp(`<(${alt})(?:\\s[^>]*)?>([\\s\\S]*?)</\\1\\s*>`, 'gi');
  return [...xml.matchAll(pattern)].map(match => match[0]);
}

/** The text of every element with one of these names, CDATA unwrapped. */
function rss1Values(xml: string, names: string[]): string[] {
  if (!names.length) return [];
  const alt = names.map(rss1Escape).join('|');
  const pattern = new RegExp(
    `<(?:${alt})(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:${alt})\\s*>)`,
    'gi',
  );
  const found: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    const raw = (match[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    if (raw) found.push(raw);
  }
  return found;
}

/** The first, or an empty string. */
function rss1Value(xml: string, names: string[]): string {
  return rss1Values(xml, names)[0] || '';
}

/** "2026-08-16" with nothing after it. There is no clock anywhere in that. */
const RSS1_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601, which is what the event module specifies. Anything else is refused. */
const RSS1_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * One event-module date, kept exactly as strong as the feed wrote it.
 *
 * An offset survives verbatim, a missing offset stays missing, and a bare day
 * stays a bare day. The one liberty taken is spelling: a space instead of the
 * `T`, and `+0400` for `+04:00`, are both written in the wild and both mean
 * one thing. A value this cannot read at all returns empty, and the item is
 * dropped rather than dated from something nearby.
 */
export function rss1Date(value: unknown): { value: string; allDay: boolean } {
  const text = decodeEntities(String(value ?? '')).trim();
  if (!text) return { value: '', allDay: false };
  if (RSS1_DATE_ONLY.test(text)) return { value: text, allDay: true };
  const match = RSS1_TIMESTAMP.exec(text);
  if (!match) return { value: '', allDay: false };
  const zone = (match[3] || '').toUpperCase().replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  return { value: `${match[1]}T${match[2]}${zone}`, allDay: false };
}

interface Rss1Event {
  id: string;
  title: string;
  url: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  description: string;
  subjects: string[];
  types: string[];
}

/**
 * Is this an RDF document that declares the event module?
 *
 * Both halves matter. The RDF root is what separates RSS 1.0 from the RSS 2.0
 * and Atom feeds every school also publishes, and the event module is what
 * separates a calendar from a news feed. A school's press releases parsed as
 * events would be dated from whatever we chose to read, which is the failure
 * this refuses outright.
 */
export function isRss1Document(text: unknown): boolean {
  if (typeof text !== 'string' || !text) return false;
  const head = text.slice(0, 4000);
  if (!/<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?RDF[\s>]/i.test(head)) return false;
  if (!rss1Prefixes(text, RSS1_RDF_NS).length) return false;
  return Boolean(
    rss1Prefixes(text, RSS1_EVENT_NS).length || rss1IsDefault(text, RSS1_EVENT_NS),
  );
}

/**
 * The item's own identity, off the RDF resource it is about.
 *
 * `rdf:about` is the RSS 1.0 way to say which thing this describes, so it is
 * read first and under whatever prefix the document bound to the RDF
 * namespace. `guid` is the RSS 2.0 spelling, present in Ohio State's feed and
 * in plenty of others written by tools that emit both, and it is a fallback
 * rather than the answer.
 */
function rss1Id(block: string, xml: string): string {
  const attributes = rss1ModuleNames(xml, RSS1_RDF_NS, 'about').map(rss1Escape).join('|');
  if (attributes) {
    const pattern = new RegExp(`<[^>]*?\\s(?:${attributes})\\s*=\\s*["']([^"']+)["']`, 'i');
    const match = pattern.exec(block);
    if (match) return cleanUrl(match[1]);
  }
  return cleanUrl(rss1Value(block, ['guid']));
}

/**
 * Every dated item in the document.
 *
 * Items are found across the whole document rather than inside `channel`,
 * because in RSS 1.0 that is where they are. The `<items>` block inside
 * `channel` is an `rdf:Seq` of pointers and holds no event data, so nothing is
 * read from it.
 *
 * An item with no readable start is not an event and is dropped. There is no
 * second guess at a date from `pubDate` or from the link, both of which are
 * present on every Ohio State item and neither of which is when the event
 * happens.
 */
export function parseRss1Events(xml: unknown): Rss1Event[] {
  const text = String(xml || '');
  if (!isRss1Document(text)) return [];

  const itemNames = rss1CoreNames(text, 'item');
  const titleNames = rss1CoreNames(text, 'title');
  const linkNames = rss1CoreNames(text, 'link');
  const descriptionNames = rss1CoreNames(text, 'description');
  const startNames = rss1ModuleNames(text, RSS1_EVENT_NS, 'startdate');
  const endNames = rss1ModuleNames(text, RSS1_EVENT_NS, 'enddate');
  const locationNames = rss1ModuleNames(text, RSS1_EVENT_NS, 'location');
  const typeNames = rss1ModuleNames(text, RSS1_EVENT_NS, 'type');
  const subjectNames = rss1ModuleNames(text, RSS1_DC_NS, 'subject');
  const encodedNames = rss1ModuleNames(text, RSS1_CONTENT_NS, 'encoded');

  const events: Rss1Event[] = [];
  for (const block of rss1Blocks(text, itemNames)) {
    if (events.length >= RSS1_MAX_ITEMS) break;
    const start = rss1Date(rss1Value(block, startNames));
    if (!start.value) continue;
    const end = rss1Date(rss1Value(block, endNames));
    const link = rss1Value(block, linkNames);
    events.push({
      id: rss1Id(block, text) || link,
      title: plainText(rss1Value(block, titleNames)),
      url: cleanUrl(link),
      start: start.value,
      end: end.value,
      allDay: start.allDay,
      location: plainText(rss1Value(block, locationNames)),
      // The summary where the feed writes one, the full body where it does not.
      // Ohio State publishes only `content:encoded`, and reading `description`
      // alone leaves every listing with no description at all.
      description: plainText(
        rss1Value(block, descriptionNames) || rss1Value(block, encodedNames),
      ),
      subjects: rss1Values(block, subjectNames).map(plainText).filter(Boolean),
      types: rss1Values(block, typeNames).map(plainText).filter(Boolean),
    });
  }
  return events;
}

/**
 * A calendar with something still ahead of today.
 *
 * The same gate the .ics probe uses, and the same day of grace: this decides
 * whether a whole school is worth resolving, not whether one listing is shown.
 */
export function looksLikeRss1(text: unknown): boolean {
  const events = parseRss1Events(text);
  if (!events.length) return false;
  const cutoff = Date.now() - 86400000;
  return events.some((event) => {
    const at = new Date(event.start).getTime();
    return Number.isFinite(at) && at >= cutoff;
  });
}

async function fetchRss1Once(
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<string> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {});
    return '';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let text = '';
  try {
    while (text.length < RSS1_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return text;
}

/**
 * Fetch a feed, trying both client identities before believing a refusal.
 *
 * The same reasoning as the .ics reader: schools disagree about who may read a
 * public feed and they disagree in both directions, so a response that is not a
 * calendar is retried under the other identity before it counts as a miss.
 */
async function fetchRss1Text(url: string, timeoutMs: number): Promise<string> {
  const accept = 'application/rss+xml,application/rdf+xml,application/xml,text/xml,*/*';
  const attempts: Record<string, string>[] = [
    { Accept: accept },
    { Accept: accept, 'User-Agent': BROWSER_UA },
  ];
  for (const headers of attempts) {
    let text = '';
    try {
      text = await fetchRss1Once(url, timeoutMs, headers);
    } catch (_) {
      continue; // Unreachable or timed out under this identity; try the other.
    }
    if (isRss1Document(text)) return text;
  }
  return '';
}

/** Is this feed URL one the school itself is entitled to point us at? */
export function isAllowedRss1Url(url: string, domain: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(String(url || '').trim());
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  // Same gate as a discovered .ics, and for the same reason: this URL came off
  // a remote page and is about to be fetched server-side, so same-site is not
  // enough on its own and an explicit port is refused outright.
  if (parsed.port) return false;
  const host = stripWww(parsed.hostname.toLowerCase());
  return isProbeableDomain(host) && sameSite(host, domain);
}

/**
 * Feed links a page advertises, in the order it names them.
 *
 * Only the `rel=alternate` link tag, which exists precisely to say "the machine
 * readable version of this page is here". Anything looser reads a school's news
 * feed as its calendar, and the event-module gate is the only thing that would
 * then be standing between a press release and a student's Mission Guide.
 */
export function rss1LinksFrom(html: string, domain: string, baseUrl = ''): string[] {
  const found: string[] = [];
  const patterns = [
    /<link[^>]+type\s*=\s*["']application\/(?:rss|rdf)\+xml["'][^>]*?href\s*=\s*["']([^"']+)["']/gi,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*?type\s*=\s*["']application\/(?:rss|rdf)\+xml["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(html || '').matchAll(pattern)) {
      // Advertised feeds are routinely relative, so they are resolved against
      // the page that named them before the same-site check, which is what
      // makes that check mean anything.
      let url = decodeEntities(match[1]).trim();
      if (baseUrl && !/^https?:\/\//i.test(url)) {
        try {
          url = new URL(url, baseUrl).toString();
        } catch (_) {
          continue;
        }
      }
      if (!isAllowedRss1Url(url, domain) || found.includes(url)) continue;
      found.push(url);
      if (found.length >= RSS1_MAX_FEED_LINKS) return found;
    }
  }
  return found;
}

/** Pages a school is most likely to advertise an events feed on. */
function rss1PageCandidates(domain: string): string[] {
  return [
    `https://www.${domain}/events`,
    `https://www.${domain}/calendar`,
    `https://events.${domain}`,
    `https://calendar.${domain}`,
  ];
}

/** First candidate that parses as a calendar with something still ahead. */
async function firstValidRss1(candidates: string[]): Promise<string | null> {
  const attempts = candidates.map(async (url) => {
    try {
      return looksLikeRss1(await fetchRss1Text(url, RSS1_PROBE_TIMEOUT_MS));
    } catch (_) {
      return false;
    }
  });
  for (let i = 0; i < attempts.length; i++) {
    if (await attempts[i]) return candidates[i];
  }
  return null;
}

/**
 * There is no path to guess here, so the school has to name its own feed.
 *
 * RSS 1.0 is a format rather than a product, and the schools that publish one
 * put it wherever their CMS felt like: Ohio State's is
 * /CentralCalendar/StudentLife.EventCalendar.Web.Service.RssHandler.ashx, which
 * no list of guesses would ever contain. What those pages do carry is the
 * `rel=alternate` link tag advertising it, so that is what gets read.
 *
 * A school whose pages advertise nothing simply does not resolve this way. Its
 * row can still name a feed directly, which is how Ohio State is served: their
 * feed sits on activities.osu.edu and their university-wide events page, the
 * one page that would link it, is an infinite redirect loop.
 */
async function probeRss1(domain: string): Promise<string | null> {
  const pages = await Promise.all(rss1PageCandidates(domain).map(async (url) => {
    try {
      return await fetchPage(url, RSS1_HTML_SCAN_BYTES);
    } catch (_) {
      return { finalHost: '', finalUrl: url, html: '' }; // No feed named from here.
    }
  }));

  const candidates: string[] = [];
  for (const page of pages) {
    for (const link of rss1LinksFrom(page.html, domain, page.finalUrl)) {
      if (!candidates.includes(link)) candidates.push(link);
    }
  }
  return await firstValidRss1(candidates.slice(0, RSS1_MAX_FEED_LINKS));
}

async function fetchRss1(feedUrl: string, days: number) {
  const text = await fetchRss1Text(feedUrl, RSS1_FEED_TIMEOUT_MS);
  if (!isRss1Document(text)) throw new Error('Calendar feed returned an unexpected shape');
  return parseRss1Events(text).filter(event => withinWindow(event.start, days));
}

// deno-lint-ignore no-explicit-any
function normalizeRss1(event: any): NormalizedEvent {
  return {
    ...emptyEvent(),
    id: String(event.id || `${event.start}-${event.title}`),
    title: plainText(event.title),
    description: plainText(event.description).slice(0, 600),
    url: cleanUrl(event.url),
    start: event.start || '',
    end: event.end || '',
    all_day: Boolean(event.allDay),
    location: plainText(event.location),
    types: cleanList(event.types),
    // dc:subject is what Ohio State tags a listing with ("Food", "Social",
    // "Students (Columbus Campus)"), and it is the only thing in this format
    // that ranking has to match a student's interests against.
    keywords: cleanList(event.subjects),
  };
}

const rss1Adapter: Adapter = {
  name: 'rss1',
  probe: probeRss1,
  fetch: fetchRss1,
  normalize: normalizeRss1,
};

// ── Schools that publish no feed at all ─────────────────────────────────────

/**
 * Events a browser read off a school's own events page.
 *
 * Every adapter above this one reads a machine-readable calendar. A fingerprint
 * of all 1,124 schools we could not read says most of them publish no such
 * calendar in any form, and that there is no adapter left worth writing. What
 * plenty of them do publish is an events page a person can read.
 *
 * So those pages are rendered in a real browser and read by the model, offline
 * and on a schedule. This adapter is only the read side. It never renders and
 * never calls a model: it looks up rows somebody else already wrote, which is
 * what keeps a browser out of a student's page load.
 *
 * Two rules hold this honest and neither is optional:
 *
 * 1. Nothing is stored unless its date was found in the page's own text. The
 *    model is perfectly willing to invent a date for a month-grid calendar,
 *    where the day numbers carry no month anywhere near them. One school
 *    produced 132 events that way, every title real and every date made up.
 * 2. A stale row is not served. These do not refresh themselves, and a row
 *    nobody has touched in three weeks is mostly events that have happened.
 */
export const SCRAPED_MAX_AGE_DAYS = 21;

/** What the read side of the store has to provide. Kept tiny on purpose. */
interface ScrapedStore {
  // deno-lint-ignore no-explicit-any
  byUrl(sourceUrl: string): Promise<any>;
  // deno-lint-ignore no-explicit-any
  byDomain?(domain: string): Promise<any>;
}

/**
 * Does one of this school's candidate domains have scraped events waiting?
 *
 * Asked only after every real feed has failed to probe. The offline job writes
 * rows for schools nobody here attends yet, so this is what connects "we read
 * that school's page months ago" to "a student from it just signed up", without
 * having created a University row for all of them in advance.
 *
 * A row with no events, or no source URL, is not a feed. Both would cache a
 * school as resolved and then serve it nothing forever, which is worse than
 * leaving it unresolved: an unresolved school gets probed again.
 */
export async function scrapedFeedFor(
  store: ScrapedStore | null | undefined,
  domains: string[],
): Promise<{ platform: string; feedUrl: string } | null> {
  if (!store?.byDomain) return null;
  for (const domain of domains) {
    // deno-lint-ignore no-explicit-any
    let row: any = null;
    try {
      row = await store.byDomain(domain);
    } catch (_) {
      continue;
    }
    if (!row || !scrapedIsFresh(row)) continue;
    if (!row.source_url) continue;
    if (!Array.isArray(row.events) || !row.events.length) continue;
    return { platform: 'scraped', feedUrl: String(row.source_url) };
  }
  return null;
}

/**
 * Is this row recent enough to show a student?
 *
 * An undated row counts as stale. A row written before this field existed has
 * no way to prove it is current, and guessing in its favour is how a student
 * gets shown last term's calendar.
 */
// deno-lint-ignore no-explicit-any
export function scrapedIsFresh(row: any, now = Date.now()): boolean {
  const at = new Date(row?.refreshed_at || '').getTime();
  if (!Number.isFinite(at)) return false;
  return now - at < SCRAPED_MAX_AGE_DAYS * 86400000;
}

/**
 * One stored event in the shape everything downstream expects.
 *
 * The wall clock is emitted with no offset, the same as every other adapter
 * here. A page saying 6pm means 6pm to the student reading it, and stamping a
 * zone onto it is how an event moves by five hours on somebody's screen.
 */
// deno-lint-ignore no-explicit-any
export function normalizeScraped(raw: any, feedUrl: string): NormalizedEvent {
  const date = String(raw?.start_date || '').trim();
  const start = String(raw?.start_time || '').trim();
  const end = String(raw?.end_time || '').trim();
  const endDate = String(raw?.end_date || '').trim();
  return {
    ...emptyEvent(),
    // Stable across refreshes, so the same event does not read as a new one
    // every time the job runs.
    id: `scraped:${feedUrl}:${date}:${String(raw?.title || '').slice(0, 80)}`,
    title: String(raw?.title || '').trim(),
    description: String(raw?.description || '').replace(/\s+/g, ' ').trim().slice(0, 600),
    url: String(raw?.url || '').trim(),
    start: date && start ? `${date}T${start}:00` : date,
    end: endDate && end
      ? `${endDate}T${end}:00`
      : end && date
      ? `${date}T${end}:00`
      : endDate,
    // No clock on the page means the page did not say, not midnight.
    all_day: Boolean(date) && !start,
    location: String(raw?.location || '').trim(),
  };
}

/**
 * Read a school's events out of the store.
 *
 * Every other adapter's fetch makes a request. This one deliberately does not:
 * the work happened offline, and the only thing left is a lookup.
 */
async function fetchScraped(
  feedUrl: string,
  days: number,
  _seriesDates?: number,
  store?: ScrapedStore,
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  if (!store) return [];
  // deno-lint-ignore no-explicit-any
  let row: any = null;
  try {
    row = await store.byUrl(feedUrl);
  } catch (_) {
    return [];
  }
  if (!row || !scrapedIsFresh(row)) return [];
  const events = Array.isArray(row.events) ? row.events : [];
  return events.filter(
    // deno-lint-ignore no-explicit-any
    (e: any) => e?.start_date && withinWindow(String(e.start_date), days),
  );
}

/**
 * A scraped school is never discovered by probing. The offline job decides it,
 * so there is nothing for a request-time probe to find and claiming otherwise
 * would put every school through a probe that cannot succeed.
 */
function probeScraped(_domain: string): Promise<string | null> {
  return Promise.resolve(null);
}

const scrapedAdapter: Adapter = {
  name: 'scraped',
  probe: probeScraped,
  fetch: fetchScraped,
  normalize: normalizeScraped,
};

/**
 * The store, backed by the entity the offline job writes.
 *
 * Built per request because the client is. A school with no row, or a lookup
 * that fails, reads as "no events" rather than an error: the student's calendar
 * is not the place to surface that a scheduled job has not run.
 */
// deno-lint-ignore no-explicit-any
function scrapedStore(base44: any): ScrapedStore {
  return {
    async byUrl(sourceUrl: string) {
      try {
        const rows = await base44.asServiceRole.entities.CampusScrapedEvents
          .filter({ source_url: sourceUrl }, '-refreshed_at', 1);
        return rows?.[0] || null;
      } catch (_) {
        return null;
      }
    },
    async byDomain(domain: string) {
      try {
        const rows = await base44.asServiceRole.entities.CampusScrapedEvents
          .filter({ domain }, '-refreshed_at', 1);
        return rows?.[0] || null;
      } catch (_) {
        return null;
      }
    },
  };
}

// ── Adapter registry ────────────────────────────────────────────────────────

/**
 * Order is preference first, cost second. The three JSON probes come first
 * because each is a single cheap request. Trumba is next because it is the
 * only probe that has to fetch and scan HTML to find a slug. iCal is last on
 * both counts: its guesses are the widest, and its events are the thinnest to
 * rank against.
 */
const ADAPTERS: Adapter[] = [
  localistAdapter,
  liveWhaleAdapter,
  // Ahead of the club portals: it is a whole-campus calendar and carries more
  // per event than anything else here. Its probe costs a page read, so it sits
  // behind the two that answer in a single request.
  modernCampusAdapter,
  // Beside Modern Campus and for the same reason, despite being the most
  // expensive probe here: it is the whole-campus calendar, and the club portals
  // below it are not. Measured on the two schools that run both — Sacred Heart's
  // CampusGroups portal offers 1 event in 30 days against 715 on its EMS
  // calendar, and James Madison's 8 against several hundred. Ordering this after
  // them buys one cheap request and costs a student their entire calendar.
  emsAdapter,
  campusLabsAdapter,
  // Beside Campus Labs, and after it: same one-request cost, and a school
  // running both should get its campus-wide calendar rather than its clubs.
  campusGroupsAdapter,
  presenceAdapter,
  tribeAdapter,
  trumbaAdapter,
  drupalAdapter,
  icalAdapter,
  // Behind iCal, and last of the real feeds. Its probe has to read pages before
  // it can say no, and there is no path to guess, so only a school that
  // resolved to nothing everywhere else pays for it. A school whose row already
  // names an RSS 1.0 feed never reaches this at all.
  rss1Adapter,
  // Last, and never reached by probing. A school only lands here because every
  // real feed above failed and the offline job found events on its page.
  scrapedAdapter,
];

export function adapterFor(platform: string): Adapter | null {
  return ADAPTERS.find(a => a.name === platform) || null;
}

// ── Finding where the calendar actually lives ───────────────────────────────

/** How much of a page to read while looking for the calendar's address. */
const DISCOVERY_SCAN_BYTES = 300_000;
const MAX_DISCOVERED_HOSTS = 4;
const MAX_DISCOVERED_DOMAINS = 2;
const MAX_DISCOVERED_ICS = 6;

/**
 * A hostname label that reads like a calendar.
 *
 * Matched as a substring rather than a whole word, because schools run the
 * name together: Arizona State's is asuevents.asu.edu, which no boundary-aware
 * pattern accepts. The looseness costs little — a discovered host is only ever
 * inside the school's own domain, and it still has to answer with a real feed
 * before anything is returned.
 *
 * "engage" and "involvement" are here because that is what schools call the
 * student-life portal, and at a lot of them it is the only place events are
 * published at all — Babson's whole club calendar is on engage.babson.edu.
 */
const CALENDAR_LABEL_RE =
  /(calendar|event|engage|involvement|orgs|studentlife)/;

/**
 * Hosts a school may run a calendar on without ever linking to it.
 *
 * Kept to the names the portal products actually use, since each one costs a
 * request on every school that has no calendar at all.
 */
const PORTAL_SUBDOMAINS = ['engage', 'involvement'];

/** Pages that link to, or redirect to, wherever a school keeps its calendar. */
function discoveryPages(domain: string): string[] {
  return [
    `https://www.${domain}/`,
    `https://www.${domain}/events`,
    `https://www.${domain}/calendar`,
    `https://events.${domain}`,
    `https://calendar.${domain}`,
  ];
}

/**
 * A same-site page that is probably the school's events page.
 *
 * The five pages above are guesses at where a calendar lives, and the guess is
 * too narrow in a way that shows up constantly: a school that publishes a
 * perfectly readable Modern Campus or Trumba calendar at
 * `/student-life/events-calendar.html` or `/about/calendars/index.html` reads as
 * having no calendar at all, because nothing ever opens the page holding the
 * widget. Two independent sweeps of 45 schools each landed on this as the single
 * biggest gap, with a proven school apiece.
 *
 * So the school's own navigation gets read: any link whose path looks like an
 * events or calendar page is worth opening once. Restricted to the school's own
 * registrable domain, like every other link discovery follows.
 */
const EVENT_PAGE_PATH = /\/[^?#]*(events?|calendars?)[^?#]*$/i;

/** Anything that is plainly not a page. */
const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|mp3|ics|xml|json|rss)$/i;

const MAX_DISCOVERED_PAGES = 4;

/** Same-site pages named like an events page, resolved and de-duplicated. */
export function eventPageLinks(html: string, domain: string, baseUrl = ''): string[] {
  const found: string[] = [];

  for (const match of String(html || '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let url: string;
    try {
      url = new URL(decodeEntities(match[1]).trim(), baseUrl || `https://${domain}`).toString();
    } catch (_) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (_) {
      continue;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
    if (parsed.port) continue;

    const host = stripWww(parsed.hostname.toLowerCase());
    if (!isProbeableDomain(host) || !sameSite(host, domain)) continue;
    if (NOT_A_PAGE.test(parsed.pathname)) continue;
    // The bare root is already read, and it matches nothing anyway.
    if (parsed.pathname === '/' || !EVENT_PAGE_PATH.test(parsed.pathname)) continue;

    // The query string is dropped: a calendar page linked once per month
    // ("?date=2026-09") is the same page, and keeping it would spend the whole
    // budget on twelve copies of one URL.
    const clean = `${parsed.origin}${parsed.pathname}`;
    if (found.includes(clean)) continue;
    found.push(clean);
    if (found.length >= MAX_DISCOVERED_PAGES * 3) break;
  }

  return found;
}

/** "campuscalendar.ucsb.edu" and "ucsb.edu" are the same institution. */
function sameSite(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * A host named in a page, with the scheme optional.
 *
 * The scheme has to be optional because the vendors ship it that way. LiveWhale's
 * own embed widget is `<script src="//calendar.fit.edu/...">` — protocol-relative,
 * which is the ordinary way to write an embed that has to work on http and https
 * pages alike. Requiring `http(s)://` therefore skipped an entire product's
 * standard install: fit.edu publishes 555 future events on a host it names right
 * there in its homepage markup, and we read past it.
 */
const CALENDAR_HOST_RE = /(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;

/**
 * Calendar-looking hosts inside the school's own registrable domain.
 *
 * Both filters are load-bearing and neither is about tidiness. `sameSite` is the
 * reason it is safe to read hosts out of arbitrary markup at all — these get
 * fetched server-side, so a host that is not the school's own never becomes a
 * request. The label test is what keeps a school's CDN, its font host and its
 * marketing subdomains from each costing a probe.
 */
export function calendarHostsFrom(html: string, domain: string): string[] {
  const found: string[] = [];
  for (const match of String(html || '').matchAll(CALENDAR_HOST_RE)) {
    const host = stripWww(match[1].toLowerCase());
    if (found.includes(host)) continue;
    if (!isProbeableDomain(host) || !sameSite(host, domain)) continue;
    const label = host.slice(0, Math.max(0, host.length - domain.length - 1));
    if (label && CALENDAR_LABEL_RE.test(label)) found.push(host);
  }
  return found;
}

/**
 * Ask the school where its calendar is, instead of guessing three subdomains.
 *
 * Guessing loses two whole classes of school. UC Santa Barbara's Localist
 * calendar is at campuscalendar.ucsb.edu — a name no fixed list contains.
 * Syracuse redirects syr.edu to syracuse.edu, and the calendar hangs off the
 * domain we never tried. Both schools state the answer publicly; we just never
 * read it.
 *
 * Two sources, both of which are the school talking about itself:
 *
 *   a redirect  — the school published it, so where it lands is the school's
 *   a same-site  — a calendar-looking host inside the school's own registrable
 *   link          domain, named on one of the school's own pages
 *
 * Arbitrary links are deliberately not followed. These hosts get fetched
 * server-side, so anything outside the school's own domain has to arrive via
 * the school's own redirect, never via an href a page happens to contain.
 */
async function discoverCalendarLocations(
  domain: string,
): Promise<{ hosts: string[]; domains: string[]; icsUrls: string[]; pages: string[] }> {
  const alreadyTried = new Set([domain, ...SUBDOMAIN_CANDIDATES.map(s => `${s}.${domain}`)]);
  const hosts = new Set<string>();
  const domains = new Set<string>();
  const icsUrls = new Set<string>();
  const eventPages = new Set<string>();

  // The student-life portal is worth trying blind, because the main site often
  // does not link to it at all. Babson's whole club calendar is published at
  // engage.babson.edu and nothing on babson.edu mentions that host, so no
  // amount of reading the school's pages will ever reach it.
  for (const label of PORTAL_SUBDOMAINS) {
    const host = `${label}.${domain}`;
    if (!alreadyTried.has(host) && isProbeableDomain(host)) hosts.add(host);
  }

  const pages = await Promise.all(discoveryPages(domain).map(async (url) => {
    try {
      return await fetchPage(url, DISCOVERY_SCAN_BYTES);
    } catch (_) {
      return null; // No such host, 403, timeout — just means no answer here.
    }
  }));

  for (const page of pages) {
    if (!page) continue;

    const landed = page.finalHost;
    if (landed && isProbeableDomain(landed) && !alreadyTried.has(landed)) {
      // Inside the school's own domain it is a host to probe outright; outside
      // it, the school has effectively renamed itself, so it becomes a fresh
      // domain and gets the full subdomain treatment.
      if (sameSite(landed, domain)) hosts.add(landed);
      else domains.add(landed);
    }

    for (const host of calendarHostsFrom(page.html, domain)) {
      if (!alreadyTried.has(host)) hosts.add(host);
    }

    // The same pages carry the "Subscribe" links, and those are how the
    // un-guessable feeds are reachable at all: Boston University's lives at
    // /phpbin/calendar/ical.php and Babson's under a per-group ical path. No
    // list of guessed paths was ever going to contain either.
    for (const url of icsLinksFrom(page.html, domain, page.finalUrl)) icsUrls.add(url);

    // And the school's own navigation, for the calendar that is embedded on a
    // page nobody would guess the name of.
    for (const url of eventPageLinks(page.html, domain, page.finalUrl)) {
      if (url !== page.finalUrl) eventPages.add(url);
    }
  }

  return {
    hosts: [...hosts].slice(0, MAX_DISCOVERED_HOSTS),
    domains: [...domains].slice(0, MAX_DISCOVERED_DOMAINS),
    icsUrls: [...icsUrls].slice(0, MAX_DISCOVERED_ICS),
    pages: [...eventPages].slice(0, MAX_DISCOVERED_PAGES),
  };
}

/**
 * Read one of the school's own events pages and see what calendar it embeds.
 *
 * The same three checks `resolveSubmittedUrl` runs on a page a student pasted,
 * for the same reason: the page itself is not the feed, it is the thing that
 * names one. Kept in this order because it is cost order — the .ics links are
 * already in hand, the Modern Campus id is a regex over markup we have, and
 * Trumba costs a request per slug.
 */
async function probeEmbeddedCalendar(
  pageUrl: string,
  domain: string,
): Promise<{ platform: string; feedUrl: string } | null> {
  let page: { finalHost: string; finalUrl: string; html: string };
  try {
    page = await fetchPage(pageUrl, DISCOVERY_SCAN_BYTES);
  } catch (_) {
    return null;
  }
  if (!page.html) return null;

  const ics = await firstValidIcs(icsLinksFrom(page.html, domain, page.finalUrl));
  if (ics) return { platform: 'ical', feedUrl: ics };

  const modernCampus = await firstValidModernCampus(modernCampusIdsFrom(page.html));
  if (modernCampus) return { platform: 'moderncampus', feedUrl: modernCampus };

  for (const slug of trumbaSlugsFrom(page.html).slice(0, TRUMBA_MAX_SLUGS)) {
    const hit = await firstValidUrl(TRUMBA_HOSTS.map(h => `${h}/${slug}.json`), looksLikeTrumba);
    if (hit) return { platform: 'trumba', feedUrl: hit };
  }

  return null;
}

/**
 * Everything that lives at a fixed path once the host is known.
 *
 * Localist, LiveWhale and plain .ics are all "this host, that path" — no slug
 * to discover — so a host we have just learned about can be checked for all
 * three outright. Trumba and Campus Labs key off a slug instead and stay with
 * their own probes.
 */
async function probeKnownHost(
  host: string,
  domain: string,
): Promise<{ platform: string; feedUrl: string } | null> {
  const localist = await firstValidUrl(
    [`https://${host}/api/2/events?days=1&pp=1`],
    looksLikeLocalist,
  );
  if (localist) return { platform: 'localist', feedUrl: localist.split('?')[0] };

  const liveWhale = await firstValidUrl(
    [`https://${host}/live/json/events`],
    looksLikeLiveWhale,
  );
  if (liveWhale) return { platform: 'livewhale', feedUrl: liveWhale };

  // Asked of any host, not just `*.campusgroups.com`, because schools routinely
  // put their portal on their own domain and brand the vendor away — Columbia's
  // is lionhub.columbia.edu, WPI's mywpi.wpi.edu, South Florida's
  // bullsconnect.usf.edu. Matching on the vendor's hostname would miss every
  // one of those, and they are the ones our own students attend.
  const campusGroups = await probeCampusGroupsAt(host);
  if (campusGroups) return { platform: 'campusgroups', feedUrl: campusGroups };

  const ics = await firstValidIcs(ICS_PATHS.map(path => `https://${host}${path}`));
  if (ics) return { platform: 'ical', feedUrl: ics };

  // EMS after the cheap guesses and before the ones that read pages. A school
  // that runs it on a host discovery just learned about — calendar.<domain>
  // rather than ems.<domain> — is only reachable here.
  for (const path of EMS_PATHS) {
    const ems = await probeEmsAt(`https://${host}${path}`);
    if (ems) return { platform: 'ems', feedUrl: ems };
  }

  // Drupal next: it costs an index request before it can say no, and the three
  // above answer in one. Arizona State needs it — its events live on
  // asuevents.asu.edu, which only turns up through discovery.
  const endpoints = await drupalEventEndpoints(host);
  if (endpoints.length) {
    const hit = await firstValidUrl(
      endpoints.map(e => `${e}?page[limit]=5`),
      looksLikeDrupalEvents,
    );
    if (hit) return { platform: 'drupal', feedUrl: hit.split('?')[0] };
  }

  // Last, read the portal's own events page the way we read the school's.
  // Student-life portals publish a real calendar at a path nobody could guess —
  // CampusGroups serves Gettysburg's from /ical/gettysburg/ical_gettysburg.ics
  // — but every one of them links it from the page, which is the whole point of
  // a subscribe button.
  for (const page of [`https://${host}/events`, `https://${host}/`]) {
    let found: string[] = [];
    try {
      const html = await fetchPage(page, DISCOVERY_SCAN_BYTES);
      found = icsLinksFrom(html.html, domain, html.finalUrl);
    } catch (_) {
      continue;
    }
    if (!found.length) continue;
    const ics = await firstValidIcs(found);
    if (ics) return { platform: 'ical', feedUrl: ics };
  }

  return null;
}

/**
 * First platform that answers with a feed we can actually read, or null.
 *
 * `discover` exists to bound the work: discovery can hand back another domain,
 * and that domain is re-probed with discovery off, so a chain of redirects
 * costs one extra hop rather than an open-ended walk.
 */
export async function probeCalendar(
  domain: string,
  { discover = true }: { discover?: boolean } = {},
): Promise<{ platform: string; feedUrl: string } | null> {
  for (const adapter of ADAPTERS) {
    let feedUrl: string | null = null;
    try {
      feedUrl = await adapter.probe(domain);
    } catch (_) {
      feedUrl = null; // A probe must never take down the request.
    }
    if (feedUrl) return { platform: adapter.name, feedUrl };
  }

  // Only now, having failed the cheap guesses, is it worth reading pages. A
  // school whose calendar sits where we expect never pays for this.
  if (!discover) return null;

  let found: { hosts: string[]; domains: string[]; icsUrls: string[]; pages: string[] };
  try {
    found = await discoverCalendarLocations(domain);
  } catch (_) {
    return null;
  }

  for (const host of found.hosts) {
    try {
      const hit = await probeKnownHost(host, domain);
      if (hit) return hit;
    } catch (_) { /* Next host. */ }
  }

  if (found.icsUrls.length) {
    try {
      const ics = await firstValidIcs(found.icsUrls);
      if (ics) return { platform: 'ical', feedUrl: ics };
    } catch (_) { /* Fall through to the school's own events pages. */ }
  }

  // The school's own events page, which is where the widget-embedded calendars
  // live. Last of the same-domain attempts because it costs a page read each,
  // and ahead of the alias domains because a page on the school's own site is a
  // better answer than a guess at a different school's.
  for (const page of found.pages) {
    try {
      const hit = await probeEmbeddedCalendar(page, domain);
      if (hit) return hit;
    } catch (_) { /* Next page. */ }
  }

  for (const alias of found.domains) {
    try {
      const hit = await probeCalendar(alias, { discover: false });
      if (hit) return hit;
    } catch (_) { /* Next domain. */ }

    // The adapters above ask "does this domain run a calendar on one of its
    // subdomains", which is the right question when the school has simply
    // renamed itself. It is the wrong question when the school's own /events
    // redirected us onto the calendar itself: CNM sends us to
    // cnm.enterprise.localist.com, and asking that host for *its* subdomains
    // finds nothing while the host in hand answers on the first request. A
    // landing place the school chose is worth probing as a calendar, not just
    // as another school.
    try {
      const hit = await probeKnownHost(alias, alias);
      if (hit) return hit;
    } catch (_) { /* Next domain. */ }
  }

  return null;
}

// ── A calendar the student pointed us at ────────────────────────────────────

/**
 * Calendar products a school's own events genuinely live on, off its domain.
 *
 * Discovery refuses to leave the school's registrable domain, which is right
 * when we are following links off a page we did not choose. A student typing
 * the address of their own student-life portal is a different act: they know
 * where their clubs post, and for a lot of schools that is the only place
 * events exist at all. CampusGroups on <slug>.campusgroups.com is the case
 * this exists for — it is a known miss with a working adapter behind it.
 *
 * Every host here is a calendar SaaS and nothing else, so the worst a student
 * can do with one is point us at another school's public calendar.
 */
const CALENDAR_VENDOR_HOSTS = [
  'campuslabs.com',
  'campusgroups.com',
  'trumba.com',
  '25livepub.collegenet.com',
  'localist.com',
  'calendar.google.com',
  // Read properly since 2026-08-03. It was on this list for a year before that
  // with no adapter behind it, so that a student who pasted their own school's
  // portal got "we could not read that" rather than "that address is somewhere
  // else" — San Diego State's is sdsu.presence.io.
  'presence.io',
  // Accruent's hosted EMS tenancies, one subdomain per school — Sacred Heart's
  // whole calendar is sacredheart.emscloudservice.com and nothing on
  // sacredheart.edu serves it, so without this the students it exists for are
  // told their own calendar belongs to someone else.
  'emscloudservice.com',
];

function onVendorHost(host: string): boolean {
  return CALENDAR_VENDOR_HOSTS.some(v => host === v || host.endsWith(`.${v}`));
}

export type SubmissionCheck =
  | { ok: true; url: string; host: string; domain: string }
  | { ok: false; reason: 'bad_url' | 'blocked_port' | 'wrong_school' };

/**
 * Is this a URL we are willing to fetch on a student's say-so?
 *
 * This is the only place in the function where a URL originates with the
 * caller rather than with the school, so it carries the whole trust boundary
 * for the feature. The rules are deliberately the same ones discovery already
 * lives under, for the same reasons:
 *
 *   - the school's own registrable domain, or a calendar vendor's — a student
 *     cannot use us to fetch an arbitrary host
 *   - no explicit port, because a school's domain also covers its internal
 *     hosts and a port turns this into a way to knock on them
 *   - no IPs, no .internal/.lan/localhost, and a TLD a real school uses
 *
 * `allowedDomains` is what we believe the school's domains are. An empty list
 * means we could not work out the school at all, and a URL is refused rather
 * than waved through — failing closed here costs one student an empty state
 * and failing open costs us a server-side request to anywhere.
 */
export function checkSubmittedUrl(raw: string, allowedDomains: string[]): SubmissionCheck {
  // webcal:// first. It is a real scheme that subscribe buttons publish, so it
  // has to be rewritten before the missing-scheme guess below, or "webcal://x"
  // becomes "https://webcal://x" and a link the school itself handed out is
  // refused as malformed.
  const trimmed = normalizeIcsUrl(String(raw || '').trim());
  if (!trimmed) return { ok: false, reason: 'bad_url' };

  // Students paste "events.fairfield.edu" without a scheme far more often than
  // they paste a well-formed URL, and refusing that reads as us being broken.
  // Anything that already names a scheme is left alone, so a non-web one still
  // reaches the protocol check below rather than being papered over.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch (_) {
    return { ok: false, reason: 'bad_url' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'bad_url' };
  }
  if (parsed.port) return { ok: false, reason: 'blocked_port' };

  const host = stripWww(parsed.hostname.toLowerCase());

  // Vendors first. isProbeableDomain only allows the TLDs a school's own site
  // uses, and calendar products do not live on those — Presence is on .io — so
  // checking it first silently killed the entire vendor allowlist and told a
  // student who pasted their real portal that it was not a web address.
  if (onVendorHost(host)) {
    return { ok: true, url: parsed.toString(), host, domain: host };
  }

  if (!isProbeableDomain(host)) return { ok: false, reason: 'bad_url' };

  const domain = allowedDomains
    .map(d => stripWww(String(d || '').toLowerCase().trim()))
    .find(d => isProbeableDomain(d) && sameSite(host, d));

  if (!domain) return { ok: false, reason: 'wrong_school' };
  return { ok: true, url: parsed.toString(), host, domain };
}

/** Which platform, if any, a JSON body we already have in hand looks like. */
function platformOfJson(payload: unknown, url: string): { platform: string; feedUrl: string } | null {
  const bare = url.split('?')[0];
  if (looksLikeLocalist(payload)) return { platform: 'localist', feedUrl: bare };
  if (looksLikeLiveWhale(payload)) return { platform: 'livewhale', feedUrl: bare };
  if (looksLikeCampusLabs(payload)) return { platform: 'campuslabs', feedUrl: bare };
  if (looksLikeCampusGroups(payload)) return { platform: 'campusgroups', feedUrl: bare };
  if (looksLikeModernCampus(payload)) return { platform: 'moderncampus', feedUrl: bare };
  if (looksLikePresence(payload)) return { platform: 'presence', feedUrl: bare };
  if (looksLikeTrumba(payload)) return { platform: 'trumba', feedUrl: url };
  if (looksLikeTribe(payload)) return { platform: 'wptribe', feedUrl: bare };
  if (looksLikeDrupalEvents(payload)) return { platform: 'drupal', feedUrl: bare };
  return null;
}

/**
 * Turn an address a student gave us into a feed, or nothing.
 *
 * A student pastes whatever their school calls its calendar, so this has to
 * accept all three shapes that arrive: the feed itself, the page that embeds
 * one, and the portal that hosts one. What it must never do is lower the bar —
 * the result still has to parse as a real calendar with something upcoming in
 * it before a single event reaches anybody, exactly as a probed feed does.
 *
 * The ordering is cheapest-first for the same reason probeCalendar's is: a
 * student is watching a spinner while this runs.
 */
export async function resolveSubmittedUrl(
  url: string,
  host: string,
  domain: string,
  allowedDomains: string[] = [],
): Promise<{ platform: string; feedUrl: string } | null> {
  // Every request on this path — including every redirect hop — has to pass
  // the same gate the pasted URL did. Without this, checkSubmittedUrl is a
  // check on one URL rather than on where we actually end up, and any open
  // redirect on the school's own site reaches whatever it likes.
  //
  // The school's own domains are carried in alongside whatever the pasted URL
  // resolved to, because a vendor address routinely redirects straight back to
  // the school: jmu.campusgroups.com sends you to beinvolved.jmu.edu, and
  // gettysburg.campusgroups.com to engage.gettysburg.edu. Judging that hop
  // against the vendor host alone refuses the student's own university, which
  // is the most trustworthy place the chain could have gone. This widens
  // nothing — every host named here is one checkSubmittedUrl would have
  // accepted had the student pasted it directly.
  const hopDomains = [domain, ...allowedDomains].filter(Boolean);
  const guard: HopGuard = (candidate: string) => {
    const check = checkSubmittedUrl(candidate, hopDomains);
    return check.ok;
  };

  // 1. The URL is the feed. Someone who found their school's JSON endpoint or
  //    subscribe link has handed us the answer outright.
  try {
    const payload = await probeJson(url, guard);
    const hit = platformOfJson(payload, url);
    if (hit) return hit;
  } catch (_) { /* Not JSON, or unreachable. Try it as a calendar file. */ }

  try {
    if (looksLikeIcal(await fetchIcsText(url, ICS_PROBE_TIMEOUT_MS, guard))) {
      return { platform: 'ical', feedUrl: url };
    }
  } catch (_) { /* Not a calendar file either. Read it as a page. */ }

  // 2. A Campus Labs / CampusGroups portal address names its own slug, and the
  //    discovery endpoint behind it is a fixed rewrite. This is the case the
  //    vendor allowlist exists for, so it is worth trying before reading HTML.
  //
  //    The two vendors are separate products and take separate endpoints, and
  //    conflating them is what made the paste box fail on the one platform its
  //    own copy names by example: a `*.campusgroups.com` address was sent to
  //    Engage's REST API, which does not answer for it, and then fell through
  //    to reading a JavaScript shell that names no feed.
  if (onVendorHost(host)) {
    const slug = host.split('.')[0];
    if (slug && host.endsWith('campuslabs.com')) {
      const base = `https://${slug}.campuslabs.com/engage/api/discovery/event/search`;
      const hit = await firstValidUrl(
        [`${base}?endsAfter=${encodeURIComponent(new Date().toISOString())}&take=1`],
        looksLikeCampusLabs,
      );
      if (hit) return { platform: 'campuslabs', feedUrl: base };
    }
    if (slug && host.endsWith('presence.io')) {
      const base = `${PRESENCE_API}/${slug}/v1/events`;
      if (await firstValidUrl([base], looksLikePresence)) {
        return { platform: 'presence', feedUrl: base };
      }
    }
    if (slug && host.endsWith('campusgroups.com')) {
      // Keyed off the host the student actually pasted, not off their school's
      // domain, because the slug is routinely nothing like it — Columbia's
      // engineering portal is `columbiaengineering`, and a school can run
      // several.
      const hit = await probeCampusGroupsAt(host, guard);
      if (hit) return { platform: 'campusgroups', feedUrl: hit };
    }
  }

  // 3. An EMS address, which names its own application folder. Nothing later
  //    can find this one: reading the page finds no feed because there isn't
  //    one, and the endpoint behind it only answers a POST. The address is the
  //    only thing that says the calendar is there.
  const emsBase = emsBaseFrom(url);
  if (emsBase) {
    const ems = await probeEmsAt(emsBase, guard);
    if (ems) return { platform: 'ems', feedUrl: ems };
  }

  // 4. The page that embeds the calendar. This is what most students will
  //    actually paste, because it is the thing their school links "Events" to.
  let page: { finalHost: string; finalUrl: string; html: string };
  try {
    page = await fetchPage(url, DISCOVERY_SCAN_BYTES, guard);
  } catch (_) {
    return null;
  }

  if (page.html) {
    const ics = await firstValidIcs(icsLinksFrom(page.html, domain, page.finalUrl), guard);
    if (ics) return { platform: 'ical', feedUrl: ics };

    const modernCampus = await firstValidModernCampus(modernCampusIdsFrom(page.html));
    if (modernCampus) return { platform: 'moderncampus', feedUrl: modernCampus };

    for (const slug of trumbaSlugsFrom(page.html).slice(0, TRUMBA_MAX_SLUGS)) {
      const hit = await firstValidUrl(
        TRUMBA_HOSTS.map(h => `${h}/${slug}.json`),
        looksLikeTrumba,
      );
      if (hit) return { platform: 'trumba', feedUrl: hit };
    }
  }

  // 5. Whatever host the page actually landed on, checked the way discovery
  //    checks a host it just learned about. A student who pastes the school's
  //    events page has told us the host even when the page itself is a shell
  //    that renders its calendar client-side and names no feed in its markup.
  const landed = page.finalHost && isProbeableDomain(page.finalHost) ? page.finalHost : host;
  if (landed === host || sameSite(landed, domain) || onVendorHost(landed)) {
    try {
      const hit = await probeKnownHost(landed, domain);
      if (hit) return hit;
    } catch (_) { /* Nothing there. */ }
  }

  return null;
}

export async function fetchEvents(
  platform: string,
  feedUrl: string,
  days: number,
  seriesDates?: number,
  // deno-lint-ignore no-explicit-any
  store?: any,
): Promise<NormalizedEvent[]> {
  const adapter = adapterFor(platform);
  if (!adapter) throw new Error(`Unsupported calendar platform "${platform}"`);
  const raw = await adapter.fetch(feedUrl, days, seriesDates, store);
  // deno-lint-ignore no-explicit-any
  return raw.map((event: any) => adapter.normalize(event, feedUrl)).filter(e => e.title);
}

/**
 * Free-text college name -> web domain, via the model.
 *
 * Safe to guess wrong: probeCalendar() has to succeed against the real host
 * before anything is returned to a student, so a bad guess yields no events
 * rather than fake ones.
 */
// deno-lint-ignore no-explicit-any
async function guessDomains(base44: any, college: string): Promise<string[]> {
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `A college student typed this as their school: "${college}"

Return the primary web domain of that institution, plus up to 2 alternates if the
name is ambiguous or the school is known by more than one domain.

Rules:
- Domain only. No protocol, no path, no "www." prefix. e.g. "fairfield.edu"
- Real institutions only. If you cannot identify the school with confidence,
  return an empty array rather than guessing at a plausible-looking domain.`,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          domains: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const domains = Array.isArray(result?.domains) ? result.domains : [];
    return domains
      .map((d: unknown) => stripWww(String(d || '').toLowerCase().trim()))
      .filter(isProbeableDomain)
      .slice(0, 3);
  } catch (_) {
    return [];
  }
}

/** The University row this free-text college name refers to, if we have one. */
// deno-lint-ignore no-explicit-any
async function findUniversity(base44: any, college: string): Promise<any> {
  const key = normalizeName(college);
  if (!key) return null;
  try {
    const rows = await base44.asServiceRole.entities.University.filter({}, '-created_date', 500);
    // deno-lint-ignore no-explicit-any
    return rows.find((row: any) => {
      if (normalizeName(row.canonical_name) === key) return true;
      return (row.match_keys || []).some((k: string) => normalizeName(k) === key);
    }) || null;
  } catch (_) {
    return null;
  }
}

/**
 * A feed a student told us about, if one applies to this student.
 *
 * Two different permissions, deliberately kept apart. A submission that
 * resolved is used immediately for **the student who sent it** — they did the
 * work of finding it and should not have to wait on us to see their own
 * events. It reaches everybody else at that school only once it has been
 * approved, because the blast radius is the whole school: a link to the
 * library's calendar, or athletics, or one department's, would quietly become
 * what every student there is shown, and nothing downstream could tell.
 */
// deno-lint-ignore no-explicit-any
async function submittedFeedFor(base44: any, college: string, userId: string) {
  const key = normalizeName(college);
  if (!key) return null;

  // deno-lint-ignore no-explicit-any
  let rows: any[] = [];
  try {
    // Scoped in the query, not after it. Filtering a global page of 200 in
    // memory means that once 200 submissions exist, the earliest students to
    // find us a feed quietly stop being served their own.
    rows = await base44.asServiceRole.entities.CampusFeedSubmission.filter(
      { resolution: 'resolved', submitted_by: userId, review_status: 'pending' },
      '-created_date',
      50,
    );
  } catch (err) {
    // Never costs a student their events — but say so, because "the entity is
    // not deployed yet" and "RLS is refusing the service role" are the same
    // silence otherwise, and the second one is a bug.
    console.error('[campusEvents] could not read the submission queue', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Only the submitter's own, and only while it is still pending. Approval
  // writes the feed onto the University row instead, so an approved submission
  // is served by the ordinary cached path and this stops being a second place
  // the answer can live. A rejected one is not a fallback — it was looked at
  // and turned down, which is a stronger signal than the student's own paste.
  const row = rows.find(r =>
    normalizeName(r.college) === key &&
    r.resolved_feed_url &&
    adapterFor(r.resolved_platform)
  );
  if (!row) return null;

  return { platform: row.resolved_platform, feedUrl: row.resolved_feed_url };
}

/**
 * Finds (or creates) the University row for this school and makes sure its
 * feed URL is resolved. One probe per school, ever — not one per page load.
 */
// deno-lint-ignore no-explicit-any
async function resolveFeed(base44: any, college: string, userId = '') {
  const key = normalizeName(college);
  if (!key) return { feed: null, university: null };

  const db = base44.asServiceRole.entities.University;
  let university = await findUniversity(base44, college);

  // Already resolved — platform plus URL is everything an adapter needs, so a
  // cached school never gets probed again.
  if (university?.events_feed_url && adapterFor(university.events_platform)) {
    return {
      feed: { platform: university.events_platform, feedUrl: university.events_feed_url },
      university,
    };
  }

  // Before the negative cache, not after it. A school we failed to resolve is
  // exactly the school a student will have sent us a link for, and checking
  // this second would mean their own submission never got used.
  const submitted = await submittedFeedFor(base44, college, userId);
  if (submitted) return { feed: submitted, university };
  if (university?.events_platform === 'none' && university.events_resolved_at) {
    const age = Date.now() - new Date(university.events_resolved_at).getTime();
    if (age < NEGATIVE_RECHECK_DAYS * 86400000) {
      return { feed: null, university };
    }
  }

  // Prefer domains we already trust over anything the model produces.
  const known = (university?.approved_domains || [])
    .map((d: string) => stripWww(String(d).toLowerCase().trim()))
    .filter(isProbeableDomain);
  const candidates = [...new Set([...known, ...(await guessDomains(base44, college))])];

  // Cheap pass over every candidate first. Reading pages to discover a hidden
  // calendar host is worth it once, but not once per guessed domain — a school
  // that runs no calendar at all would otherwise pay for it three times over
  // while a student sits watching a spinner.
  let feed: { platform: string; feedUrl: string } | null = null;
  for (const domain of candidates) {
    feed = await probeCalendar(domain, { discover: false });
    if (feed) break;
  }
  if (!feed && candidates.length) {
    feed = await probeCalendar(candidates[0]);
  }

  // Last, and only after every real feed has failed to answer. A school with a
  // machine-readable calendar should always get that calendar: it carries
  // categories, organizers and registration links that a read page does not.
  if (!feed) {
    feed = await scrapedFeedFor(scrapedStore(base44), candidates);
  }

  const patch = {
    events_platform: feed ? feed.platform : 'none',
    events_feed_url: feed?.feedUrl || '',
    events_resolved_at: new Date().toISOString(),
  };

  try {
    if (university) {
      const matchKeys = new Set([...(university.match_keys || []), college]);
      university = await db.update(university.id, { ...patch, match_keys: [...matchKeys] });
    } else {
      university = await db.create({
        canonical_name: college,
        match_keys: [college],
        approved_domains: candidates,
        active: true,
        ...patch,
      });
    }
  } catch (_) {
    // Caching is an optimization. A write failure must not cost the student
    // their events on this request.
  }

  return { feed, university };
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/**
 * Keyword overlap against what the student told us at onboarding.
 *
 * Deliberately crude — its only job is to cut a 200-event feed down to a
 * shortlist small enough to hand the model. The real judgment happens there.
 */
export function scoreEvent(event: NormalizedEvent, terms: string[]): number {
  if (!terms.length) return 0;

  const strong = [event.title, ...event.topics, ...event.types, ...event.keywords]
    .join(' ')
    .toLowerCase();
  const weak = [event.description, ...event.departments].join(' ').toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (strong.includes(term)) score += 3;
    else if (weak.includes(term)) score += 1;
  }

  // A career fair the student's terms missed still beats an a cappella concert.
  //
  // Kept narrow on purpose. Broader signals ("info session", "professional")
  // fire on every graduate-program webinar the school runs, which floated a
  // marriage-and-family-therapy session to the top for a finance student.
  const CAREER_SIGNALS = ['career fair', 'job fair', 'internship', 'networking', 'employer', 'recruit', 'alumni panel', 'career center', 'career development'];
  const haystack = `${strong} ${weak}`;
  if (CAREER_SIGNALS.some(signal => haystack.includes(signal))) score += 2;

  return score;
}

/** Events students cannot attend are noise, however well they match. */
export function isAttendable(event: NormalizedEvent): boolean {
  if (!event.start) return false;
  const audience = event.audience.map((a: string) => a.toLowerCase());
  if (!audience.length) return true;
  const studentFacing = audience.some((a: string) =>
    a.includes('student') || a.includes('public') || a.includes('everyone') || a.includes('community') || a.includes('all')
  );
  const restricted = audience.every((a: string) =>
    a.includes('alumni') || a.includes('faculty') || a.includes('staff') || a.includes('children') || a.includes('families')
  );
  return studentFacing || !restricted;
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * The student's own profile.
 *
 * The college is read from here, never taken from the caller — this function
 * fetches remote URLs, so the host it builds must not be steerable from the
 * client.
 */
// deno-lint-ignore no-explicit-any
async function loadProfile(base44: any, user: any): Promise<any> {
  try {
    // created_by_id, not user_id. StudentProfile has no user_id field — 0 of
    // 50 live rows carry one — and Base44 enforces the filter rather than
    // ignoring it, so the old query matched nothing for everybody. Every
    // student looked like a student with no profile: ranking ran with no
    // interests, no major and no path, and the "tell us your school" state
    // could never be satisfied.
    const rows = await base44.entities.StudentProfile.filter({ created_by_id: user.id }, '-created_date', 1);
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
function collegeOf(profile: any, user: any): string {
  const college = (profile?.college || user?.college || '').trim();
  return !college || college.toLowerCase() === 'not specified' ? '' : college;
}

/** Enough of a feed to tell a real university calendar from the rec centre's. */
const SUBMISSION_SAMPLE_TITLES = 5;

/**
 * A student telling us where their school's calendar actually is.
 *
 * Roughly a quarter of our own students attend a school we cannot resolve, and
 * for most of them the calendar exists — it is just somewhere our guesses do
 * not reach. They know where it is. This is the one path where that knowledge
 * can get in.
 *
 * The student's own events come back on this request, because a "thanks, we'll
 * look into it" in exchange for going and finding a URL is a trade nobody
 * makes twice. What does NOT happen here is the write to the University row:
 * promoting one student's link to the feed for everybody at that school is a
 * review, not a side effect.
 */
// deno-lint-ignore no-explicit-any
async function handleSubmission(base44: any, user: any, body: any): Promise<Response> {
  const profile = await loadProfile(base44, user);
  const college = collegeOf(profile, user);
  if (!college) {
    return Response.json({ status: 'no_college', events: [], college: '' });
  }

  const university = await findUniversity(base44, college);
  const known = (university?.approved_domains || [])
    .map((d: string) => stripWww(String(d).toLowerCase().trim()))
    .filter(isProbeableDomain);
  // A school with no row yet, or one whose row predates domain caching, still
  // deserves an answer — so fall back to the same guess the probe path uses.
  const allowed = known.length ? known : await guessDomains(base44, college);

  const check = checkSubmittedUrl(body.url, allowed);
  if (!check.ok) {
    return Response.json({ status: 'submission_rejected', reason: check.reason, college, events: [] });
  }

  const days = Math.min(Math.max(Number(body.days) || DEFAULT_DAYS, 1), MAX_DAYS);

  let feed: { platform: string; feedUrl: string } | null = null;
  let events: NormalizedEvent[] = [];
  let failure = '';

  try {
    feed = await resolveSubmittedUrl(check.url, check.host, check.domain, allowed);
  } catch (err) {
    failure = err instanceof Error ? err.message : 'Could not read that address';
  }

  // Resolving is not enough. A feed that parses but has nothing upcoming is
  // the same dead end the student started in, and caching it would shadow a
  // working calendar we might otherwise find later.
  if (feed) {
    try {
      const asked = Date.now();
      events = (await fetchEvents(feed.platform, feed.feedUrl, days))
        .filter(isAttendable)
        .filter(e => stillUpcoming(e.start, e.end, e.all_day, asked));
      if (!events.length) {
        failure = 'That calendar has nothing coming up';
        feed = null;
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : 'That calendar would not load';
      feed = null;
    }
  }

  // The queue. Written for both outcomes on purpose: the failures are the only
  // record of what students tried that we could not read, which is the list
  // that says which adapter to write next.
  try {
    await base44.asServiceRole.entities.CampusFeedSubmission.create({
      college,
      university_id: university?.id || '',
      submitted_by: user.id,
      submitted_url: check.url,
      resolution: feed ? 'resolved' : 'failed',
      review_status: 'pending',
      resolved_platform: feed?.platform || '',
      resolved_feed_url: feed?.feedUrl || '',
      event_count: events.length,
      sample_titles: events.slice(0, SUBMISSION_SAMPLE_TITLES).map(e => e.title),
      failure_reason: failure,
    });
  } catch (err) {
    // Logging the submission must never cost the student the events it found —
    // but it must not vanish either. This entity is admin-only RLS and
    // asServiceRole does not bypass RLS, it acts AS admin, so a
    // misconfiguration here fails exactly like nothing happened: the student
    // still sees their events, the queue silently stays empty, and the school
    // never gets switched on for anyone else. Loud in the function logs is the
    // difference between a bug and a mystery.
    console.error('[campusEvents] could not record submission', {
      college,
      url: check.url,
      resolved: Boolean(feed),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!feed) {
    return Response.json({
      status: 'submission_failed',
      reason: failure || 'Nothing at that address reads as a calendar',
      college,
      events: [],
    });
  }

  const terms = termsFrom(
    profile?.career_interests,
    profile?.interests,
    profile?.favorite_topics,
    profile?.desired_skills,
    profile?.major,
    profile?.long_term_ambitions,
  );
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 40);

  return Response.json({
    status: 'ok',
    from_submission: true,
    college,
    source: feed.feedUrl,
    platform: feed.platform,
    window_days: days,
    matched_on: terms.slice(0, 25),
    events: events
      .map(e => ({ ...e, match_score: scoreEvent(e, terms) }))
      .sort((a, b) => (b.match_score - a.match_score) || (new Date(a.start).getTime() - new Date(b.start).getTime()))
      .slice(0, limit),
  });
}

// ── Review ──────────────────────────────────────────────────────────────────

/** How many submissions the review queue hands back at once. */
const REVIEW_PAGE_SIZE = 200;

/** Schools listed on the health page, and how many one check may fetch. */
const FEED_PAGE_LIMIT = 500;
const FEED_CHECK_LIMIT = 25;

/**
 * Admin is checked HERE, not in the page that calls this.
 *
 * The React route also checks the role, but that is so the wrong person sees a
 * sensible screen rather than a broken one. It is not what stops them: anyone
 * can call a backend function directly. These two actions read every
 * submission and write the calendar an entire school is served, so the check
 * that matters is the one on this side of the wire.
 */
// deno-lint-ignore no-explicit-any
function isAdmin(user: any): boolean {
  return user?.role === 'admin';
}

// ── Is a feed we already resolved still working? ────────────────────────────

/**
 * A school is probed once ever and then cached forever, which is the whole
 * point of the cache and also its one blind spot: nothing ever looks again. A
 * calendar that moves, expires, or simply empties out goes on being the
 * school's answer, and the only person who finds out is a student who sees an
 * empty screen and assumes the product is broken.
 *
 * So every ordinary fetch now reports back. Two rules keep it cheap and honest:
 *
 *   written on TRANSITION only — a feed that has been fine all week costs no
 *     writes at all, and one that just broke is stamped once. This runs on the
 *     hot path of every student's page load and must not add a write to it.
 *   ZERO EVENTS IS A FAILURE — not an error, but the same outcome for the
 *     student and the same job for us. A feed that reads perfectly and returns
 *     nothing is the single most likely way this breaks, because it is what an
 *     expired token, a moved calendar and a finished term all look like.
 */
// deno-lint-ignore no-explicit-any
async function recordFeedHealth(base44: any, university: any, error: string): Promise<void> {
  if (!university?.id) return;

  const wasFailing = Boolean(university.events_last_error);
  const isFailing = Boolean(error);
  // Nothing changed. This is the common case and it costs a boolean.
  if (wasFailing === isFailing && (!isFailing || university.events_last_error === error)) return;

  const now = new Date().toISOString();
  const patch = isFailing
    ? { events_last_error: error.slice(0, 300), events_last_error_at: now }
    : { events_last_error: '', events_last_error_at: '', events_last_ok_at: now };

  try {
    await base44.asServiceRole.entities.University.update(university.id, patch);
  } catch (_) {
    // Health is bookkeeping. It must never cost a student their events.
  }
}

/** Every school with a feed, and whether it is currently working. */
// deno-lint-ignore no-explicit-any
async function handleListFeeds(base44: any, user: any): Promise<Response> {
  if (!isAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const rows = await base44.asServiceRole.entities.University
      .filter({}, '-created_date', FEED_PAGE_LIMIT);
    // deno-lint-ignore no-explicit-any
    const feeds = rows.filter((row: any) => row.events_feed_url || row.events_platform === 'none');
    return Response.json({ feeds });
  } catch (_) {
    return Response.json({ feeds: [] });
  }
}

/**
 * Fetch every school's feed right now and write down what happened.
 *
 * The passive signal above only learns about a school somebody visited today,
 * and most schools have one student or none. This is the button that asks all
 * of them at once, so a calendar that died in June is found in June rather than
 * by the student it happens to fail for in September.
 *
 * Sequential on purpose. It is an admin pressing a button, not a page load, and
 * a dozen simultaneous whole-calendar fetches is a good way to get our own
 * function rate-limited by a school.
 */
// deno-lint-ignore no-explicit-any
async function handleCheckFeeds(base44: any, user: any): Promise<Response> {
  if (!isAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // deno-lint-ignore no-explicit-any
  let rows: any[] = [];
  try {
    rows = await base44.asServiceRole.entities.University
      .filter({}, '-created_date', FEED_PAGE_LIMIT);
  } catch (_) {
    return Response.json({ checked: [] });
  }

  // deno-lint-ignore no-explicit-any
  const withFeeds = rows.filter((r: any) => r.events_feed_url && adapterFor(r.events_platform));
  const checked: unknown[] = [];

  for (const row of withFeeds.slice(0, FEED_CHECK_LIMIT)) {
    const asked = Date.now();
    let error = '';
    let count = 0;
    try {
      // The store goes in here too, or every scraped school reports as a broken
      // feed on the health page and someone goes looking for a fault that is
      // this call not being given what it needs to read one.
      const events = (await fetchEvents(
        row.events_platform,
        row.events_feed_url,
        DEFAULT_DAYS,
        undefined,
        scrapedStore(base44),
      ))
        .filter(isAttendable)
        .filter(e => stillUpcoming(e.start, e.end, e.all_day, asked));
      count = events.length;
      if (!count) error = 'Returned no upcoming events';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Calendar feed unavailable';
    }
    await recordFeedHealth(base44, row, error);
    checked.push({
      id: row.id,
      college: row.canonical_name,
      platform: row.events_platform,
      feed_url: row.events_feed_url,
      event_count: count,
      error,
    });
  }

  return Response.json({
    checked,
    // Said out loud rather than silently truncated: a page reporting "all
    // healthy" while it only looked at half of them is worse than no page.
    skipped: Math.max(0, withFeeds.length - FEED_CHECK_LIMIT),
  });
}

/**
 * A student saying the calendar we found for their school is the wrong one.
 *
 * This is the only signal that exists for the failure the whole review queue is
 * built around. A feed can resolve, read cleanly and return a hundred real
 * events that belong to the library, the athletics department, or a different
 * campus of the same system — and nothing on our side can tell. The student
 * looking at it can tell immediately.
 *
 * It records and stops there. Acting on one report by pulling a school's
 * calendar would hand any single student a switch over everyone else's, so the
 * act stays where every other school-wide write already lives: the review page.
 */
// deno-lint-ignore no-explicit-any
async function handleReportFeed(base44: any, user: any, body: any): Promise<Response> {
  const profile = await loadProfile(base44, user);
  const college = collegeOf(profile, user);
  if (!college) return Response.json({ status: 'no_college' });

  const university = await findUniversity(base44, college);
  const feedUrl = university?.events_feed_url || '';
  if (!feedUrl) {
    // Nothing to report. A student with no feed already has the paste box.
    return Response.json({ status: 'no_feed' });
  }

  try {
    const db = base44.asServiceRole.entities.CampusFeedSubmission;
    // One open report per student per school. The button sits on a page they
    // reload, and a queue with the same complaint eleven times is a queue
    // nobody reads.
    const existing = await db.filter({}, '-created_date', REVIEW_PAGE_SIZE);
    const already = existing.find((r: { kind?: string; college?: string; submitted_by?: string; review_status?: string }) =>
      r.kind === 'report' &&
      r.review_status === 'pending' &&
      r.submitted_by === user.id &&
      normalizeName(r.college || '') === normalizeName(college)
    );
    if (already) return Response.json({ status: 'already_reported' });

    await db.create({
      kind: 'report',
      college,
      university_id: university?.id || '',
      submitted_by: user.id,
      // The feed being complained about, so the reviewer opens the thing under
      // discussion rather than going to look it up.
      submitted_url: feedUrl,
      resolved_feed_url: feedUrl,
      resolved_platform: university?.events_platform || '',
      resolution: 'resolved',
      review_status: 'pending',
      report_note: String(body?.note || '').slice(0, 500),
    });
  } catch (err) {
    console.error('[campusEvents] could not record a feed report', {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ status: 'report_failed' });
  }

  return Response.json({ status: 'reported' });
}

/** The queue, newest first. Failures included — they are the adapter backlog. */
// deno-lint-ignore no-explicit-any
async function handleListSubmissions(base44: any, user: any): Promise<Response> {
  if (!isAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const rows = await base44.asServiceRole.entities.CampusFeedSubmission
      .filter({}, '-created_date', REVIEW_PAGE_SIZE);
    return Response.json({ submissions: rows });
  } catch (_) {
    // The entity does not exist until this branch's schema syncs. An empty
    // queue is the honest answer, not a 500 on an admin's screen.
    return Response.json({ submissions: [] });
  }
}

/**
 * Approve or reject one submission.
 *
 * Approving is the write with real blast radius, and it does two things: marks
 * the row, then puts the feed on the University record so every student at
 * that school is served by the ordinary cached path. Writing it there rather
 * than leaving it on the submission is what keeps one school from having two
 * different answers to "where is your calendar".
 *
 * Rejecting only marks the row. It deliberately does not touch University: a
 * school we resolved ourselves must not be cleared because someone turned down
 * an unrelated paste.
 */
// deno-lint-ignore no-explicit-any
async function handleReviewSubmission(base44: any, user: any, body: any): Promise<Response> {
  if (!isAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = String(body.id || '').trim();
  const decision = String(body.decision || '');
  if (!id || (decision !== 'approved' && decision !== 'rejected')) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const db = base44.asServiceRole.entities.CampusFeedSubmission;

  // deno-lint-ignore no-explicit-any
  let row: any = null;
  try {
    const rows = await db.filter({ id }, '-created_date', 1);
    row = rows?.[0] || null;
  } catch (_) {
    row = null;
  }
  if (!row) return Response.json({ error: 'No such submission' }, { status: 404 });

  // Already decided. Without this, a rejected row can be flipped to approved
  // from the tab that hides it, and one mis-click promotes a calendar someone
  // already looked at and turned down to an entire school.
  if (row.review_status !== 'pending') {
    return Response.json(
      { error: `That submission was already ${row.review_status}.` },
      { status: 409 },
    );
  }

  // A report is the same decision pointed the other way, so it takes the same
  // two buttons and the opposite write. Upholding one is the only action that
  // actually fixes a school being served somebody else's calendar: take the
  // feed off, and let those students be asked where the right one is — which is
  // the state a school we never resolved is already in, and it works.
  //
  // Re-probing instead would be the obvious move and the wrong one: the probe
  // is deterministic, so it would find the same wrong calendar and hand it
  // straight back, with the complaint now marked handled.
  if (row.kind === 'report') {
    let cleared = false;
    if (decision === 'approved') {
      try {
        const uni = await findUniversity(base44, row.college);
        if (uni) {
          await base44.asServiceRole.entities.University.update(uni.id, {
            events_platform: 'none',
            events_feed_url: '',
            // Stamped now, which starts the thirty-day negative-cache clock.
            // Without it the next page load re-probes and restores the feed
            // that was just taken off.
            events_resolved_at: new Date().toISOString(),
            events_last_error: 'A student reported this calendar as the wrong one',
            events_last_error_at: new Date().toISOString(),
          });
          cleared = true;
        }
      } catch (_) {
        return Response.json(
          { error: "Couldn't take that feed off the school. Nothing changed." },
          { status: 500 },
        );
      }
    }
    try {
      await db.update(id, { review_status: decision });
    } catch (_) {
      return Response.json({ error: "Couldn't update that report" }, { status: 500 });
    }
    return Response.json({ ok: true, id, review_status: decision, cleared });
  }

  if (decision === 'approved' && !(row.resolved_feed_url && adapterFor(row.resolved_platform))) {
    return Response.json(
      { error: 'That submission never resolved to a readable calendar' },
      { status: 400 },
    );
  }

  let promoted = false;
  if (decision === 'approved') {
    const patch = {
      events_platform: row.resolved_platform,
      events_feed_url: row.resolved_feed_url,
      events_resolved_at: new Date().toISOString(),
      // A new feed does not inherit the old one's history. Left behind, the
      // reason the previous calendar was pulled would sit on the health page
      // as a live failure against a feed that has never been asked anything.
      events_last_error: '',
      events_last_error_at: '',
    };
    try {
      const uni = await findUniversity(base44, row.college);
      const universities = base44.asServiceRole.entities.University;
      if (uni) {
        const matchKeys = new Set([...(uni.match_keys || []), row.college]);
        await universities.update(uni.id, { ...patch, match_keys: [...matchKeys] });
      } else {
        await universities.create({
          canonical_name: row.college,
          match_keys: [row.college],
          approved_domains: [],
          active: true,
          ...patch,
        });
      }
      promoted = true;
    } catch (_) {
      // Leave the row pending rather than claim a school is switched over when
      // it is not. The admin sees it again and can retry.
      return Response.json(
        { error: "Couldn't write that feed to the school. Nothing changed." },
        { status: 500 },
      );
    }
  }

  try {
    await db.update(id, { review_status: decision });
  } catch (_) {
    return Response.json({ error: "Couldn't update that submission" }, { status: 500 });
  }

  return Response.json({ ok: true, id, review_status: decision, promoted });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body.action === 'submit_calendar_url') {
      return await handleSubmission(base44, user, body);
    }
    if (body.action === 'list_submissions') {
      return await handleListSubmissions(base44, user);
    }
    if (body.action === 'review_submission') {
      return await handleReviewSubmission(base44, user, body);
    }
    if (body.action === 'report_feed') {
      return await handleReportFeed(base44, user, body);
    }
    if (body.action === 'list_feeds') {
      return await handleListFeeds(base44, user);
    }
    if (body.action === 'check_feeds') {
      return await handleCheckFeeds(base44, user);
    }

    const days = Math.min(Math.max(Number(body.days) || DEFAULT_DAYS, 1), MAX_DAYS);
    // Keyword overlap is a weak signal on a real feed — plenty of genuinely
    // relevant events share no vocabulary with what a student typed. The
    // shortlist is deliberately wide so the ranking pass, which actually reads
    // the descriptions, gets a fair spread to choose from.
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 40);
    // How many dates one repeating event contributes. A list wants the next one
    // — a weekly club would otherwise take most of the slots to say one thing.
    // A month grid wants every Tuesday it meets on. See RECURRENCE_DEFAULT_DATES.
    const seriesDates = Number(body.seriesDates) || RECURRENCE_DEFAULT_DATES;

    const profile = await loadProfile(base44, user);
    const college = collegeOf(profile, user);
    if (!college) {
      return Response.json({ status: 'no_college', events: [], college: '' });
    }

    const { feed, university } = await resolveFeed(base44, college, user.id);
    if (!feed) {
      return Response.json({ status: 'no_feed', events: [], college });
    }

    // Stamped BEFORE the fetch, and it has to stay there. The expansion floor
    // inside `fetchEvents` reads its own clock, so if we read ours afterwards
    // the filter below is stricter than the expansion by however long the feed
    // took — up to the 12s ICS timeout. A request that straddles 00:00 UTC then
    // reproduces the 2026-08-03 revert exactly: expansion admits today's
    // all-day date, this filter calls it stale, and because callers ask for ONE
    // date per series the series spends its only slot on a value no student
    // sees. Reading the clock first can only make this filter more generous
    // than the expansion, which is the safe direction. `handleSubmission` does
    // the same thing for the same reason.
    const asked = Date.now();

    let normalized: NormalizedEvent[];
    try {
      normalized = await fetchEvents(
        feed.platform,
        feed.feedUrl,
        days,
        seriesDates,
        scrapedStore(base44),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Calendar feed unavailable';
      // Awaited, not fired and forgotten: this runtime can tear the request
      // down the moment we return, and a health record that loses the race is
      // worse than none — it reads as "still fine" on the page whose whole job
      // is to say otherwise.
      await recordFeedHealth(base44, university, message);
      return Response.json({ status: 'feed_error', events: [], college, error: message });
    }

    const terms = termsFrom(
      profile?.career_interests,
      profile?.interests,
      profile?.favorite_topics,
      profile?.desired_skills,
      profile?.major,
      profile?.long_term_ambitions,
      body.extraInterests
    );

    const events = normalized
      .filter(isAttendable)
      .filter(e => stillUpcoming(e.start, e.end, e.all_day, asked))
      .map(e => ({ ...e, match_score: scoreEvent(e, terms) }))
      .sort((a, b) => (b.match_score - a.match_score) || (new Date(a.start).getTime() - new Date(b.start).getTime()))
      .slice(0, limit);

    // Judged on what the calendar actually held, not on what survived ranking:
    // `events` has been cut to this student's interests and to `limit`, so a
    // healthy feed can legitimately leave it empty. `normalized` empty is the
    // feed itself having nothing, which is the failure worth recording.
    await recordFeedHealth(
      base44,
      university,
      normalized.length ? '' : 'Returned no upcoming events',
    );

    return Response.json({
      status: events.length ? 'ok' : 'no_matches',
      college,
      source: feed.feedUrl,
      window_days: days,
      matched_on: terms.slice(0, 25),
      events,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
});
