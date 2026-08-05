import { LegalPage, Section, P, Mail, Ref } from '@/components/legal/LegalPage';

const LOOP = [
  ['Discover', 'You answer questions about where you are, what you are expected to do, and what you would look at if nobody were watching.'],
  ['Compare', 'You get three paths: the closest fit, a strong alternative, and one you would not have picked yourself.'],
  ['Test', 'You choose one path and it becomes a 30-day experiment with a fixed scope.'],
  ['Execute', 'Mission guides tell you what to send, who to send it to, and how to prepare for the conversation that follows.'],
  ['Document', 'You save what the month produced: the replies, the call notes, the work itself.'],
  ['Reflect', 'You write down what the week showed you about the path and about how you worked in it.'],
  ['Adjust', 'You continue, change the experiment, or rule the path out. Ruling one out counts.'],
];

export default function About() {
  return (
    <LegalPage
      title="About Unscripted"
      lede={
        <>
          <P>
            Unscripted helps students test a career path for 30 days before committing to it.
          </P>
          <P>
            Most people choose a direction from a course catalog, a handful of conversations and
            a guess, then find out whether it fits after the tuition is spent. What would settle the
            question is knowing what the work is actually like, and whether you want to do it
            every day. That arrives years late. Unscripted exists to move it forward.
          </P>
        </>
      }
    >
      <Section title="How it works">
        <P>
          The product is one loop. You can run it as many times as it takes.
        </P>
        <div className="space-y-3">
          {LOOP.map(([step, detail], i) => (
            <div key={step} className="flex gap-4">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold"
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

      <Section title="Mission guides">
        <P>
          Career advice usually stops at “network” and “get experience.” Those are outcomes, not
          instructions, and the students who already know how to produce them are the ones who
          did not need the advice.
        </P>
        <P>
          A mission guide is the instruction. It contains the message to send, who to send it to,
          what to ask when someone agrees to talk, and what to keep afterward as evidence. Thirty
          days of that leaves you with two things: a real answer about the path, and a record of
          work you can show someone.
        </P>
      </Section>

      <Section title="Where the product stands">
        <P>
          Unscripted is early. Parts of it are unfinished, generation sometimes produces a path
          that misses, and features change without much ceremony. We would rather say that here
          than have you find it out on your own.
        </P>
        <P>
          It is built by a small team working on it directly with students. It is independent, and
          it is not affiliated with or endorsed by any university.
        </P>
      </Section>

      <Section title="For universities and career services">
        <P>
          Unscripted is built to work alongside a career center rather than around it. The
          intended result is students arriving at your office having already tested something,
          with evidence to discuss.
        </P>
        <P>
          Student responses stay private to the student. An institution licensing Unscripted
          receives aggregated participation data, not the substance of anyone’s answers; the{' '}
          <Ref to="/privacy">Privacy Policy</Ref> sets out that commitment in full. To discuss a
          pilot, write to <Mail />.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Students, parents, faculty and press all reach us at the same address: <Mail />. More
          detail on the <Ref to="/contact">contact page</Ref>.
        </P>
      </Section>
    </LegalPage>
  );
}
