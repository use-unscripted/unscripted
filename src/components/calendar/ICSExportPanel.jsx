import { useState } from 'react';
import { Download, Calendar, FileDown, ListTodo } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  addICSDays,
  buildICS,
  calendarTaskEvent,
  countICSEvents,
  downloadICSFile,
  icsDate,
  missionEvent,
} from '@/lib/ics';

const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || '';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--brand-navy-900)]';

/* showHeading: the Week page drops this panel in with nothing above it, so it
   has to name itself there. Settings already gives it a section heading, and
   rendering both put "Export to calendar" on screen twice, eight pixels
   apart. */
export default function ICSExportPanel({ showHeading = true }) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  const downloadWeek = async () => {
    setError('');
    setDownloading('week');
    try {
      const tasks = await base44.entities.CalendarTasks.list('-date', 200);
      // Window compared as YYYYMMDD strings so no Date object — and therefore no
      // timezone — sits between the stored date and the comparison.
      const start = weekStart.replace(/-/g, '');
      const end = addICSDays(start, 7);
      const weekTasks = tasks.filter(t => {
        const d = icsDate(t.date);
        return d && d >= start && d < end;
      });

      const ics = buildICS(weekTasks.map(calendarTaskEvent), { timezone: localTimezone() });
      if (countICSEvents(ics) === 0) {
        setError('No tasks scheduled for that week, so there is nothing to export.');
        return;
      }
      downloadICSFile(ics, `unscripted-week-${weekStart}.ics`);
    } catch (err) {
      setError('Could not export week. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const downloadMissions = async () => {
    setError('');
    setDownloading('missions');
    try {
      const missions = await base44.entities.Missions.list('-created_date', 200);
      const active = missions.filter(m =>
        m.status !== 'completed' && m.status !== 'skipped'
        && m.deletion_status !== 'deleted'
        && m.deadline);

      const ics = buildICS(active.map(missionEvent), { timezone: localTimezone() });
      if (countICSEvents(ics) === 0) {
        setError('No active missions have a deadline yet, so there is nothing to export.');
        return;
      }
      downloadICSFile(ics, 'unscripted-missions.ics');
    } catch (err) {
      setError('Could not export missions. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6">
      {showHeading && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} style={{ color: 'var(--brand-navy-900)' }} />
            <h3 className="tp-section text-[color:var(--surface-dark-900)]">Export to calendar</h3>
          </div>
          <p className="tp-prose text-[color:var(--ink-500)] mt-2 mb-6">
            Download .ics files compatible with Google Calendar, Apple Calendar, Outlook, and any standard calendar app.
          </p>
        </>
      )}

      {error && (
        <div className="tp-meta mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        {/* Week export */}
        <div className="rounded-[16px] border border-[color:var(--ink-200)] p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--ink-100)' }}>
                <FileDown size={16} style={{ color: 'var(--brand-navy-900)' }} />
              </div>
              <div>
                <p className="tp-card text-[color:var(--surface-dark-900)]">Export one week</p>
                <p className="tp-meta mt-1 text-[color:var(--ink-500)]">All calendar tasks for the selected week</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-2 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
              <button onClick={downloadWeek} disabled={downloading === 'week'}
                className="tp-meta touch-target flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                <Download size={14} />
                {downloading === 'week' ? 'Exporting…' : 'Download'}
              </button>
            </div>
          </div>
        </div>

        {/* All missions export */}
        <div className="rounded-[16px] border border-[color:var(--ink-200)] p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--ink-100)' }}>
                <ListTodo size={16} style={{ color: 'var(--brand-navy-900)' }} />
              </div>
              <div>
                <p className="tp-card text-[color:var(--surface-dark-900)]">Export all active missions</p>
                <p className="tp-meta mt-1 text-[color:var(--ink-500)]">Missions with deadlines, as all-day calendar events</p>
              </div>
            </div>
            <button onClick={downloadMissions} disabled={downloading === 'missions'}
              className="tp-meta touch-target flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Download size={14} />
              {downloading === 'missions' ? 'Exporting…' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      <p className="tp-meta mt-5 text-[color:var(--ink-400)]">
        To add a single event to your calendar, use the "Add to Calendar" button on any mission, task, or outreach contact.
      </p>
    </div>
  );
}