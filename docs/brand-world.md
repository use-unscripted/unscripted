# Brand and world

The one place to check before you write a headline, a button label, an empty state, an
error message, or an AI prompt. It holds the product's argument, the beliefs it acts on,
the vocabulary that carries them, the words that undo them, what a student should feel, and
what movement on the screen is allowed to mean.

Visual tokens (navy, gold, the two typefaces, the A/B bench) are in
[`design.md`](design.md). The prose rules every AI prompt inherits are
`PLAIN_PROSE_RULES` in `src/lib/llm.js`. This file is the layer above both: the point of
view they exist to carry.

Read the last two sections before writing anything a buyer sees. They hold the parts that
are currently out of date on the live site.

---

## The argument

Careers get tested, not picked. A quiz can tell you what might fit. Only doing some of the
work tells you whether it does.

Everything follows from that. A path is a hypothesis, an experiment is how you check it,
and evidence is the only thing that moves the answer. Time passing does not, and neither do
we.

## What we believe

Six, and each one is already built into something. If the product does not act on it, it is
a slogan and it does not belong on this list.

**Being good at the work and wanting to do it are different questions.** Almost everything
in the category answers the first one and calls it done. The uncertainty model asks whether
repeated persuasion wears you down, and whether problems that stay unsolved for days appeal
to you or grind you down. Aptitude is half an answer.

**Untested uncertainty is the problem. Uncertainty is not.** A student who does not know
yet is in a normal position, and saying so out loud is one of the few genuinely
differentiated things the product does. What we object to is uncertainty nobody is doing
anything about. The landing page already says it: "Not knowing yet is useful. It tells us
what to test next."

**Fit and confidence are two numbers and they never merge.** Fit is how promising a career
looks. Confidence is how much evidence stands behind that. Combining them produces exactly
the single authoritative number this product exists to argue against. `career-hypothesis.js`
enforces the split and the UI shows both side by side.

**Confidence only moves when the student produces evidence.** Nothing in the uncertainty
model reads a clock, so a month of doing nothing cannot make us surer. This is the rule
that keeps the product honest when a student stalls, and it is the reason a stalled account
sees "Still untested" rather than a slowly filling bar.

**A path is a hypothesis under test, not a recommendation to accept.** The results screen
says it in those words: "A career hypothesis is a direction worth testing, not a prediction
of what you should become. Each one below says why it may fit, why it may not, and what only
real experience can tell you." The comparison screen opens on that same first sentence.

**The student decides, and can see why.** On the comparison screen all three paths answer the
same nine questions in the same order, so nothing is quietly stacked. Every conclusion
carries where it came from, and when a number moves the screen says what moved it. Our job
ends at the reasoning. The verdict is theirs.

Two things that sound like beliefs and are not on the list. **"Students walk away with
evidence they can show an employer"** is not something we can act on today, for reasons in
the last section. And any version of **"we understand you better than you do"** is the
opposite of what the product is built to do: it deliberately refuses to name a correct
answer.

## The words

**Path.** What a student tests. The entity, the label, and the noun in almost every screen.
Never a match, never a fit, never a recommendation the student is meant to accept.

**Test.** The verb. "Careers worth testing." "Which path do you want to test first?"

**Experiment.** The unit of testing, and the entity name. A student sets one up, runs it,
and finishes it.

**Evidence.** What an experiment produces and the only thing that moves a conclusion. It is
also a real surface in the app, with badges, provenance, and three states: strong evidence,
developing evidence, still untested.

**Untested.** The student-facing word for a gap. We say "unknown" to each other and in the
code (`top_unknowns`, the uncertainty map); on screen it reads "Still untested" and "Still
uncertain", which is plainer and does not need explaining.

**Next test.** What the product recommends after a result. Three wordings are live for it:
"Recommended next test", "Best next test for you", and "Your next test". Use the first one
for anything new. Which of the three should win everywhere is an open cleanup, not a typo.
("Next step" is a different thing. It labels the next move inside a flow, not a
recommendation about what to test, so it is not a fourth variant.)

