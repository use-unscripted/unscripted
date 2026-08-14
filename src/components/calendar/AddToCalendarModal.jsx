import { useState } from 'react';
import { X, Calendar, Download, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildICS, downloadICSFile, icsDate, icsDateTime } from '@/lib/ics';

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

const inputCls = 'w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]';

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

  // Only claim the download started if a file actually left the browser.
  const finishDownload = () => {
    if (downloadICSFromForm(form, effectiveReminder, item?.id || 'new')) setDone(true);
    else setError('That date could not be read. Please pick it again.');
  };

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
      finishDownload();
    } catch (err) {
      // Fallback: build ICS entirely client-side
      finishDownload();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[var(--r-surface)] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: 'var(--brand-navy-900)' }} />
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">Add to Calendar</h2>
          </div>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-500)]" /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--success-50)' }}>
              <Calendar size={24} className="text-green-600" />
            </div>
            <p className="tp-card text-[color:var(--surface-dark-900)] mb-1.5">Download started!</p>
            <p className="tp-prose mx-auto text-[color:var(--ink-500)] mb-5">Open the .ics file to add it to Google Calendar, Apple Calendar, Outlook, or any calendar app.</p>
            <div className="flex gap-2">
              <button onClick={() => setDone(false)} className="tp-body flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
                Export Again
              </button>
              <button onClick={onClose} className="tp-body flex-1 rounded-[var(--r-control)] py-3 font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block">
                <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Event title</span>
                <input name="title" value={form.title} onChange={ch} className={inputCls} />
              </label>

              <label className="block">
                <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Description (optional)</span>
                <textarea name="description" value={form.description} onChange={ch} rows={2}
                  className={inputCls + ' resize-none'} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Date</span>
                  <input type="date" name="date" value={form.date} onChange={ch} className={inputCls} />
                </label>
                <label className="block">
                  <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Timezone</span>
                  <select name="timezone" value={form.timezone} onChange={ch} className={inputCls}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Start time</span>
                  <input type="time" name="start_time" value={form.start_time} onChange={ch} className={inputCls} />
                </label>
                <label className="block">
                  <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">End time</span>
                  <input type="time" name="end_time" value={form.end_time} onChange={ch} className={inputCls} />
                </label>
              </div>

              <label className="block">
                <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">
                  <Clock size={13} className="inline mr-1 -mt-px" />Reminder
                </span>
                <select name="reminder" value={form.reminder} onChange={e => setForm(f => ({ ...f, reminder: e.target.value === 'null' ? null : e.target.value === 'custom' ? 'custom' : parseInt(e.target.value, 10) }))} className={inputCls}>
                  {REMINDER_OPTIONS.map(o => (
                    <option key={String(o.value)} value={o.value === null ? 'null' : o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {form.reminder === 'custom' && (
                <label className="block">
                  <span className="tp-meta font-semibold text-[color:var(--ink-700)] block mb-1.5">Minutes before</span>
                  <input type="number" min="1" name="customMinutes" value={form.customMinutes} onChange={ch}
                    placeholder="e.g. 45" className={inputCls} />
                </label>
              )}
            </div>

            {error && <p className="tp-meta mt-3 text-red-600 font-semibold">{error}</p>}

            <div className="tp-meta mt-5 rounded-[var(--r-control)] p-3.5 text-[color:var(--ink-500)]" style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
              Downloads an .ics file compatible with Google Calendar, Apple Calendar, Outlook, and all standard calendar apps.
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={onClose} className="tp-body flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
                Cancel
              </button>
              <button onClick={handleDownload} disabled={downloading || !form.date}
                className="tp-body flex-1 flex items-center justify-center gap-2 rounded-[var(--r-control)] py-3 font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Download size={15} />
                {downloading ? 'Preparing…' : 'Download .ics'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Client-side ICS builder — reliable fallback that doesn't need a round-trip.
// The .ics itself is written by @/lib/ics so this shares the folding, escaping
// and all-day end-date rules with the week and mission exports.
export function downloadICSFromForm(form, reminderMinutes, uid) {
  const allDay = !form.start_time;
  const start = allDay ? icsDate(form.date) : icsDateTime(form.date, form.start_time);
  if (!start) return false;

  const ics = buildICS([{
    uid: `${uid}-unscripted@app`,
    summary: form.title,
    description: form.description,
    start,
    end: allDay ? null : (icsDateTime(form.date, form.end_time) || start),
    allDay,
    reminderMinutes,
  }], { timezone: form.timezone });

  downloadICSFile(ics, 'unscripted-event.ics');
  return true;
}