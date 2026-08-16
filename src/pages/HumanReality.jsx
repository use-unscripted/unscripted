/**
 * Human Reality, end to end:
 *
 *   Path → remaining unknown → a human perspective is needed → who could answer
 *   it → the questions worth asking → what the student learned → human evidence
 *   → what it changed on the Path and in the Matrix.
 *
 * It is an experiment type, so it lives on the same rails as the others: it is
 * pinned to a Path, aimed at one uncertainty, and it ends in a record. What it
 * never does is touch a fit or confidence score, because a conversation is
 * evidence about the field rather than a reading of the student.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Sk } from '@/components/PageSkeleton';
import HumanRealityBrief from '@/components/human-reality/HumanRealityBrief';
import HumanRealityQuestions from '@/components/human-reality/HumanRealityQuestions';
import HumanRealitySources from '@/components/human-reality/HumanRealitySources';
import HumanRealityLog from '@/components/human-reality/HumanRealityLog';
import HumanRealityLearned from '@/components/human-reality/HumanRealityLearned';
import { HUMAN_REALITY_TOPICS, TOPICS_BY_ID, topicForVariable } from '@/lib/human-reality';
import { WORK_VARIABLES } from '@/lib/uncertainty-model';

function Shell({ children }) {
  return <main className="app-page"><div className="space-y-5">{children}</div></main>;
}

export default function HumanReality() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const recId = params.get('recId') || '';
  const variable = params.get('variable') || '';

  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topicId, setTopicId] = useState(topicForVariable(variable)?.id || HUMAN_REALITY_TOPICS[0].id);
  const [selected, setSelected] = useState([]);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let p = null;
      if (recId) p = await base44.entities.PathRecommendations.get(recId).catch(() => null);
      if (!p) {
        const rows = await base44.entities.PathRecommendations.filter({ is_primary_focus: true }, '-updated_date', 1).catch(() => []);
        p = (Array.isArray(rows) && rows[0]) || null;
      }
      if (!p) {
        const rows = await base44.entities.PathRecommendations.list('-updated_date', 1).catch(() => []);
        p = (Array.isArray(rows) && rows[0]) || null;
      }
      if (alive) { setPath(p); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [recId]);

  const topic = TOPICS_BY_ID.get(topicId) || HUMAN_REALITY_TOPICS[0];
  const uncertainty = useMemo(() => {
    const v = WORK_VARIABLES.find(x => x.id === variable) || WORK_VARIABLES.find(x => topic.variables.includes(x.id));
    return v ? { variable: v.id, label: v.label, question: v.ask } : null;
  }, [variable, topic]);

  const brief = useMemo(() => ({
    topic_id: topic.id,
    topic_label: topic.label,
    cannot_simulate: topic.cannot_simulate,
    questions: topic.questions,
    dimensions: topic.dimensions,
    learning: uncertainty?.question || `What ${topic.label.toLowerCase()} is actually like in this career.`,
  }), [topic, uncertainty]);

  useEffect(() => { setSelected(topic.questions); }, [topic]);

  if (loading) {
    return <Shell><Sk h={132} r={20} /><Sk h={300} r={20} /></Shell>;
  }

  if (!path) {
    return (
      <Shell>
        <PageHeader showBack title="Human Reality" />
        <section className="app-card p-6">
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>Choose a path to test first</p>
          <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
            A conversation is aimed at one open question on one path, so there has to be a path behind it.
          </p>
          <Link to="/choose" className="app-cta tp-control mt-4 inline-flex">Choose something to test</Link>
        </section>
      </Shell>
    );
  }

  if (saved) {
    return (
      <Shell>
        <PageHeader showBack title="Human Reality" />
        <HumanRealityLearned record={saved} brief={brief} />
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        showBack
        title="Human Reality"
        description="Some questions cannot be answered by simulated work. This is the experiment type for those."
      />

      <HumanRealityBrief brief={brief} pathName={path.path_name} />

      {/* The unknown is normally carried in from the recommendation. When a
          student arrives here directly, they say which one they are chasing. */}
      <section className="app-card p-6 sm:p-8">
        <label htmlFor="hr-topic" className="tp-label" style={{ color: 'var(--ink-500)' }}>
          What can&apos;t you learn from doing the work yourself?
        </label>
        <select id="hr-topic" value={topicId} onChange={e => setTopicId(e.target.value)}
          className="tp-body mt-2 w-full rounded-[var(--r-control)] px-3 py-3"
          style={{ border: '1px solid var(--border-light)', color: 'var(--ink-900)' }}>
          {HUMAN_REALITY_TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </section>

      <HumanRealityQuestions questions={topic.questions} selected={selected} onChange={setSelected} />
      <HumanRealitySources />
      <HumanRealityLog
        brief={brief}
        path={path}
        cycleId={path.cycle_id || ''}
        uncertainty={uncertainty}
        questions={selected}
        onSaved={setSaved}
      />
    </Shell>
  );
}