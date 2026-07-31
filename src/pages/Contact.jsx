import { Link } from 'react-router-dom';
import { Mail as MailIcon } from 'lucide-react';
import { LegalPage, Section, P, Bullets } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, TEAM } from '@/lib/legal';

export default function Contact() {
  return (
    <LegalPage
      title="Contact"
      summary={
        <>
          One address, read by the people who build Unscripted. We are a small team, not a
          support department, so expect a real reply rather than a fast one.
        </>
      }
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border p-8 text-center"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--background-tertiary)' }}
        >
          <MailIcon className="h-5 w-5" style={{ color: 'var(--brand-navy-900)' }} aria-hidden="true" />
        </span>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-heading rounded text-2xl font-bold tracking-tight underline underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ color: 'var(--brand-navy-900)', outlineColor: 'var(--brand-navy-900)' }}
        >
          {CONTACT_EMAIL}
        </a>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Usually a few days. If it has been longer than a week, send it again — it did not
          reach us.
        </p>
      </div>

      <Section title="What to write about">
        <Bullets
          items={[
            <><strong>Something is broken.</strong> Tell us what you were doing and what happened. A screenshot helps more than anything else you could send.</>,
            <><strong>Delete my data.</strong> Email from the address on your account and say so. We delete the account and everything in it, and confirm when it is done.</>,
            <><strong>Parents and guardians.</strong> Ask us what we hold about your child, or ask us to delete it. Either one, no argument.</>,
            <><strong>Universities and career services.</strong> If you want to talk about a pilot on your campus, this is the address.</>,
            <><strong>Security.</strong> Found a vulnerability? Send it here. We will take it seriously and we will not come after you for reporting it.</>,
            <><strong>Press and partnerships.</strong> Same address.</>,
          ]}
        />
      </Section>

      <Section title="Who you are writing to">
        <P>
          Unscripted is an independent product, built and operated by {TEAM}. There is no
          registered company behind it yet and therefore no office address to print here. When
          that changes, this page will say so.
        </P>
      </Section>

      <Section title="Before you email about a generated path">
        <P>
          If a path or a mission guide reads like it was written for somebody else, that is
          worth telling us — but it is often fixable from your side first. The paths are
          generated from your onboarding answers, so a vague answer produces a vague path.
          Editing your profile and regenerating usually gets you further than we can from here.
        </P>
        <P>
          What Unscripted can and cannot promise is set out in the{' '}
          <Link to="/terms" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>Terms</Link>, and what
          happens to your answers is in the{' '}
          <Link to="/privacy" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>Privacy Policy</Link>.
        </P>
      </Section>

      <Section title="Not the right place">
        <P>
          Unscripted is not a crisis service. If you are struggling with your mental health,
          please contact your campus counseling center or a local crisis line — in the US, call
          or text 988. We build a career tool, and we are not equipped to help with that.
        </P>
      </Section>
    </LegalPage>
  );
}