**Signal.** An early read that does not count as evidence yet. It is in student-facing copy
in about a dozen places, including the landing page ("Signal it fits" and "Signal it
doesn't"), the Early Signals panel, a tab on the evidence page, and the matrix line
"Onboarding gives an initial signal only. It never counts as evidence." Use it where the
screen also says what it is not. Nobody has tested whether a student arrives knowing what
the word means, and dropping it now would mean rewriting every one of those screens, so it
is a live house word until somebody decides otherwise.

**Decision Matrix.** Shipped, named on screen, and reachable. It has its own page, it is the
second item in the signed-in navigation, and several screens print the full phrase "Career
Decision Matrix" to students. It shows how each path's scores move as evidence comes in, and
a student can open any number on it to see what produced it. Show it to a buyer, because it
is a feature they can open.

The open question runs the other way: it is the one house word that sounds like a machine
handing down an answer, which is what the rest of this file argues against. Nobody has
weighed the name against that yet.

### Words we do not use

**Assessment, career assessment.** It files us in the category we sell against. A student
who hears "assessment" expects to answer questions and be told an answer, which is the
experience the product refuses to give them.

**Match, best match, perfect fit.** These promise an outcome the product never claims. The
comparison module writes the rule out in a comment at the top of the file, which is advice
rather than enforcement, and two live screens break it anyway. Both are in the drift list.

**Career diagnosis, career prescription.** Both imply a condition and a cure held by
somebody else. The student is running the experiment. We are not treating them.

**Personality profile, personality type.** We model work characteristics against one
specific career, and most characteristics are left out as irrelevant to most careers. A
fixed type of person is a different and weaker claim.

**Fit score as a verdict.** The number exists and it is not the answer. The next section
sets out what it is allowed to do.

### The one list that can fail a build

Everything above this line is advice. `src/lib/work-sim-readout.js` is not. It holds 55
banned trait words (strength, strengths, weakness, natural, analytical, mindset,
personality, decisive, methodical, suited, thinker and the rest), plus patterns for the bare
word "fit", "fits you", "you are", "you're", any percent sign, "verdict", and the two long
dashes. It also catches flattery that carries no banned word, like "you would be great at
this job". Every string the simulation read-out writes gets checked, and so does anything
the model returns in the review step: a hit drops the whole scored row. Read that file
before writing a word of simulation copy.

Two of those bans collide with this file, so know which side of the line you are on. That
list bans "strength" outright, and it bans "fit" standing on its own, while fit is one of
the two numbers the whole product is built around. The rule is narrow and it is deliberate:
inside a read-out, a sentence about the student needs a number or a quote under it, and
those are the words that let a sentence skip that. Everywhere else, fit next to confidence
is house style.

## What we never say

**No fabricated certainty.** Every conclusion on screen carries a confidence figure and a
trail back to what produced it. A sentence that outruns them gets contradicted by our own
UI one screen later, which is worse than saying nothing.

**No percentage as a verdict.** Be precise here, because a blanket "no percentages" rule is
already broken: career fit ships as a percentage in at least three places. The rule that
holds is that a number never travels alone. It appears with its own confidence figure, with
what moved it, and in language that calls it an estimate. It never carries a headline, it
never goes in marketing, and nobody is told they are a 92 percent match for consulting.

**No slot machine, no lottery, no reveal.** Framing a result as chance destroys the one
thing the product is arguing: that the student's own work is what changed the answer. This
covers spinning, unwrapping, "your results are in", and any animation that treats output as
a prize.

**No urgency against an 18-year-old's career decision.** No countdowns, no scarcity, no
"decide now". The product's closing line is that you do not need to choose your entire life
today. Manufactured urgency contradicts it in the same session.

**No traction we cannot evidence.** The rule and the reason are in `CLAUDE.md`. The brand
angle on top of it: the product is sold on being honest about what nobody knows yet, so a
padded number reads as off message before anyone gets round to checking whether it is true.

## How it should feel

**Curious, not anxious.** The intake asks which path someone is quietly curious about and
which one they feel pushed toward. Both questions assume the student is interesting, not
deficient.

**Investigating, not being assessed.** The student is running the test. We hold the
instruments.

**More certain because of evidence, never because software said so.** The good feeling we
are aiming for is "I know this because I tried it", not "the app told me".

**Never flattering, never scolding.** The existing copy gets this right and is worth copying
from: "Be conservative. A focused 6 hours beats an imaginary 20." "Nobody else sees this.
Pick the one that is actually true."

## Motion

**Motion has to argue the product's case or it does not ship.** Two animations on the
landing page earn their place. The process rail fills in order as you scroll, because the
pitch is a sequence and the motion is that sequence advancing. The Mission Guide checklist
draws its rings and ticks one after another, because it reads as a checklist being worked
through rather than nine rows appearing. That second one is being replaced on an unmerged
branch, along with the section it argues for, so check the file before you describe it.

**One orchestrated entrance, in the hero, on load.** The headline arrives out of a mask, the
gold underline draws under it, and the subhead, the buttons and the note below them follow
on a timed sequence. That is the whole page's opening move and it is protected on purpose.
Nobody should strip it as a stale fade.

**Everything after that is just there when you arrive at it.** Every section below the hero
used to carry its own scroll-triggered fade on a staggered delay, ten of them in one file.
"Every section fades in when it enters the viewport" is a named tell of a generated page,
and it cost more than taste: with everything moving, the two moments that meant something
had nothing to stand out against. Do not re-add them.

**Removed deliberately, so nobody restores them as an improvement:** the pulsing eyebrow
pill above the headline, buttons that lean toward the cursor, cards that tilt under the
pointer with a gold specular highlight, bounce easing on UI state, the fixed scroll progress
rule, and the staggered vertical offset on the step row (that one read as misalignment, not
rhythm).

**One signal per element.** Four hover affordances on the same button is the tell. Pick the
one that means something.

**Two curves, and they mean different things.** Expo for a word travelling out of a mask,
cubic for anything whose entrance is carried by a fade. The reasoning is written out in
`src/components/motion.jsx`; do not re-derive it.

**Every primitive degrades to a static, fully legible state under reduced motion.** Motion
is decoration. The page has to read without it.

## What the pivot costs, and what you can claim today

Simulations replace Mission Guides. That call was made on 2026-08-14 and the reasoning is in
[`simulation-direction.md`](simulation-direction.md). It costs us one specific sentence, and
anyone writing buyer copy needs to know which side of it we are on.

A real-world mission produced an artifact a student could hand to an employer. A simulation
produces a decision the student can defend. Both are worth money to a university. They are
not the same sale, and the second one is the one we are building.

**What is true today.** The simulation engine is built and merged: its own page and route,
the scoring and read-out libraries, an entity that stores each run, a dozen components, and
a card inside the Test stage that a signed-in student can start it from. What there is one
of is scenario content, a single hand-authored project management scenario. So the machinery
is not zero and the catalogue is one, and a buyer conversation should say which is which.

Two things that are still true. The proof-of-work table holds a single row and it belongs to
a founder, so the product has produced no student evidence. The expectation-versus-reality
capture is built and merged.

**So you can write** that Unscripted tests a career before a student commits to it, that it
separates whether they can do the work from whether they want to, and that it records what
they expected against what actually happened.

**You cannot write** that students finish with proof of work, a portfolio, or anything an
employer receives. That was the missions pitch and we no longer build it.

## Where the words drift right now

Checked against `origin/main` on 2026-08-17. Read the branch, never the local working copy,
which runs a long way behind. Two of these are being fixed on branches right now and are
marked so.

- **Mission Guides, and the half nobody is fixing.** The landing page's guide section and the
  sign-up headline behind that call to action are both being rebuilt on an unmerged branch,
  so do not describe either one until it lands. The path explorer is not part of that work
  and is where the contradiction now lives: all seven cards still say "Your first missions"
  above a list of missions and still promise "Proof after 30 days", and the top navigation
  still says "Start your 30-day test".
- **The step rail promises proof.** Step four reads "Prove: turn the work into proof of what
  you can already do". See the section above for why that is not currently claimable.
- **"Assessment" is on screen seven times, and they are not the same problem.** Two are worth
  rewording: "Update your path assessment" on the landing page, and "Building honest tradeoff
  assessments...", which every student watches while their paths generate. Two are the
  engineering sense of the word rather than the quiz sense and can stay: the "Feasibility
  assessment" heading on the roadmap, and the feasibility line on the goals page. Three are
  low priority: two seeded experiments asking for an "honest assessment of lifestyle fit" and
  a "written self-assessment", and an error message about a risk assessment coming back
  unusable.
- **"Match" is still on screen twice.** The path creation form asks "What makes this a good
  match for your strengths and goals?", and a fit dimension explains "whether the career is a
  strong overall match". Both contradict the rule two sections up.
- **Three wordings for one recommendation.** "Recommended next test", "Best next test for
  you", "Your next test". Details are under "Next test" above.
- **"My Journey" is the primary nav label** while `PLAIN_PROSE_RULES` bans figurative
  "journey" in every AI prompt we write. The product cannot hold a word banned for the model
  and mandatory for the student. One of the two has to give, and it is a real decision, not
  a typo.
- **Career fit renders as a percentage** in the hypothesis card, the path comparison header,
  and the end-of-test read-out. All three pair it with something. The read-out is the thinnest
  of them, printing the path name then fit and confidence on one line, but it sits under a
  "What we learned" heading with a line above it saying what moved. It holds up. It is just
  the one closest to the edge, so do not "fix" it into a headline number.
- **One prompt whose output a student reads did not carry the house prose rules.** The
  experiment evaluation call asks for short phrases about demonstrated strengths and
  improvement areas and prints them to a student. A fix is on a branch and not merged yet.
  Worth noticing that "strengths" is one of the words the simulation read-out bans outright.
- **Not a word, but it is on the page this section governs.** The hero carries 1.75 seconds of
  unlicensed Good Will Hunting footage, merged to the preview on 2026-08-14. It is the one
  item sitting there that a university's counsel could object to during diligence. The risk
  position is written out in [`in-flight.md`](in-flight.md); read it before you write anything
  that ships that page.
