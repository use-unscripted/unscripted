import { useState } from 'react';
import { Download, Calendar, FileDown, ListTodo } from 'lucide-react';
import { downloadICSFromForm } from '@/components/calendar/AddToCalendarModal';
import { base44 } from '@/api/base44Client';

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]';

export default function ICSExportPanel() {
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
      const resp = await base44.functions.invoke('generateICS', { mode: 'week', weekStart });
      // resp.data is the ICS text returned from the function
      // But since functions.invoke returns JSON, we use client-side builder for week too
      // Fetch tasks for the week and build ICS client-side
      const tasks = await base44.entities.CalendarTasks.list('-date', 200);
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      const weekTasks = tasks.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d >= start && d < end;
      });

      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Unscripted//Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
      ];

      for (const t of weekTasks) {
        const form = { title: t.title, description: t.description, date: t.date, start_time: t.start_time, end_time: t.end_time };
        const esc = s => (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
        const toStamp = (date, time) => {
          if (!date) return null;
          if (!time) return date.replace(/-/g,'');
          const dt = new Date(`${date}T${time}`);
          if (isNaN(dt.getTime())) return date.replace(/-/g,'');
          const p = n => String(n).padStart(2,'0');
          return `${dt.getFullYear()}${p(dt.getMonth()+1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`;
        };
        const allDay = !t.start_time;
        const dtStart = toStamp(t.date, t.start_time);
        const dtEnd = toStamp(t.date, t.end_time) || dtStart;
        if (!dtStart) continue;
        const now = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
        lines.push(
          'BEGIN:VEVENT',
          `UID:${t.id}-unscripted@app`,
          `DTSTAMP:${now}`,
          allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
          allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
          `SUMMARY:${esc(t.title)}`,
          t.description ? `DESCRIPTION:${esc(t.description)}` : null,
          'END:VEVENT',
        ).filter(Boolean);
      }

      lines.push('END:VCALENDAR');
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unscripted-week-${weekStart}.ics`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
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
      const active = missions.filter(m => m.status !== 'completed' && m.status !== 'skipped' && m.deadline);

      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Unscripted//Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
      ];

      const esc = s => (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
      const now = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';

      for (const m of active) {
        const d = m.deadline.replace(/-/g,'');
        const endDate = new Date(m.deadline);
        endDate.setDate(endDate.getDate() + 1);
        const p = n => String(n).padStart(2,'0');
        const endD = `${endDate.getFullYear()}${p(endDate.getMonth()+1)}${p(endDate.getDate())}`;
        lines.push(
          'BEGIN:VEVENT',
          `UID:${m.id}-unscripted@app`,
          `DTSTAMP:${now}`,
          `DTSTART;VALUE=DATE:${d}`,
          `DTEND;VALUE=DATE:${endD}`,
          `SUMMARY:${esc('[Mission] ' + m.title)}`,
          m.objective ? `DESCRIPTION:${esc(m.objective)}` : null,
          'END:VEVENT',
        ).filter(Boolean);
      }

      lines.push('END:VCALENDAR');
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unscripted-missions.ics`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch (err) {
      setError('Could not export missions. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar size={16} style={{ color: '#8B0C21' }} />
        <h3 className="font-heading font-bold text-[#050816]">Export to Calendar</h3>
      </div>
      <p className="text-xs text-[#64748B] mb-5">
        Download .ics files compatible with Google Calendar, Apple Calendar, Outlook, and any standard calendar app.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        {/* Week export */}
        <div className="rounded-[16px] border border-[#E2E8F0] p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F8ECEF' }}>
                <FileDown size={16} style={{ color: '#8B0C21' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#050816]">Export one week</p>
                <p className="text-xs text-[#64748B]">All calendar tasks for the selected week</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2 text-xs outline-none focus:border-[#8B0C21]" />
              <button onClick={downloadWeek} disabled={downloading === 'week'}
                className="flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: '#8B0C21' }}>
                <Download size={12} />
                {downloading === 'week' ? 'Exporting…' : 'Download'}
              </button>
            </div>
          </div>
        </div>

        {/* All missions export */}
        <div className="rounded-[16px] border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F8ECEF' }}>
                <ListTodo size={16} style={{ color: '#8B0C21' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#050816]">Export all active missions</p>
                <p className="text-xs text-[#64748B]">Missions with deadlines, as all-day calendar events</p>
              </div>
            </div>
            <button onClick={downloadMissions} disabled={downloading === 'missions'}
              className="flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: '#8B0C21' }}>
              <Download size={12} />
              {downloading === 'missions' ? 'Exporting…' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] text-[#94A3B8]">
        To add a single event to your calendar, use the "Add to Calendar" button on any mission, task, or outreach contact.
      </p>
    </div>
  );
}