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
  // deno-lint-ignore no-explicit-any
  fetch(feedUrl: string, days: number): Promise<any[]>;
  // deno-lint-ignore no-explicit-any
  normalize(raw: any, feedUrl: string): NormalizedEvent;
}

/** GET a candidate URL and hand back parsed JSON, or null for anything else. */
async function probeJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
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
    is_free: false,
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
    is_free: event.free !== false,
    ticket_url: event.ticket_url || '',
    has_register: Boolean(event.has_register),
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
): Promise<{ finalHost: string; finalUrl: string; html: string }> {
  const res = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml,*/*', 'User-Agent': BROWSER_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });

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
 * date order — Syracuse publishes 1,506 and Duke's opens on entries from 2007.
 * A cap low enough to bite would therefore throw away the future and keep the
 * past, and the feed would read as empty rather than large. The real bound is
 * ICS_MAX_BYTES; this only stops a pathological file from spinning.
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

/**
 * One DTSTART/DTEND value, as a string the client can render.
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
function icsDate(value: string): { value: string; allDay: boolean } | null {
  const text = (value || '').trim();

  const utc = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    const at = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    return Number.isFinite(at) ? { value: new Date(at).toISOString(), allDay: false } : null;
  }

  const local = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    return { value: `${y}-${mo}-${d}T${h}:${mi}:${s}`, allDay: false };
  }

  const dateOnly = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return { value: `${y}-${mo}-${d}`, allDay: true };
  }

  return null;
}

/**
 * Every VEVENT in a calendar, minus the ones we cannot date honestly.
 *
 * Events carrying an RRULE are dropped outright. A weekly meeting whose master
 * record is dated 2007 is still running today, but working out which Tuesday it
 * next falls on means implementing recurrence — UNTIL, COUNT, BYDAY, EXDATE and
 * the daylight-saving edges — and every bug in that sends a student to a room
 * on the wrong day. Duke's feed carries exactly these: live weekly entries
 * whose DTSTART reads 2007. Showing nothing is the honest failure here.
 */
export function parseIcsEvents(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Record<string, string> | null = null;
  let recurring = false;

  for (const line of unfoldIcs(text)) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      recurring = false;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && !recurring) {
        const start = icsDate(current.DTSTART || '');
        if (start) {
          const end = icsDate(current.DTEND || '');
          events.push({
            uid: current.UID || '',
            summary: unescapeIcsText(current.SUMMARY || ''),
            description: unescapeIcsText(current.DESCRIPTION || ''),
            location: unescapeIcsText(current.LOCATION || ''),
            url: current.URL || '',
            categories: (current.CATEGORIES || '')
              .split(',')
              .map(c => unescapeIcsText(c).trim())
              .filter(Boolean),
            start: start.value,
            end: end?.value || '',
            allDay: start.allDay,
          });
        }
      }
      current = null;
      if (events.length >= ICS_MAX_EVENTS) break;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon < 1) continue;
    // "DTSTART;TZID=America/New_York" -> name DTSTART, params discarded.
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);

    if (name === 'RRULE') recurring = true;
    else if (!(name in current)) current[name] = value;
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
): Promise<string> {
  const res = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
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
async function fetchIcsText(url: string, timeoutMs: number): Promise<string> {
  const attempts: Record<string, string>[] = [
    { Accept: 'text/calendar,text/plain,*/*' },
    { Accept: 'text/calendar,text/plain,*/*', 'User-Agent': BROWSER_UA },
  ];
  for (const headers of attempts) {
    let text = '';
    try {
      text = await fetchIcsOnce(url, timeoutMs, headers);
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
async function firstValidIcs(candidates: string[]): Promise<string | null> {
  const attempts = candidates.map(async (url) => {
    try {
      return looksLikeIcal(await fetchIcsText(url, ICS_PROBE_TIMEOUT_MS));
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

async function fetchIcal(feedUrl: string, days: number) {
  const text = await fetchIcsText(feedUrl, ICS_FEED_TIMEOUT_MS);
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Calendar feed returned an unexpected shape');
  }
  return parseIcsEvents(text).filter(e => withinWindow(e.start, days));
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
    is_free: event.cost === '' || Boolean(event.is_free),
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
  campusLabsAdapter,
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

export async function fetchEvents(
  platform: string,
  feedUrl: string,
  days: number,
): Promise<NormalizedEvent[]> {
  const adapter = adapterFor(platform);
  if (!adapter) throw new Error(`Unsupported calendar platform "${platform}"`);
  const raw = await adapter.fetch(feedUrl, days);
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

/**
 * Finds (or creates) the University row for this school and makes sure its
 * feed URL is resolved. One probe per school, ever — not one per page load.
 */
// deno-lint-ignore no-explicit-any
async function resolveFeed(base44: any, college: string) {
  const key = normalizeName(college);
  if (!key) return { feed: null, university: null };

  const db = base44.asServiceRole.entities.University;

  let university = null;
  try {
    const rows = await db.filter({}, '-created_date', 500);
    // deno-lint-ignore no-explicit-any
    university = rows.find((row: any) => {
      if (normalizeName(row.canonical_name) === key) return true;
      return (row.match_keys || []).some((k: string) => normalizeName(k) === key);
    }) || null;
  } catch (_) {
    university = null;
  }

  // Already resolved — platform plus URL is everything an adapter needs, so a
  // cached school never gets probed again.
  if (university?.events_feed_url && adapterFor(university.events_platform)) {
    return {
      feed: { platform: university.events_platform, feedUrl: university.events_feed_url },
      university,
    };
  }
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || DEFAULT_DAYS, 1), MAX_DAYS);
    // Keyword overlap is a weak signal on a real feed — plenty of genuinely
    // relevant events share no vocabulary with what a student typed. The
    // shortlist is deliberately wide so the ranking pass, which actually reads
    // the descriptions, gets a fair spread to choose from.
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 40);

    // The college is read from the student's own profile, never taken from the
    // caller — this function fetches remote URLs, so the host it builds must
    // not be steerable from the client.
    // deno-lint-ignore no-explicit-any
    let profile: any = null;
    try {
      const rows = await base44.entities.StudentProfile.filter({ user_id: user.id }, '-created_date', 1);
      profile = rows?.[0] || null;
    } catch (_) {
      profile = null;
    }

    const college = (profile?.college || user.college || '').trim();
    if (!college || college.toLowerCase() === 'not specified') {
      return Response.json({ status: 'no_college', events: [], college: '' });
    }

    const { feed } = await resolveFeed(base44, college);
    if (!feed) {
      return Response.json({ status: 'no_feed', events: [], college });
    }

    let normalized: NormalizedEvent[];
    try {
      normalized = await fetchEvents(feed.platform, feed.feedUrl, days);
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
