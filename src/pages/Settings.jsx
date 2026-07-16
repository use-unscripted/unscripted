import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Field from '@/components/onboarding/Field';

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
      <section className="grid gap-5 rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:grid-cols-2">
        <Field label="Full name" value={user.full_name} name="full_name" onChange={change} />
        <Field label="Email" value={user.email} name="email" onChange={change} />
        <Field label="College" value={user.college} name="college" onChange={change} />
        <Field label="Major" value={user.major} name="major" onChange={change} />
        <Field label="Graduation year" value={user.graduation_year} name="graduation_year" onChange={change} />
        <Field label="School year" value={user.school_year} name="school_year" onChange={change} />
        <button
          onClick={save}
          className="rounded-xl px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 sm:col-span-2"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 12px 30px rgba(37,99,235,0.2)' }}
        >
          {saved ? 'Saved ✓' : 'Save changes'}
        </button>
        <button
          onClick={() => base44.auth.logout('/')}
          className="text-sm font-semibold text-[#64748B] hover:text-[#07111F] transition sm:col-span-2"
        >
          Log out
        </button>
      </section>
    </main>
  );
}