import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Check, X, ExternalLink, AlertCircle, Inbox, School, CalendarCheck2,
  RefreshCw, ThumbsDown, TriangleAlert,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { SkCards } from '@/components/PageSkeleton';
import { useAuth } from '@/lib/AuthContext';
import {
  listFeedSubmissions, reviewFeedSubmission, listCampusFeeds, checkCampusFeeds,
} from '@/lib/campus-events';

/**
 * The review queue for calendar links students have sent us.
 *
 * A student whose school we can't read can paste their club portal, and if it
 * resolves they get their events immediately. Approving here is the separate,
 * bigger decision: it writes that feed onto the school, so every student there
 * is served by it from then on.
 *
 * That is the whole reason this page exists rather than a status flip in the
 * Base44 data editor. The raw table shows a URL and a platform name, which is
 * not enough to answer the only question that matters — is this the
 * university's calendar, or the library's, or one department's? Sample titles
 * and an event count answer it in about two seconds. A wrong approval is
 * invisible and permanent: nothing downstream can tell that a whole school is
 * being shown the rec centre's schedule.
 *
 * Failures are listed too. They are not noise — they are the record of which
 * calendar platform is worth writing an adapter for next.
 *
 * Two more things live here, and both exist because a resolved school is cached
 * and never looked at again:
 *
 *   Working  — every school with a feed, and whether it still answers. A
 *              calendar that moves or empties out is invisible otherwise; the
 *              first person to find out is a student staring at nothing.
 *   Reported — a student saying the calendar we found is the wrong one. That
 *              failure cannot be detected from this side at all. A feed can
 *              resolve, read cleanly and return a hundred real events that
 *              belong to the library or a different campus.
 */
