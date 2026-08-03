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
 * A school on none of the four returns zero events. That is the correct
 * outcome, not a gap to paper over with scraping.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 45;
const MAX_DAYS = 120;
const FEED_PAGE_SIZE = 100; // Localist's per-page ceiling
const PROBE_TIMEOUT_MS = 6000;
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
const BLOCKED_HOST_PARTS = ['localhost', '.local', '.internal', '.lan', 'metadata'];

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
  if (BLOCKED_HOST_PARTS.some(part => domain.includes(part))) return false;
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
  // deno-lint-ignore no-explicit-any
  fetch(feedUrl: string, days: number, seriesDates?: number): Promise<any[]>;
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
async function probeJson(url: string, guard: HopGuard = null): Promise<unknown> {
  const res = await guardedFetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  }, guard);
  // An unread body holds the connection open; these probes lose far more often
  // than they win, so the losers have to be closed explicitly.
  if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  return await res.json();
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
): Promise<string | null> {
  // Every request starts now, but they are read back in preference order, so
  // the first candidate answering in 40ms returns in 40ms instead of waiting
  // out a 6s timeout on a sibling subdomain that does not exist. Losing
  // probes are already caught, so nothing is left unhandled.
  const attempts = candidates.map(async (url) => {
    try {
      return isValid(await probeJson(url));
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
const ICS_VENDOR_HOSTS = ['calendar.google.com'];

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
  const earliest = now - 3600000;
  const latest = now + windowDays * 86400000;

  // Do NOT lower this floor for date-only series without also fixing the two
  // request-time filters (search for `starts >= now - 3600000`). That was tried
  // on 2026-08-03 and reverted the same day, measured against all 38 real school
  // feeds: it lost 5 upcoming listings across 28 days and gained nothing, ever.
  //
  // Why it backfires. A bare "2026-08-03" parses to UTC midnight, so from 01:00
  // UTC onward it is already below `now - 1h` at the request filter. Lowering
  // only this floor makes the expansion hand back today's date, the filter then
  // discards it, and because callers ask for one date the series spends its only
  // slot on a value that never reaches the student — so a weekly all-day club
  // contributes nothing instead of showing its genuine next date.
  //
  // The invariant below is what keeps that honest: a date surviving here cannot
  // be dropped as stale one step later. Any real fix has to make the request
  // filters all-day-aware in the same change.

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

    // A cancelled event is the one thing worse than no event: the student goes.
    // Every other adapter already drops these — Localist by `is_canceled`,
    // LiveWhale by `canceled`, Campus Labs by requiring "Approved" — and iCal
    // was the only one still handing them through.
    if ((props.STATUS || '').trim().toUpperCase() === 'CANCELLED') continue;

    const end = icsDate(props.DTEND || '');
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

/** A calendar is only useful to us if it still has something ahead of today. */
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

/** Events with a real start_date, not merely a 200 from some other plugin. */
export function looksLikeTribe(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const events = (payload as Record<string, unknown>).events;
  if (!Array.isArray(events) || !events.length) return false;
  const first = events[0];
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
  if (!looksLikeTribe(body)) throw new Error('Calendar feed returned an unexpected shape');
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
  campusLabsAdapter,
  // Beside Campus Labs, and after it: same one-request cost, and a school
  // running both should get its campus-wide calendar rather than its clubs.
  campusGroupsAdapter,
  presenceAdapter,
  tribeAdapter,
  trumbaAdapter,
  drupalAdapter,
  icalAdapter,
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

/** "campuscalendar.ucsb.edu" and "ucsb.edu" are the same institution. */
function sameSite(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
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
): Promise<{ hosts: string[]; domains: string[]; icsUrls: string[] }> {
  const alreadyTried = new Set([domain, ...SUBDOMAIN_CANDIDATES.map(s => `${s}.${domain}`)]);
  const hosts = new Set<string>();
  const domains = new Set<string>();
  const icsUrls = new Set<string>();

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

    for (const match of page.html.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = stripWww(match[1].toLowerCase());
      if (alreadyTried.has(host) || hosts.has(host)) continue;
      if (!isProbeableDomain(host) || !sameSite(host, domain)) continue;
      const label = host.slice(0, Math.max(0, host.length - domain.length - 1));
      if (label && CALENDAR_LABEL_RE.test(label)) hosts.add(host);
    }

    // The same pages carry the "Subscribe" links, and those are how the
    // un-guessable feeds are reachable at all: Boston University's lives at
    // /phpbin/calendar/ical.php and Babson's under a per-group ical path. No
    // list of guessed paths was ever going to contain either.
    for (const url of icsLinksFrom(page.html, domain, page.finalUrl)) icsUrls.add(url);
  }

  return {
    hosts: [...hosts].slice(0, MAX_DISCOVERED_HOSTS),
    domains: [...domains].slice(0, MAX_DISCOVERED_DOMAINS),
    icsUrls: [...icsUrls].slice(0, MAX_DISCOVERED_ICS),
  };
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

  let found: { hosts: string[]; domains: string[]; icsUrls: string[] };
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
    } catch (_) { /* Fall through to the alias domains. */ }
  }

  for (const alias of found.domains) {
    try {
      const hit = await probeCalendar(alias, { discover: false });
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

  // 3. The page that embeds the calendar. This is what most students will
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

  // 4. Whatever host the page actually landed on, checked the way discovery
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
): Promise<NormalizedEvent[]> {
  const adapter = adapterFor(platform);
  if (!adapter) throw new Error(`Unsupported calendar platform "${platform}"`);
  const raw = await adapter.fetch(feedUrl, days, seriesDates);
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
      events = (await fetchEvents(feed.platform, feed.feedUrl, days))
        .filter(isAttendable)
        .filter(e => {
          const starts = new Date(e.start).getTime();
          return Number.isFinite(starts) && starts >= Date.now() - 3600000;
        });
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

    const { feed } = await resolveFeed(base44, college, user.id);
    if (!feed) {
      return Response.json({ status: 'no_feed', events: [], college });
    }

    let normalized: NormalizedEvent[];
    try {
      normalized = await fetchEvents(feed.platform, feed.feedUrl, days, seriesDates);
    } catch (err) {
      return Response.json({
        status: 'feed_error',
        events: [],
        college,
        error: err instanceof Error ? err.message : 'Calendar feed unavailable',
      });
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

    const now = Date.now();
    const events = normalized
      .filter(isAttendable)
      .filter(e => {
        const starts = new Date(e.start).getTime();
        return Number.isFinite(starts) && starts >= now - 3600000;
      })
      .map(e => ({ ...e, match_score: scoreEvent(e, terms) }))
      .sort((a, b) => (b.match_score - a.match_score) || (new Date(a.start).getTime() - new Date(b.start).getTime()))
      .slice(0, limit);

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
