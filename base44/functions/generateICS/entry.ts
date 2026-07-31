import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function escapeICS(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// Timezone identifiers only contain letters, digits, '/', '_', '+', '-'.
// Anything else (notably CR/LF) would allow injecting extra iCalendar lines.
function sanitizeTimezone(tz) {
  const cleaned = String(tz || '').replace(/[^A-Za-z0-9/_+-]/g, '');
  return cleaned || 'America/New_York';
}

function toICSDate(dateStr, timeStr, allDay) {
  if (!dateStr) return null;
  if (allDay || !timeStr) {
    const d = dateStr.replace(/-/g, '');
    return { value: d, allDay: true };
  }
  // Combine date + time into UTC-style stamp (keep as local, add no Z so calendar apps respect it)
  const dt = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(dt.getTime())) {
    const d = dateStr.replace(/-/g, '');
    return { value: d, allDay: true };
  }
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  return { value: stamp, allDay: false };
}

function makeUID(id) {
  return `${id}-unscripted@app`;
}

function buildEvent({ uid, summary, description, location, dtstart, dtend, allDay, reminderMinutes }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
  ];

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    // End date for all-day is exclusive — next day
    const endDate = new Date(dtstart.substring(0,4)+'-'+dtstart.substring(4,6)+'-'+dtstart.substring(6,8));
    endDate.setDate(endDate.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    const endStr = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}`;
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
  } else {
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend || dtstart}`);
  }

  lines.push(`SUMMARY:${escapeICS(summary)}`);
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
  if (location) lines.push(`LOCATION:${escapeICS(location)}`);

  // Reminder / VALARM
  if (typeof reminderMinutes === 'number') {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Reminder: ${escapeICS(summary)}`);
    if (reminderMinutes === 0) {
      lines.push('TRIGGER:PT0S');
    } else {
      lines.push(`TRIGGER:-PT${reminderMinutes}M`);
    }
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { mode, eventId, weekStart, timezone } = body;
    // mode: 'single' | 'week' | 'all_missions'

    const calLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Unscripted//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Unscripted`,
      `X-WR-TIMEZONE:${sanitizeTimezone(timezone)}`,
    ];

    if (mode === 'single' && eventId) {
      // Export one specific CalendarTask or Mission by id
      // Try CalendarTask first, then Mission
      let item = null;
      let type = null;
      try {
        const tasks = await base44.entities.CalendarTasks.filter({ id: eventId, user_id: user.id });
        if (tasks.length > 0) { item = tasks[0]; type = 'task'; }
      } catch(_) {}
      if (!item) {
        try {
          const missions = await base44.entities.Missions.filter({ id: eventId, user_id: user.id });
          if (missions.length > 0) { item = missions[0]; type = 'mission'; }
        } catch(_) {}
      }
      if (!item) {
        return Response.json({ error: 'Event not found' }, { status: 404 });
      }

      const summary = type === 'task' ? item.title : item.title;
      const desc = type === 'task' ? item.description : item.objective;
      const dateStr = type === 'task' ? item.date : item.deadline;
      const startTime = type === 'task' ? item.start_time : null;
      const endTime = type === 'task' ? item.end_time : null;
      const reminder = body.reminderMinutes;

      const dtStart = toICSDate(dateStr, startTime, !startTime);
      const dtEnd = endTime ? toICSDate(dateStr, endTime, false) : dtStart;

      if (dtStart) {
        calLines.push(buildEvent({
          uid: makeUID(item.id),
          summary,
          description: desc,
          dtstart: dtStart.value,
          dtend: dtEnd.value,
          allDay: dtStart.allDay,
          reminderMinutes: typeof reminder === 'number' ? reminder : undefined,
        }));
      }

    } else if (mode === 'week' && weekStart) {
      // Export all tasks for a given week (7 days from weekStart)
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);

      const tasks = await base44.entities.CalendarTasks.filter({ user_id: user.id }, '-date', 200);
      const weekTasks = tasks.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d >= start && d < end;
      });

      for (const t of weekTasks) {
        const dtStart = toICSDate(t.date, t.start_time, !t.start_time);
        const dtEnd = t.end_time ? toICSDate(t.date, t.end_time, false) : dtStart;
        if (dtStart) {
          calLines.push(buildEvent({
            uid: makeUID(t.id),
            summary: t.title,
            description: t.description,
            dtstart: dtStart.value,
            dtend: dtEnd.value,
            allDay: dtStart.allDay,
          }));
        }
      }

    } else if (mode === 'all_missions') {
      // Export all active missions with deadlines
      const missions = await base44.entities.Missions.filter({ user_id: user.id }, '-created_date', 200);
      const activeMissions = missions.filter(m => m.status !== 'completed' && m.status !== 'skipped' && m.deadline);

      for (const m of activeMissions) {
        const dtStart = toICSDate(m.deadline, null, true);
        if (dtStart) {
          calLines.push(buildEvent({
            uid: makeUID(m.id),
            summary: `[Mission] ${m.title}`,
            description: m.objective,
            dtstart: dtStart.value,
            dtend: dtStart.value,
            allDay: true,
          }));
        }
      }
    } else {
      return Response.json({ error: 'Invalid mode or missing parameters' }, { status: 400 });
    }

    calLines.push('END:VCALENDAR');
    const icsContent = calLines.join('\r\n');

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="unscripted-${mode}.ics"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});