/**
 * /answer - the only place a student has ever been able to answer us.
 *
 * They arrive here from an email, usually on a phone, sometimes weeks after it
 * was sent. Everything about this page is built for that: one question, one
 * box, three buttons, done in under thirty seconds. No wizard, no modal, no
 * progress bar, and one link out at the end.
 *
 * Three things here are deliberate and are easy to undo by accident.
 *
 * 1. **The words on screen come from the ladder and from nowhere else.** A
 *    student can update their own StudentNudge row, Base44 has no field level
 *    rules, and `user_id` and `rung_key` are both fields they could rewrite.
 *    `describeAsk` resolves the copy from `rung_key`, and when it cannot, this
 *    page shows no stored string at all. Anything softer than that is the whole
 *    attack: blank the key, write what you like into `ask_title`, point the row
 *    at somebody else, and we print it to them as a heading in our type on our
 *    domain, next to a line saying we sent it.
 * 2. **The subject's name is read off the student's own record**, through their
 *    own session, not off the nudge row. That is what lets the copy say the
 *    real experiment title without trusting anything in the row.
 * 3. **The whole page sits inside its own error boundary.** This app has no
 *    global one, so a single throw from a malformed field would unmount
 *    everything and leave a student who came to answer a question staring at a
 *    white screen. Every field is validated before it is rendered, and the
 *    boundary is the net under that.
 */
import { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sk } from '@/components/PageSkeleton';
import { LogoFull } from '@/components/UnscriptedLogo';
import {
  describeAsk, planResponse, describeOutcome, internalRoute, isSoftDeleted, isOptedOut, ANSWER_HOME,
} from '@/lib/nudge-response';

/** Where a student goes when there is nothing else to send them to. */
const HOME = ANSWER_HOME;

/** The entity behind each subject type, and the field its name lives in. */
const SUBJECTS = {
  experiment: { entity: 'Experiments', nameField: 'title' },
  mission: { entity: 'Missions', nameField: 'title' },
  outreach: { entity: 'OutreachContacts', nameField: 'name' },
  path: { entity: 'PathRecommendations', nameField: 'path_name' },
};

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function Shell({ children }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:px-8">
      {/* The one screen a student reaches straight from a cold email, outside
          the app shell, with no nav and no signed in furniture around it. The
          same wordmark the login screen uses is the whole of what makes it
          recognisably us, and without it this is an unbranded card asking
          somebody to press a button. */}
      <div className="mb-7 flex justify-center">
        <LogoFull height={36} />
      </div>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

function Card({ children }) {
  return (
    <section className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      {children}
    </section>
  );
}

/** A dead end that still gives them somewhere to go. */
function Notice({ title, body, to = HOME, cta = 'Go to My Journey' }) {
  return (
    <Shell>
      <Card>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {body && <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{body}</p>}
        <Link
          to={to}
          className="ui-press mt-5 inline-flex items-center rounded-[10px] px-5 py-3 text-sm font-bold text-white"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
        >
          {cta}
        </Link>
      </Card>
    </Shell>
  );
}

/**
 * The net under the page.
 *
 * Nothing in this app catches a render throw, so without this one bad field on
 * one row takes the whole tab down for somebody who opened an email to answer a
 * question. They still get a way back.
 */
class AnswerBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { broken: false };
  }

  static getDerivedStateFromError() {
    return { broken: true };
  }

  componentDidCatch(error) {
    // The message only. These rows carry a student's own words and a model's
    // output, and neither belongs in a log.
    console.error('[answer] the page failed to render:', error?.message || 'unknown');
  }

  render() {
    if (this.state.broken) {
      return (
        <Notice
          title="We could not open that question."
          body="Something on our end is wrong with it. Nothing you did caused this and nothing was lost."
        />
      );
    }
    return this.props.children;
  }
}

