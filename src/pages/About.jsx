import { Link } from 'react-router-dom';
import { LegalPage, Section, P, Callout, Mail } from '@/components/legal/LegalPage';
import { FOUNDERS } from '@/lib/legal';

const LOOP = [
  ['Discover', 'Answer questions about where you are, what you feel pressure to do, and what you are privately curious about.'],
  ['Compare', 'Get three paths — the best fit, a strong alternative, and a contrarian one you would not have picked yourself.'],
  ['Test', 'Choose one and turn it into a 30-day experiment with a real, finite scope.'],
  ['Execute', 'Follow mission guides that tell you exactly what to send, who to ask, and how to book the conversation.'],
  ['Document', 'Save what you actually produced — the reply, the call notes, the thing you built.'],
  ['Reflect', 'Write down what the week taught you about the path and about yourself.'],
  ['Adjust', 'Keep going, change the experiment, or rule the path out. Ruling one out is a win.'],
];

export default function About() {
  return (
    <LegalPage
      title="About Unscripted"
      summary={
        <>
          Students pick a career from a course catalog, a few conversations, and a guess — then
          find out whether it fits after they have already committed years to it. Unscripted
          exists so you can test a path for 30 days before you commit to it.
        </>
      }
    >
      <Section title="The problem we are working on">
        <P>
          Choosing what to do with your life is the largest decision most people make with the
          least evidence. You are asked to commit at 18 or 20, based on a major description, a
          parent's opinion, and whatever a professional whose job you have never watched
          happens to say at a career fair.
        </P>
        <P>
          Then the standard advice is "network" and "get experience", which is not advice — it
          is a description of an outcome. Nobody tells you what to actually send, or who to send
          it to, or what counts as having learned something.
        </P>
      </Section>

      <Section title="How Unscripted works">
        <P>
          The whole product is one loop, and you can run it as many times as you need to.
        </P>
        <div className="space-y-3">
          {LOOP.map(([step, detail], i) => (
            <div key={step} className="flex gap-4">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: 'var(--brand-navy-900)', color: '#fff' }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{step}.</strong> {detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The part that matters">
        <Callout>
          Mission Guides are the difference. Not "reach out to alumni" — the actual email, the
          person to send it to, what to say when they reply, and what to save afterwards as
          proof you did it.
        </Callout>
        <P>
          A month of guided, documented work in a field tells you more about whether you want
          it than four years of reading about it. It also leaves you with something to show —
          real conversations, real output — which is worth more in an application than a line
          about being passionate.
        </P>
      </Section>

      <Section title="Who is building it">
        <P>
          Unscripted is built by {FOUNDERS.slice(0, -1).join(', ')} and {FOUNDERS.slice(-1)}.
          It is an independent product, operated by the three of us, and it is not affiliated
          with or endorsed by any university.
        </P>
        <P>
          We are early. Parts of Unscripted are unfinished, and some of it will be wrong for
          you. We would genuinely rather hear that than not — if something breaks or a
          generated path reads like nonsense, tell us and we will fix it.
        </P>
      </Section>

      <Section title="For universities and career-services teams">
        <P>
          We are building Unscripted to work alongside career services, not around it — the
          goal is students who show up to your office having already tested something and
          having evidence to talk about. Individual student answers stay private to the
          student; institutions would see aggregate participation, not personal reflections.
          The <Link to="/privacy" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>Privacy Policy</Link> spells
          that out.
        </P>
        <P>
          If you run a career center and want to talk about a pilot, email <Mail />.
        </P>
      </Section>

      <Section title="Get in touch">
        <P>
          Students, parents, faculty, press — one address, and a person reads it: <Mail />.
          More on the <Link to="/contact" className="font-semibold underline underline-offset-4" style={{ color: 'var(--brand-navy-700)' }}>contact page</Link>.
        </P>
      </Section>
    </LegalPage>
  );
}
