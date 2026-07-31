import { Link } from 'react-router-dom';
import { LegalPage, Section, P, Bullets, Callout, Mail } from '@/components/legal/LegalPage';
import { EFFECTIVE_DATE, MIN_AGE, FOUNDERS, SUBPROCESSORS } from '@/lib/legal';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={EFFECTIVE_DATE}
      summary={
        <>
          We collect what you type into Unscripted so we can generate your paths and build
          your experiments. Those answers get sent to AI providers to generate them, so don't
          type anything you would not want an AI system to process. We do not sell your
          information, we do not run ad trackers, and we do not give your school access to
          your individual answers. Email us and we will delete your account and everything in it.
        </>
      }
    >
      <Section title="Who we are">
        <P>
          Unscripted is an independent product operated by its founders — {FOUNDERS.join(', ')}.
          It is not yet a registered company. When that changes, this page will name the entity
          and its address. We are telling you that rather than printing a company name that
          does not exist.
        </P>
        <P>
          This policy covers useunscripted.base44.app and anything you do inside the app.
        </P>
      </Section>

      <Section title="What we collect">
        <P>All of it comes from you. There is no data broker in this picture.</P>
        <Bullets
          items={[
            <><strong>Your account.</strong> Your email address and a password we store hashed, never in readable form. If you use "Continue with Google" instead, Google tells us your name, email address and profile picture.</>,
            <><strong>What you tell us in onboarding.</strong> Your name, your school, your major or the subjects you are drawn to, your graduation year and current year or grade, your class schedule and weekly commitments, and your written answers — the paths you are considering, the path you feel pressure to take, the one you are privately curious about, your biggest blocker, your financial priorities, and anything else you choose to add.</>,
            <><strong>What you make in the app.</strong> The paths and experiments generated for you, your mission guides, outreach drafts, weekly reflections, resume content, and any files you upload as proof of work.</>,
            <><strong>People you track.</strong> If you log professors, alumni or other professionals in the outreach tracker, we store the names, email addresses and notes you enter about them.</>,
            <><strong>Basic technical data.</strong> Ordinary server logs kept by our hosting provider, such as IP address and browser type.</>,
          ]}
        />
        <Callout>
          We do not run third-party analytics, advertising pixels, or session-recording tools.
          There are none in the app today.
        </Callout>
      </Section>

      <Section title="Why we collect it">
        <Bullets
          items={[
            'To generate your three career paths and the 30-day experiment behind the one you pick.',
            'To write your mission guides — the outreach emails, call prep and proof checklists.',
            'To save your progress so you can leave and come back.',
            'To answer you when you contact us for help.',
            'To understand what is broken or unused, so we can fix the product.',
          ]}
        />
        <P>
          We do not use your information to advertise to you, and we do not build profiles of
          you for anyone else.
        </P>
      </Section>

      <Section title="AI generation — read this one">
        <P>
          Unscripted's whole function is turning your answers into a plan. To do that, the
          text you type is sent to third-party AI model providers for processing. Providers
          currently include OpenAI, Google and Anthropic, reached through our app platform.
        </P>
        <Callout>
          Please do not type anything into Unscripted you would not want processed by an
          outside AI system — including health information, immigration or legal matters,
          financial account details, or private facts about other people.
        </Callout>
        <P>
          We do not train our own models on your answers. We do not control how each AI
          provider handles data beyond the agreements our platform has with them, and those
          providers may retain inputs briefly for abuse monitoring under their own terms.
        </P>
        <P>
          Everything generated for you is machine-generated and can be wrong. Check the{' '}
          <Link to="/terms" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>Terms</Link>{' '}
          for what that means before you act on any of it.
        </P>
      </Section>

      <Section title="Who else sees it">
        <Bullets
          items={SUBPROCESSORS.map((s) => (
            <><strong>{s.name}.</strong> {s.role}</>
          ))}
        />
        <P>
          That is the entire list. We do not sell or rent personal information, we do not
          share it for advertising, and we do not hand it to anyone else except where the law
          requires it or to protect someone's safety.
        </P>
      </Section>

      <Section title="What your school sees">
        <Callout>
          Your school does not get access to your individual answers, your generated paths,
          or your reflections.
        </Callout>
        <P>
          We intend to work with universities, and their career-services offices may one day
          license Unscripted for their students. Even then, what an institution receives would
          be aggregated or de-identified — how many students started an experiment, not what
          any one student wrote about the pressure they feel at home. If we ever propose
          changing that, we will tell you first and ask, and you will be able to say no and
          keep using the product.
        </P>
      </Section>

      <Section title="How long we keep it">
        <P>
          We keep your information while your account is open. Items you delete inside the app
          move to Recently Deleted and are purged automatically after that window.
        </P>
        <P>
          If you want everything gone, email <Mail /> from the address on your account and ask
          us to delete it. We will remove your account and its contents, and confirm when it is
          done. Backups made by our hosting provider may take a short time longer to cycle out.
        </P>
      </Section>

      <Section title="Your choices">
        <Bullets
          items={[
            'See what we hold about you — most of it is visible in the app; email us for the rest.',
            'Correct anything wrong — edit it in Settings, or ask us.',
            'Get a copy of what you have written.',
            'Delete your account and everything in it.',
            'Withdraw from generation entirely by not submitting answers — the product will not work without them, and that is a fair trade to refuse.',
          ]}
        />
        <P>
          Some of these are legal rights where you live — California, Colorado, Connecticut,
          the EU and UK among others. We apply them to everyone rather than sorting people by
          address. Email <Mail /> and we will not make you jump through hoops.
        </P>
      </Section>

      <Section title="Cookies and browser storage">
        <P>
          We use a sign-in cookie so you stay logged in, and your browser's local storage to
          hold onboarding answers you have typed before you create an account — that way you
          do not lose them if you close the tab. Clearing your browser data removes the draft.
        </P>
        <P>There are no advertising or tracking cookies.</P>
      </Section>

      <Section title="Students under 18">
        <P>
          You must be at least {MIN_AGE} to use Unscripted. If you are between {MIN_AGE} and 17,
          you need a parent or guardian's permission first, and we recommend showing them this
          page.
        </P>
        <P>
          We do not knowingly collect information from anyone under {MIN_AGE}. If we learn we
          have, we delete it.
        </P>
        <P>
          Parents and guardians: email <Mail /> and we will show you what we hold about your
          child or delete it, whichever you ask for.
        </P>
      </Section>

      <Section title="Security">
        <P>
          Traffic is encrypted in transit, passwords are stored hashed, and access to the
          database is limited to the founders. No product can promise perfect security, and we
          are not going to pretend otherwise. If you find a vulnerability, email <Mail /> and we
          will take it seriously and will not come after you for reporting it.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          If we change this policy we will update the date at the top. If a change materially
          affects what happens to your information, we will tell account holders directly
          before it takes effect.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions, requests, or anything that reads wrong to you — <Mail />. A person reads it.
        </P>
      </Section>
    </LegalPage>
  );
}
