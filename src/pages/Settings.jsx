import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Field from '@/components/onboarding/Field';
import ICSExportPanel from '@/components/calendar/ICSExportPanel';

export default function Settings() {
  const [user, setUser] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const change = e => setUser({ ...user, [e.target.name]: e.target.value });

  const save = async () => {
    await base44.auth.updateMe({ college: user.college, major: user.major, graduation_year: user.graduation_year, school_year: user.school_year });
    setSaved(true);
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Profile and settings"
        title="Keep your context current."
        description="Your direction can change. Update the facts that shape future roadmaps."
      />
      <section className="mb-8 grid gap-5 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:grid-cols-2">
        <Field label="Full name" value={user.full_name} name="full_name" onChange={change} />
        <Field label="Email" value={user.email} name="email" onChange={change} />
        <Field label="College" value={user.college} name="college" onChange={change} />
        <Field label="Major" value={user.major} name="major" onChange={change} />
        <Field label="Graduation year" value={user.graduation_year} name="graduation_year" onChange={change} />
        <Field label="School year" value={user.school_year} name="school_year" onChange={change} />
        <button
          onClick={save}
          className="rounded-[10px] px-5 py-3 font-semibold text-white transition hover:-translate-y-px sm:col-span-2"
          style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}
        >
          {saved ? 'Saved ✓' : 'Save changes'}
        </button>
        <button
          onClick={() => base44.auth.logout('/')}
          className="text-sm font-semibold text-[#64748B] hover:text-[#050816] transition sm:col-span-2"
        >
          Log out
        </button>
      </section>

      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[.14em] mb-1" style={{ color: '#8B0C21' }}>Calendar</p>
        <h2 className="font-heading text-xl font-bold text-[#050816] mb-1">Export to Calendar</h2>
        <p className="text-sm text-[#334155]">Download .ics files to add your Unscripted schedule to Google Calendar, Apple Calendar, Outlook, or any standard calendar app.</p>
      </div>
      <ICSExportPanel />
    </main>
  );
}