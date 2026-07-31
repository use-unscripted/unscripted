import { Link } from 'react-router-dom';
import { LegalPage, Section, P, Bullets, Callout, Mail } from '@/components/legal/LegalPage';
import { EFFECTIVE_DATE, MIN_AGE, FOUNDERS, GOVERNING_STATE } from '@/lib/legal';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={EFFECTIVE_DATE}
      summary={
        <>
          Unscripted gives you AI-generated career paths and a 30-day experiment to test one
          of them for real. It is a tool for exploring — not advice, and not a promise of a
          job, an internship, or any other outcome. Everything it generates can be wrong, so
          check it before you act. And when you email real people using drafts from here, be
          honest about who you are.
        </>
      }
    >
      <Section title="Agreeing to these terms">
        <P>
          By using Unscripted you agree to these terms. If you do not agree with them, please
          do not use it. Unscripted is operated by its founders — {FOUNDERS.join(', ')} — and
          is not yet a registered company; "we" and "us" below mean them.
        </P>
      </Section>

      <Section title="Who can use Unscripted">
        <Bullets
          items={[
            <>You must be at least {MIN_AGE} years old.</>,
            <>If you are between {MIN_AGE} and 17, you need a parent or guardian's permission, and by using Unscripted you are confirming you have it.</>,
            'Give us accurate information about yourself. The paths we generate are only as good as what you tell us, and lying to the intake form mostly wastes your own time.',
            'Keep one account, and keep your password to yourself. You are responsible for what happens under your account.',
          ]}
        />
      </Section>

      <Section title="What Unscripted is — and is not">
        <P>
          Unscripted generates career paths from your answers, then builds a 30-day experiment
          with step-by-step guides so you can test one against reality instead of committing
          blind.
        </P>
        <Callout>
          It is not career, academic, financial, legal, medical or mental-health advice, and it
          is not a substitute for your academic advisor or your school's career services
          office. It does not guarantee you an internship, a job, an admission, an income, or
          any other result.
        </Callout>
        <P>
          Use it the way you would use a smart friend with strong opinions: worth listening to,
          worth checking.
        </P>
      </Section>

      <Section title="AI-generated content">
        <P>
          Paths, experiments, mission guides, outreach drafts, resume text and reflections are
          produced by AI models. That means they can be confidently wrong. They can invent
          details, misstate what a job pays or requires, get a company or a person's role wrong,
          or be out of date.
        </P>
        <Callout>
          Verify anything factual before you rely on it, and read every generated message before
          you send it. What you send goes out under your name, not ours.
        </Callout>
        <P>
          See the <Link to="/privacy" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>Privacy Policy</Link> for
          which providers process your answers.
        </P>
      </Section>

      <Section title="Contacting real people">
        <P>
          A lot of Unscripted's value is getting you to talk to actual professionals, alumni and
          professors. That only works if everyone using it behaves well, so:
        </P>
        <Bullets
          items={[
            'Send outreach from your own email account, as yourself, and be truthful about who you are and why you are reaching out.',
            'Do not claim that Unscripted, your school, or any person or company endorses, employs or sponsors you.',
            'Do not mass-send. These guides exist to help you write a small number of good messages, not to run a spam campaign.',
            'If someone asks you to stop contacting them, stop.',
            'Follow the law that applies to your messages, and your school’s own rules about contacting alumni and faculty.',
            'Only enter someone else’s contact details in the outreach tracker if you obtained them legitimately, and treat them as you would want yours treated.',
          ]}
        />
        <P>
          We can suspend or close accounts used to spam, mislead or harass people.
        </P>
      </Section>

      <Section title="Your content">
        <P>
          What you write stays yours. To run the service, you give us permission to store,
          display and process it — including sending it to the AI providers who generate your
          plan. That permission exists only to operate Unscripted for you, and it ends when you
          delete your content or your account.
        </P>
        <P>
          We may use aggregated or de-identified information — patterns across many students,
          nothing that identifies you — to improve the product and to describe how it is used.
        </P>
      </Section>

      <Section title="Things you cannot do">
        <Bullets
          items={[
            'Break, overload, probe or work around the app’s security or rate limits.',
            'Scrape it, resell it, or repackage what it generates as your own product.',
            'Upload other people’s private information without their permission.',
            'Post or generate content that is illegal, hateful, harassing, or sexual content involving minors.',
            'Impersonate anyone, including other students, employers or Unscripted itself.',
          ]}
        />
      </Section>

      <Section title="This is an early product">
        <P>
          Unscripted is under active development. Features change, things break, and generation
          occasionally fails. Keep your own copy of anything you would be upset to lose — a
          resume, an essay, a piece of proof you worked hard for.
        </P>
        <P>
          We may change, pause or discontinue any part of the service. If we ever shut it down,
          we will give account holders notice and a way to export what they wrote.
        </P>
      </Section>

      <Section title="Ending it">
        <P>
          You can stop using Unscripted at any time, and you can ask us to delete your account
          and everything in it by emailing <Mail />. We may suspend or close an account that
          breaks these terms, and will tell you why unless doing so would put someone at risk.
        </P>
      </Section>

      <Section title="Third-party services">
        <P>
          Unscripted runs on third-party infrastructure and links out to other sites. Their
          terms and privacy practices are their own, and we are not responsible for what
          happens on them.
        </P>
      </Section>

      <Section title="Disclaimers and limits">
        <P>
          Unscripted is provided "as is" and "as available", without warranties of any kind,
          to the fullest extent the law allows. We do not warrant that it will be uninterrupted,
          error-free, or that anything it generates is accurate, complete or suitable for your
          situation.
        </P>
        <P>
          To the fullest extent the law allows, we are not liable for indirect, incidental or
          consequential damages, or for lost opportunities, arising out of your use of
          Unscripted — including decisions you make about your education or career after using
          it. Our total liability is limited to the greater of the amount you have paid us
          (currently nothing) or US $100.
        </P>
        <P>
          Some places do not allow these limits, in which case they apply to you only as far as
          the law permits, and nothing here limits liability for fraud, or for death or personal
          injury caused by negligence.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We will update the date at the top when these change. If a change is material, we will
          tell account holders before it takes effect. Continuing to use Unscripted afterwards
          means you accept the new version.
        </P>
      </Section>

      <Section title="If something goes wrong between us">
        <P>
          Email <Mail /> first — nearly everything is fixable that way, and we would rather hear
          it than not. Anything that cannot be resolved informally is governed by the laws of
          the State of {GOVERNING_STATE}, in the courts located there.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          <Mail />.
        </P>
      </Section>
    </LegalPage>
  );
}
