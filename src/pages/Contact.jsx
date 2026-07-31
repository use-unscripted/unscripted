import { Mail as MailIcon } from 'lucide-react';
import { LegalPage, Section, P, Bullets, Ref } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, TEAM } from '@/lib/legal';

export default function Contact() {
  return (
    <LegalPage
      title="Contact"
      lede={
        <P>
          One address, read by the people who build Unscripted. We are a small team rather than a
          support department, so replies are considered rather than immediate.
        </P>
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
          Usually a few days. If a week passes with no reply, send it again — it did not reach us.
        </p>
      </div>

      <Section title="What to write about">
        <Bullets
          items={[
            <><strong>Something is broken.</strong> Say what you were doing and what happened instead. A screenshot is worth more than a description.</>,
            <><strong>Deleting your data.</strong> Write from the address on your account and ask. We delete the account and its contents and confirm when it is done.</>,
            <><strong>Parents and guardians.</strong> Ask what we hold about your child, or ask us to delete it. Either request is honored.</>,
            <><strong>Universities and career services.</strong> Pilots, licensing, and questions from a general counsel all come here.</>,
            <><strong>Security.</strong> Report a vulnerability and we will act on it. We do not pursue people who report in good faith.</>,
            <><strong>Press and partnerships.</strong> Same address.</>,
          ]}
        />
      </Section>

      <Section title="Who you are writing to">
        <P>
          Unscripted is an independent product, built and operated by {TEAM}. There is no
          registered company behind it yet, and therefore no office address to publish. That will
          change, and this page will change with it.
        </P>
      </Section>

      <Section title="Before you write about a generated path">
        <P>
          If a path or a mission guide reads as though it were written for somebody else, tell us.
          It is also often fixable from your side first: paths are generated from your onboarding
          answers, and a general answer produces a general path. Editing your profile and
          regenerating usually gets further than we can from here.
        </P>
        <P>
          What Unscripted can and cannot promise is set out in the <Ref to="/terms">Terms of
          Service</Ref>, and what happens to your answers is set out in the{' '}
          <Ref to="/privacy">Privacy Policy</Ref>.
        </P>
      </Section>

      <Section title="What this address is not">
        <P>
          Unscripted is not a crisis service. If you are struggling with your mental health,
          contact your campus counseling center or a crisis line. In the United States you can
          call or text 988. We build a career tool and are not equipped to help with that.
        </P>
      </Section>
    </LegalPage>
  );
}
