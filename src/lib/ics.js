/**
 * iCalendar (.ics) generation — RFC 5545.
 *
 * Every calendar export in the app funnels through here. It used to be written
 * out by hand at each call site, which is how the week and mission exports ended
 * up with `lines.push(...).filter(Boolean)` — push() returns a number, so the
 * export threw the moment a student actually had something to export.
 *
 * Two rules the hand-written copies kept breaking, both of which calendar apps
 * enforce:
 *
 *  - Dates are strings, never Date objects. `new Date('2026-08-07')` is UTC
 *    midnight, so reading it back with local getters west of UTC lands on the
 *    previous day — which turned the exclusive end date of an all-day event into
 *    the start date and produced zero-length events Google and Apple both drop.
 *    All date arithmetic here is done in UTC on plain YYYYMMDD strings.
 *  - Content lines are folded at 75 octets and joined with CRLF (RFC 5545 §3.1).
 */

const CRLF = '\r\n';
const MAX_OCTETS = 75;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const pad2 = n => String(n).padStart(2, '0');

/** Escapes a TEXT value per RFC 5545 §3.3.11. */
export function escapeICSText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    // Every flavour of line break becomes the \n escape. Leaving a raw CR in
    // place splits the record for strict parsers.
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds one content line to 75 octets, continuation lines prefixed with a single
 * space. Counts UTF-8 bytes, not characters, and never splits a code point.
 */
export function foldICSLine(line) {
  const text = String(line ?? '');
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= MAX_OCTETS) return text;

  const out = [];
  let current = '';
  let octets = 0;
  let limit = MAX_OCTETS;

  for (const char of text) {
    const size = encoder.encode(char).length;
    if (octets + size > limit) {
      out.push(current);
      current = ' ';
      octets = 1;
      limit = MAX_OCTETS;
    }
    current += char;
    octets += size;
  }
  out.push(current);
  return out.join(CRLF);
}

/** 'YYYY-MM-DD' (or 'YYYYMMDD') → 'YYYYMMDD', or null when it isn't a date. */
export function icsDate(dateStr) {
  const raw = String(dateStr ?? '').trim();
  if (!raw) return null;
  const m = DATE_RE.exec(raw) || /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}${mo}${d}`;
}

/**
 * 'YYYY-MM-DD' + 'HH:MM' → 'YYYYMMDDTHHMMSS', a floating local time. No Date is
 * involved, so a value never shifts across a daylight-saving boundary.
 */
export function icsDateTime(dateStr, timeStr) {
  const date = icsDate(dateStr);
  if (!date) return null;
  const m = TIME_RE.exec(String(timeStr ?? '').trim());
  if (!m) return null;
  const [, h, mi, s] = m;
  if (Number(h) > 23 || Number(mi) > 59) return null;
  return `${date}T${pad2(h)}${mi}${s || '00'}`;
}

/** Adds whole days to a YYYYMMDD string in UTC, so the local zone can't shift it. */
export function addICSDays(icsDateStr, days) {
  const date = icsDate(icsDateStr);
  if (!date) return null;
  const d = new Date(Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
  ));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** A CalendarTasks row → an event, or null when it has no usable date. */
export function calendarTaskEvent(task) {
  if (!task) return null;
  const allDay = !task.start_time;
  const start = allDay ? icsDate(task.date) : icsDateTime(task.date, task.start_time);
  if (!start) return null;
  return {
    uid: `${task.id}-unscripted@app`,
    summary: task.title,
    description: task.description,
    start,
    end: allDay ? null : (icsDateTime(task.date, task.end_time) || start),
    allDay,
  };
}

/** A Missions row → an all-day event on its deadline, or null without one. */
export function missionEvent(mission) {
  if (!mission) return null;
  const start = icsDate(mission.deadline);
  if (!start) return null;
  return {
    uid: `${mission.id}-unscripted@app`,
    summary: `[Mission] ${mission.title || ''}`.trim(),
    description: mission.objective,
    start,
    end: null,
    allDay: true,
  };
}

function eventLines(event, dtstamp) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${event.start}`);
    // DTEND is exclusive for a DATE value, so a one-day event ends the next day.
    lines.push(`DTEND;VALUE=DATE:${addICSDays(event.end || event.start, 1)}`);
  } else {
    lines.push(`DTSTART:${event.start}`);
    lines.push(`DTEND:${event.end || event.start}`);
  }

  lines.push(`SUMMARY:${escapeICSText(event.summary)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeICSText(event.location)}`);

  if (typeof event.reminderMinutes === 'number' && Number.isFinite(event.reminderMinutes)) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICSText(`Reminder: ${event.summary || ''}`)}`,
      event.reminderMinutes === 0 ? 'TRIGGER:PT0S' : `TRIGGER:-PT${event.reminderMinutes}M`,
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Builds a whole calendar. Nulls in `events` are skipped, so the mappers above
 * can be used directly on a list of rows.
 */
export function buildICS(events, { calendarName = 'Unscripted', timezone = '' } = {}) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unscripted//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
  ];
  // Timezone identifiers are letters, digits, '/', '_', '+' and '-'. Anything
  // else — a CR or LF above all — could inject extra calendar lines.
  const tz = String(timezone || '').replace(/[^A-Za-z0-9/_+-]/g, '');
  if (tz) lines.push(`X-WR-TIMEZONE:${tz}`);

  for (const event of Array.isArray(events) ? events : []) {
    if (!event || !event.start) continue;
    lines.push(...eventLines(event, dtstamp));
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldICSLine).join(CRLF);
}

/** How many events a calendar actually contains — 0 means nothing to download. */
export function countICSEvents(icsText) {
  return (String(icsText || '').match(/BEGIN:VEVENT/g) || []).length;
}

/** Hands the calendar to the browser as a file download. */
export function downloadICSFile(icsText, filename) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