function AnswerNudgeInner() {
  const { search } = useLocation();
  const nudgeId = useMemo(() => text(new URLSearchParams(search).get('nudgeId')), [search]);

  const { isAuthenticated, authChecked, navigateToLogin } = useAuth();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [me, setMe] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [subject, setSubject] = useState(null);
  const [subjectName, setSubjectName] = useState('');

  const [reply, setReply] = useState('');
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState(null);

  // Signed out students are sent through login and brought back to this exact
  // URL, query string and all. This is the same mechanism the rest of the app
  // uses, so there is one way in rather than two.
  useEffect(() => {
    if (authChecked && !isAuthenticated) navigateToLogin();
  }, [authChecked, isAuthenticated, navigateToLogin]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setRemoved(false);
    try {
      const user = await base44.auth.me();
      setMe(user || null);

      let row = null;
      let gone = false;
      if (nudgeId) {
        row = await base44.entities.StudentNudge.get(nudgeId).catch(() => null);
        // A direct get returns a soft deleted row like any other, and the page
        // used to draw it in full: the student read the ask, typed a sentence,
        // pressed send, and only then got told it had been removed. It is a
        // dead end, so it says so before they type anything, and it does not
        // quietly swap in a different question either.
        if (row && isSoftDeleted(row)) {
          row = null;
          gone = true;
        }
      }
      setRemoved(gone);
      if (!row && !gone) {
        // A mail client can mangle a query string, and a student who clicked
        // through deserves the question anyway. Newest open ask wins.
        const open = await base44.entities.StudentNudge
          .filter({ status: 'pending' }, '-generated_at', 20)
          .catch(() => []);
        const live = (Array.isArray(open) ? open : []).filter((r) => r && !isSoftDeleted(r));
        row = live[0] || null;
      }
      setNudge(row);

      const type = row ? text(row.subject_type) : '';
      const spec = SUBJECTS[type];
      const subjectId = row ? text(row.subject_id) : '';
      if (spec && subjectId) {
        const found = await base44.entities[spec.entity].get(subjectId).catch(() => null);
        setSubject(found || null);
        setSubjectName(found ? text(found[spec.nameField]) : '');
      } else {
        setSubject(null);
        setSubjectName('');
      }
    } catch (err) {
      console.error('[answer] load failed:', err?.message || 'unknown');
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [nudgeId]);

  useEffect(() => {
    if (authChecked && isAuthenticated) load();
  }, [authChecked, isAuthenticated, load]);

  const ask = useMemo(
    () => (nudge ? describeAsk(nudge, { subjectName }) : null),
    [nudge, subjectName],
  );

  const submit = useCallback(async (choice) => {
    if (!nudge || saving) return;
    setProblem('');
    const plan = planResponse({
      nudge,
      choice,
      replyText: reply,
      declineReason,
      now: new Date(),
      subject,
    });
    if (plan.errors.length || !plan.nudgeUpdate) {
      setProblem(plan.errors[0] || 'We could not save that.');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.StudentNudge.update(nudge.id, plan.nudgeUpdate);

      // The second write is still best effort, because the answer is saved by
      // the line above and a student should not be told the whole thing failed
      // when their words are safe. What is not allowed is the page claiming the
      // thing was closed when the write refused, which is what it used to do:
      // the outcome is read off what landed, not off what was planned.
      let ruleOutSaved = false;
      if (plan.ruleOut) {
        ruleOutSaved = await base44.entities[plan.ruleOut.entity]
          .update(plan.ruleOut.id, plan.ruleOut.patch)
          .then(() => true)
          .catch((err) => {
            console.error('[answer] could not close the subject:', err?.message || 'unknown');
            return false;
          });
      }
      // A create that resolves is not the same as an opt out that counts. The
      // weekly pass decides whether to email by running isOptedOut over the
      // rows, and that check requires the creator and the subject to be the same
      // person. So the row we just wrote is put through the same function rather
      // than trusting the promise: if it would not stop an email, we do not tell
      // a student their emails are off.
      let optOutSaved = false;
      if (plan.optOut) {
        optOutSaved = await base44.entities.NudgeOptOut.create(plan.optOut)
          .then((row) => isOptedOut([{ ...plan.optOut, ...(row || {}) }], nudge.user_id))
          .catch((err) => {
            console.error('[answer] could not record the opt out:', err?.message || 'unknown');
            return false;
          });
      }

      const outcome = describeOutcome({
        choice,
        actionKind: ask?.action_kind,
        target: ask?.target,
        ruleOutPlanned: !!plan.ruleOut,
        ruleOutSaved,
        optOutPlanned: !!plan.optOut,
        optOutSaved,
        wroteText: !!String(reply || '').trim(),
      });
      // Set first, navigate second. If the route is gone or the navigation does
      // not happen, they are left on a screen that still tells them what
      // happened and still has a link to the thing.
      setDone(outcome);
      if (outcome.goTo) navigate(outcome.goTo);
    } catch (err) {
      console.error('[answer] save failed:', err?.message || 'unknown');
      setProblem('We could not save that just now. Try once more.');
    } finally {
      setSaving(false);
    }
  }, [nudge, saving, reply, declineReason, subject, ask, navigate]);

  // The order matters. Until the auth check comes back we do not know whether
  // they are signed in, and telling a signed in student to sign in for half a
  // second is how somebody closes the tab.
  if (!authChecked) {
    return (
      <Shell>
        <Sk h={44} r={10} />
        <Sk h={280} r={20} />
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Notice
        title="Sign in and we will bring you back here."
        body="This question is on your account, so we need to know it is you."
        to="/login"
        cta="Sign in"
      />
    );
  }

  if (loading) {
    return (
      <Shell>
        <Sk h={44} r={10} />
        <Sk h={280} r={20} />
      </Shell>
    );
  }

  if (loadFailed) {
    return (
      <Shell>
        <Card>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            We could not load that question just now.
          </p>
          <button
            type="button"
            onClick={load}
            className="ui-press mt-4 inline-flex items-center rounded-[10px] px-5 text-sm font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
          >
            Try again
          </button>
        </Card>
      </Shell>
    );
  }

  if (removed) {
    return (
      <Notice
        title="That question was removed."
        body="There is nothing to answer here, and nothing on your account changed."
      />
    );
  }

  if (!nudge) {
    return (
      <Notice
        title="Nothing to answer right now."
        body="There is no open question on your account. If you got here from an email, the question in it has already been answered."
      />
    );
  }

  // Row level security should already have stopped this read. This is the
  // screen where a forwarded link gets clicked, so it is checked again here and
  // nothing about the ask is drawn.
  if (me && text(nudge.user_id) && text(nudge.user_id) !== text(me.id)) {
    return (
      <Notice
        title="This link is not for this account."
        body="The question behind it belongs to someone else. If you have another login, sign in with that one."
      />
    );
  }

  // Answered already, and they came back to the link anyway. Say so rather than
  // drawing buttons that will refuse when they are pressed.
  if (!done && text(nudge.status) && text(nudge.status) !== 'pending') {
    return (
      <Notice
        title="You have already answered this one."
        body="Nothing else is needed here."
      />
    );
  }

  // The rung this row names is not one we have, so there is nothing we can
  // honestly put on the screen. The strings left on the row are the ones a
  // student could have written, and this page renders them at heading size on
  // our domain, so they are not shown at all. See rule 1 at the top.
  if (!done && ask && !ask.rungKnown) {
    return (
      <Notice
        title="This question is not one we ask any more."
        body="It was sent a while ago and we have changed what we ask since. There is nothing you need to do with it, and nothing on your account has changed."
      />
    );
  }

  if (done) {
    return <Notice title={done.line} body={done.body} to={done.to} cta={done.cta} />;
  }

  const isQuestion = ask.action_kind === 'answer_question';
  const isRuleOut = ask.action_kind === 'rule_out';
  const isAccount = ask.subjectType === 'account';
  const target = internalRoute(ask.target);

  let eyebrow = 'One thing to do';
  if (isQuestion) eyebrow = 'One question';
  if (isRuleOut) eyebrow = 'Your call';

  const buttonStyle = { background: 'var(--brand-navy-900)', minHeight: '48px' };
  const quietButton = 'ui-press w-full rounded-[10px] border px-5 py-3 text-sm font-bold';

  return (
    <Shell>
      <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>
        {eyebrow}
      </p>

      <Card>
        {ask.title && (
          <h1 className="font-heading text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {ask.title}
          </h1>
        )}

        {ask.body && (
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{ask.body}</p>
        )}

        {(isQuestion || isRuleOut) && ask.question && (
          <p className="mt-5 text-sm font-bold leading-6" style={{ color: 'var(--text-primary)' }}>
            {ask.question}
          </p>
        )}

        {(isQuestion || isRuleOut) && (
          <label className="mt-3 block">
            <span className="sr-only">Your answer</span>
            <textarea
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={2000}
              placeholder={isRuleOut ? 'One sentence, if you want to say.' : 'One sentence is enough.'}
              className="w-full resize-none rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-700)]"
            />
          </label>
        )}

        {problem && <p className="mt-3 text-xs font-semibold text-red-600" role="alert">{problem}</p>}

        <div className="mt-4 space-y-3">
          {isQuestion && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submit('answered')}
              className="ui-press w-full rounded-[10px] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              style={buttonStyle}
            >
              {saving ? 'Sending' : 'Send my answer'}
            </button>
          )}

          {isRuleOut && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('accepted')}
                className="ui-press w-full rounded-[10px] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                style={buttonStyle}
              >
                {isAccount ? 'Yes, stop sending these' : 'Yes, close it out'}
              </button>
              <p className="text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                {isAccount
                  ? 'Your account stays exactly as it is, and you can turn these back on whenever.'
                  : 'Nothing gets deleted. It comes off your list, and what you wrote stays with it.'}
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('declined')}
                className={`${quietButton} disabled:opacity-60`}
                style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}
              >
                {isAccount ? 'Keep sending them' : 'No, keep it open'}
              </button>
            </>
          )}

          {!isQuestion && !isRuleOut && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('accepted')}
                className="ui-press w-full rounded-[10px] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                style={buttonStyle}
              >
                {target ? 'Yes, take me there' : 'Yes, I will do it'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeclining(true)}
                className={`${quietButton} disabled:opacity-60`}
                style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}
              >
                Not this week
              </button>
            </>
          )}

          {isQuestion && !declining && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setDeclining(true)}
              className="w-full text-center text-xs font-semibold disabled:opacity-60"
              style={{ color: 'var(--brand-navy-700)' }}
            >
              Skip this one
            </button>
          )}
        </div>

        {declining && (
          <div className="mt-5 rounded-[16px] border border-[color:var(--ink-200)] p-4">
            <label className="block text-sm font-semibold" style={{ color: 'var(--ink-700)' }}>
              Why, if you feel like saying?
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--ink-400)' }}>Optional</span>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                maxLength={2000}
                placeholder="It changes what we ask you next."
                className="mt-1 w-full resize-none rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-700)]"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => submit('declined')}
              className="ui-press mt-3 w-full rounded-[10px] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              style={buttonStyle}
            >
              {saving ? 'Sending' : 'Send'}
            </button>
          </div>
        )}
      </Card>

      <p className="text-center text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
        To stop these emails, turn them off in your{' '}
        <Link to="/settings" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>settings</Link>.
      </p>
    </Shell>
  );
}

export default function AnswerNudge() {
  return (
    <AnswerBoundary>
      <AnswerNudgeInner />
    </AnswerBoundary>
  );
}
