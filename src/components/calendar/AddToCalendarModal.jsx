import { useState } from 'react';
import { X, Calendar, Download, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const REMINDER_OPTIONS = [
  { label: 'At start time', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '10 minutes before', value: 10 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
  { label: 'No reminder', value: null },
  { label: 'Custom…', value: 'custom' },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
  'Australia/Sydney', 'UTC',
];

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]';

export default function AddToCalendarModal({ item, itemType, onClose }) {
  // itemType: 'mission' | 'task' | 'outreach' | 'experiment'
  const defaultDate = item?.deadline || item?.date || item?.followup_date || '';
  const defaultTitle = itemType === 'mission'
    ? `[Mission] ${item?.title || ''}`
    : itemType === 'outreach'
    ? `Follow up: ${item?.name || ''}`
    : itemType === 'experiment'
    ? `[Experiment] ${item?.title || ''}`
    : item?.task_title || item?.title || '';
  const defaultDesc = item?.objective || item?.description || item?.reason_for_contact || '';

  const [form, setForm] = useState({
    title: defaultTitle,
    description: defaultDesc,
    date: defaultDate,
    start_time: '09:00',
    end_time: '10:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    reminder: 15,
    customMinutes: '',
  });
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const effectiveReminder = form.reminder === 'custom'
    ? (parseInt(form.customMinutes, 10) || null)
    : form.reminder;

  const handleDownload = async () => {
    if (!form.date) { setError('Please select a date.'); return; }
    setError('');
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('generateICS', {
        mode: 'single',
        eventId: item?.id,
        reminderMinutes: effectiveReminder,
        timezone: form.timezone,
        // Override with form values by passing them as metadata
        // We'll build a virtual event from the form since item may not have these fields set
        _overrides: {
          title: form.title,
          description: form.description,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
        },
      });

      // Build ICS client-side from form data (more reliable than server round-trip for single events)
      downloadICSFromForm(form, effectiveReminder, item?.id || 'new');
      setDone(true);
    } catch (err) {
      // Fallback: build ICS entirely client-side
      downloadICSFromForm(form, effectiveReminder, item?.id || 'new');
      setDone(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: 'var(--brand-navy-900)' }} />
            <h2 className="font-heading text-lg font-bold text-[#050816]">Add to Calendar</h2>
          </div>
          <button onClick={onClose}><X size={18} className="text-[#64748B]" /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#F0FDF4' }}>
              <Calendar size={24} className="text-green-600" />
            </div>
            <p className="font-heading font-bold text-[#050816] mb-1">Download started!</p>
            <p className="text-sm text-[#64748B] mb-5">Open the .ics file to add it to Google Calendar, Apple Calendar, Outlook, or any calendar app.</p>
            <div className="flex gap-2">
              <button onClick={() => setDone(false)} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
                Export Again
              </button>
              <button onClick={onClose} className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#334155] block mb-1">Event title</span>
                <input name="title" value={form.title} onChange={ch} className={inputCls} />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#334155] block mb-1">Description (optional)</span>
                <textarea name="description" value={form.description} onChange={ch} rows={2}
                  className={inputCls + ' resize-none'} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#334155] block mb-1">Date</span>
                  <input type="date" name="date" value={form.date} onChange={ch} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#334155] block mb-1">Timezone</span>
                  <select name="timezone" value={form.timezone} onChange={ch} className={inputCls}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#334155] block mb-1">Start time</span>
                  <input type="time" name="start_time" value={form.start_time} onChange={ch} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#334155] block mb-1">End time</span>
                  <input type="time" name="end_time" value={form.end_time} onChange={ch} className={inputCls} />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[#334155] block mb-1">
                  <Clock size={11} className="inline mr-1" />Reminder
                </span>
                <select name="reminder" value={form.reminder} onChange={e => setForm(f => ({ ...f, reminder: e.target.value === 'null' ? null : e.target.value === 'custom' ? 'custom' : parseInt(e.target.value, 10) }))} className={inputCls}>
                  {REMINDER_OPTIONS.map(o => (
                    <option key={String(o.value)} value={o.value === null ? 'null' : o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {form.reminder === 'custom' && (
                <label className="block">
                  <span className="text-xs font-semibold text-[#334155] block mb-1">Minutes before</span>
                  <input type="number" min="1" name="customMinutes" value={form.customMinutes} onChange={ch}
                    placeholder="e.g. 45" className={inputCls} />
                </label>
              )}
            </div>

            {error && <p className="mt-3 text-xs text-red-600 font-semibold">{error}</p>}

            <div className="mt-5 rounded-[12px] p-3 text-xs text-[#64748B]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              Downloads an .ics file compatible with Google Calendar, Apple Calendar, Outlook, and all standard calendar apps.
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
                Cancel
              </button>
              <button onClick={handleDownload} disabled={downloading || !form.date}
                className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Download size={14} />
                {downloading ? 'Preparing…' : 'Download .ics'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Client-side ICS builder — reliable fallback that doesn't need a round-trip
export function downloadICSFromForm(form, reminderMinutes, uid) {
  function esc(s) {
    return (s || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  }
  function toStamp(date, time) {
    if (!date) return null;
    if (!time) return date.replace(/-/g,'');
    const dt = new Date(`${date}T${time}`);
    if (isNaN(dt.getTime())) return date.replace(/-/g,'');
    const p = n => String(n).padStart(2,'0');
    return `${dt.getFullYear()}${p(dt.getMonth()+1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`;
  }

  const allDay = !form.start_time;
  const dtStart = toStamp(form.date, form.start_time);
  const dtEnd = toStamp(form.date, form.end_time) || dtStart;
  const now = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unscripted//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}-unscripted@app`,
    `DTSTAMP:${now}`,
    allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
    allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
    `SUMMARY:${esc(form.title)}`,
    form.description ? `DESCRIPTION:${esc(form.description)}` : null,
  ].filter(Boolean);

  if (typeof reminderMinutes === 'number') {
    lines.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:Reminder`,
      reminderMinutes === 0 ? 'TRIGGER:PT0S' : `TRIGGER:-PT${reminderMinutes}M`,
      'END:VALARM');
  }
  lines.push('END:VEVENT','END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unscripted-event.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}