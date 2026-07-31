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
 * Platform: Localist (Concept3D). It runs a large share of US campus calendars,
 * always at events.<domain>/api/2/events, open and unauthenticated.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DAYS = 45;
const MAX_DAYS = 120;
const FEED_PAGE_SIZE = 100; // Localist's per-page ceiling
const PROBE_TIMEOUT_MS = 6000;
const FEED_TIMEOUT_MS = 9000;

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
  for (const sub of SUBDOMAIN_CANDIDATES) {
    const base = `https://${sub}.${domain}/api/2/events`;
    try {
      const res = await fetch(`${base}?days=1&pp=1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;
      if (looksLikeLocalist(await res.json())) return base;
    } catch (_) {
      // Unreachable, timed out, or not JSON — try the next subdomain.
    }
  }
  return null;
}

/**
 * Free-text college name -> web domain, via the model.
 *
 * Safe to guess wrong: probeLocalist() has to succeed against the real host
 * before anything is returned to a student, so a bad guess yields no events
 * rather than fake ones.
 */
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
async function resolveFeed(base44: any, college: string) {
  const key = normalizeName(college);
  if (!key) return { feedUrl: null, university: null };

  const db = base44.asServiceRole.entities.University;

  let university = null;
  try {
    const rows = await db.filter({}, '-created_date', 500);
    university = rows.find((row: any) => {
      if (normalizeName(row.canonical_name) === key) return true;
      return (row.match_keys || []).some((k: string) => normalizeName(k) === key);
    }) || null;
  } catch (_) {
    university = null;
  }

  // Already resolved — use the cache.
  if (university?.events_platform === 'localist' && university.events_feed_url) {
    return { feedUrl: university.events_feed_url, university };
  }
  if (university?.events_platform === 'none' && university.events_resolved_at) {
    const age = Date.now() - new Date(university.events_resolved_at).getTime();
    if (age < NEGATIVE_RECHECK_DAYS * 86400000) {
      return { feedUrl: null, university };
    }
  }

  // Prefer domains we already trust over anything the model produces.
  const known = (university?.approved_domains || [])
    .map((d: string) => stripWww(String(d).toLowerCase().trim()))
    .filter(isProbeableDomain);
  const candidates = [...new Set([...known, ...(await guessDomains(base44, college))])];

  let feedUrl: string | null = null;
  for (const domain of candidates) {
    feedUrl = await probeLocalist(domain);
    if (feedUrl) break;
  }

  const patch = {
    events_platform: feedUrl ? 'localist' : 'none',
    events_feed_url: feedUrl || '',
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

  return { feedUrl, university };
}

// ── Feed ────────────────────────────────────────────────────────────────────

/** Localist nests instances as [{ event_instance: {...} }]; older feeds do not. */
function firstInstance(event: any) {
  const raw = Array.isArray(event?.event_instances) ? event.event_instances[0] : null;
  return raw?.event_instance || raw || null;
}

function filterNames(event: any, group: string): string[] {
  const entries = event?.filters?.[group];
  if (!Array.isArray(entries)) return [];
  return entries.map((e: any) => e?.name).filter(Boolean);
}

export function normalizeEvent(event: any) {
  const instance = firstInstance(event);
  return {
    id: String(event.id),
    title: event.title || '',
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
    departments: (event.departments || []).map((d: any) => d?.name).filter(Boolean),
    topics: filterNames(event, 'event_topics'),
    types: filterNames(event, 'event_types'),
    audience: filterNames(event, 'event_audience'),
    keywords: Array.isArray(event.keywords) ? event.keywords.filter(Boolean) : [],
  };
}

/**
 * Keyword overlap against what the student told us at onboarding.
 *
 * Deliberately crude — its only job is to cut a 200-event feed down to a
 * shortlist small enough to hand the model. The real judgment happens there.
 */
export function scoreEvent(event: any, terms: string[]): number {
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
export function isAttendable(event: any): boolean {
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
    .map((wrapper: any) => wrapper?.event || wrapper)
    .filter(Boolean);
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

    const { feedUrl } = await resolveFeed(base44, college);
    if (!feedUrl) {
      return Response.json({ status: 'no_feed', events: [], college });
    }

    let raw: any[];
    try {
      raw = await fetchFeed(feedUrl, days);
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
    const events = raw
      .map(normalizeEvent)
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
      source: feedUrl,
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