export default function AdminCampusFeeds() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState('');
  const [tab, setTab] = useState('pending');

  const admin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Two independent reads, and one failing must not blank the other — the
    // health list is the half that matters when something is wrong.
    const [queue, health] = await Promise.allSettled([listFeedSubmissions(), listCampusFeeds()]);
    if (queue.status === 'fulfilled') setRows(queue.value);
    else setError(queue.reason?.message || 'Could not load the queue.');
    if (health.status === 'fulfilled') setFeeds(health.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (admin) load();
    else setLoading(false);
  }, [admin, load]);

  async function decide(row, decision) {
    setBusyId(row.id);
    setError('');
    try {
      await reviewFeedSubmission(row.id, decision);
      setRows(rs => rs.map(r => (r.id === row.id ? { ...r, review_status: decision } : r)));
      // Upholding a report takes a school's calendar away, and approving a link
      // gives one. Either way the health list on screen is now out of date.
      setFeeds(await listCampusFeeds());
    } catch (err) {
      setError(err?.message || 'That did not save.');
    }
    setBusyId('');
  }

  async function checkNow() {
    setChecking(true);
    setError('');
    setCheckNote('');
    try {
      const { checked, skipped } = await checkCampusFeeds();
      const broken = checked.filter(c => c.error).length;
      setCheckNote(
        `Checked ${checked.length} ${checked.length === 1 ? 'school' : 'schools'} · ` +
        `${broken} not working` +
        // Never let a partial run read as a clean bill of health.
        (skipped ? ` · ${skipped} not checked, too many to do at once` : ''),
      );
      setFeeds(await listCampusFeeds());
    } catch (err) {
      setError(err?.message || 'That check did not run.');
    }
    setChecking(false);
  }

  const groups = useMemo(() => {
    const readable = r => r.resolution === 'resolved';
    const isReport = r => r.kind === 'report';
    return {
      // Only resolved rows are decisions. A failure has nothing to approve.
      pending: rows.filter(r => !isReport(r) && readable(r) && r.review_status === 'pending'),
      reported: rows.filter(r => isReport(r) && r.review_status === 'pending'),
      decided: rows.filter(r => readable(r) && r.review_status !== 'pending'),
      failed: rows.filter(r => !isReport(r) && !readable(r)),
    };
  }, [rows]);

  const broken = useMemo(() => feeds.filter(f => f.events_last_error), [feeds]);

  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <PageHeader eyebrow="Campus feeds" title="Not your page" />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          This one is for the team. Nothing is broken.
        </p>
      </div>
    );
  }

  const TABS = [
    ['pending', 'Needs a decision', groups.pending.length],
    ['reported', 'Reported wrong', groups.reported.length],
    ['working', 'Working', broken.length],
    ['decided', 'Decided', groups.decided.length],
    ['failed', "Couldn't read", groups.failed.length],
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader
        eyebrow="Campus feeds"
        title="Calendar links from students"
        description="A student at a school we can't read pasted where their events actually live. They already have their own events. Approving puts that feed on the school, for everyone there."
      />

      {error && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: '#FECACA', background: 'var(--danger-50)', color: 'var(--danger-700)' }} role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className="rounded-full border px-3.5 py-1.5 text-xs font-bold transition"
            style={tab === id
              ? { borderColor: 'var(--brand-navy-700)', background: 'var(--brand-navy-700)', color: '#fff' }
              : { borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}
          >
            {label} {count > 0 && <span className="tabular-nums opacity-80">· {count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <SkCards count={3} h={136} gap={12} r={16} />
      ) : tab === 'working' ? (
        <FeedHealth
          feeds={feeds}
          broken={broken}
          checking={checking}
          note={checkNote}
          onCheck={checkNow}
        />
      ) : groups[tab].length === 0 ? (
        <EmptyQueue tab={tab} />
      ) : (
        <div className="space-y-3">
          {groups[tab].map(row => (
            <SubmissionCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onDecide={tab === 'pending' || tab === 'reported' ? decide : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function fmtWhen(value) {
  const date = fmtDate(value);
  return date || 'never';
}

/**
 * Every school with a feed, and whether it still answers.
 *
 * The list is ordered failures-first and says the count out loud, because the
 * only reason to open this tab is to find out whether anything is wrong, and a
 * broken school buried alphabetically among healthy ones is not an answer.
 */
function FeedHealth({ feeds, broken, checking, note, onCheck }) {
  const ordered = useMemo(() => {
    const rank = f => (f.events_last_error ? 0 : 1);
    return [...feeds].sort((a, b) =>
      rank(a) - rank(b) || String(a.canonical_name || '').localeCompare(String(b.canonical_name || '')));
  }, [feeds]);

  const withFeeds = ordered.filter(f => f.events_feed_url);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        style={{
          borderColor: broken.length ? '#FECACA' : 'var(--ink-200)',
          background: broken.length ? 'var(--danger-50)' : 'var(--ink-50)',
        }}>
        <p className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: broken.length ? 'var(--danger-700)' : 'var(--text-primary)' }}>
          {broken.length ? <TriangleAlert size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          {broken.length
            ? `${broken.length} ${broken.length === 1 ? 'calendar is' : 'calendars are'} not working`
            : `All ${withFeeds.length} ${withFeeds.length === 1 ? 'calendar' : 'calendars'} working`}
        </p>
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-600)', background: '#fff' }}
        >
          {checking
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <RefreshCw size={13} aria-hidden="true" />}
          {checking ? 'Reading every calendar…' : 'Check them all now'}
        </button>
      </div>

      {note && (
        <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{note}</p>
      )}

      {withFeeds.length === 0 ? (
        <EmptyQueue tab="working" />
      ) : (
        <div className="space-y-2">
          {withFeeds.map(feed => <FeedRow key={feed.id} feed={feed} />)}
        </div>
      )}
    </div>
  );
}

function FeedRow({ feed }) {
  const failing = Boolean(feed.events_last_error);

  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: failing ? '#FECACA' : 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <School size={14} className="shrink-0" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
          {feed.canonical_name || 'Unknown school'}
        </p>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={failing
            ? { background: 'var(--danger-50)', color: 'var(--danger-700)' }
            : { background: '#DCFCE7', color: '#166534' }}>
          {failing ? 'Not working' : 'Working'}
        </span>
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{feed.events_platform}</span>
        <span>·</span>
        <span>last worked {fmtWhen(feed.events_last_ok_at)}</span>
      </p>

      {failing && (
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--danger-700)' }}>
          {feed.events_last_error} · {fmtWhen(feed.events_last_error_at)}
        </p>
      )}

      <a
        href={feed.events_feed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-start gap-1.5 break-all text-xs hover:underline"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{feed.events_feed_url}</span>
      </a>
    </div>
  );
}

function EmptyQueue({ tab }) {
  const copy = {
    pending: ['Nothing waiting', 'No student has sent a calendar link that needs a decision.'],
    reported: ['Nothing reported', "Students who think we found the wrong calendar for their school land here. It's the only way we'd ever know."],
    working: ['No calendars yet', 'Schools get a calendar the first time a student there loads the app.'],
    decided: ['Nothing decided yet', 'Approved and rejected links show up here.'],
    failed: ['No failures', "Links we couldn't read land here. They're the list of which calendar platform to support next."],
  }[tab];

  return (
    <div className="rounded-xl border px-5 py-8 text-center" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
      <Inbox size={20} className="mx-auto mb-2" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{copy[0]}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{copy[1]}</p>
    </div>
  );
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE = {
  approved: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: 'var(--ink-100)', color: 'var(--ink-600)' },
};

function SubmissionCard({ row, busy, onDecide }) {
  const failed = row.resolution !== 'resolved';
  const report = row.kind === 'report';
  const titles = Array.isArray(row.sample_titles) ? row.sample_titles : [];

  return (
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--ink-200)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
        <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <School size={14} className="shrink-0" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
          {row.college || 'Unknown school'}
        </p>
        <div className="flex items-center gap-2">
          {report && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}>
              <ThumbsDown size={11} aria-hidden="true" /> Wrong calendar
            </span>
          )}
          {row.review_status !== 'pending' && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
              style={STATUS_STYLE[row.review_status] || STATUS_STYLE.rejected}>
              {row.review_status}
            </span>
          )}
          <span className="text-xs tabular-nums" style={{ color: 'var(--ink-400)' }}>{fmtDate(row.created_date)}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <a
          href={row.submitted_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1.5 break-all text-xs font-semibold hover:underline"
          style={{ color: 'var(--brand-navy-700)' }}
        >
          <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{row.submitted_url}</span>
        </a>

        {report ? (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {row.report_note
              ? <>A student says this is not their school&rsquo;s calendar: &ldquo;{row.report_note}&rdquo;</>
              : 'A student says this is not their school’s calendar. They gave no reason.'}
          </p>
        ) : failed ? (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {row.failure_reason || "We couldn't read a calendar there."}
          </p>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <CalendarCheck2 size={12} className="shrink-0" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{row.resolved_platform}</span>
              <span>·</span>
              <span className="tabular-nums">{row.event_count} upcoming</span>
            </p>

            {/*
              The whole reason this is a page and not a status flip in the data
              editor. A platform name and a URL cannot tell you whether this is
              the university's calendar or the library's; five real titles can.
            */}
            {titles.length > 0 && (
              <ul className="mt-2 space-y-0.5 rounded-lg px-3 py-2" style={{ background: 'var(--ink-50)' }}>
                {titles.map((title, i) => (
                  <li key={i} className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{title}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {/*
          Same two buttons, opposite meaning. Upholding a report is the only
          action that fixes a school being served the wrong calendar: it takes
          the feed off, and students there are asked where the right one is —
          which is the state a school we never resolved is already in.

          It deliberately does not re-probe. The probe is deterministic, so it
          would hand back the same wrong calendar with the complaint now marked
          as handled.
        */}
        {onDecide && report && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(row, 'approved')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
              style={{ background: 'var(--danger-700)' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              They&rsquo;re right, stop using this calendar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(row, 'rejected')}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}
            >
              <X size={13} aria-hidden="true" /> Calendar is fine
            </button>
          </div>
        )}

        {onDecide && !report && !failed && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(row, 'approved')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
              style={{ background: 'var(--brand-navy-700)' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              Use this for {row.college || 'this school'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(row, 'rejected')}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50"
              style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-500)' }}
            >
              <X size={13} aria-hidden="true" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
