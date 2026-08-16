import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Sk } from '@/components/PageSkeleton';
import { loadConversations, humanExposure, REPRESENTATIVENESS_LABELS, SOURCE_LABELS, CHANGED_EXPECTATION_OPTIONS } from '@/lib/human-reality';
import { loadContacts, STATUS_LABELS, INTERACTION_LABELS } from '@/lib/outreach';
import HumanEvidenceCard from '@/components/evidence/HumanEvidenceCard';

/**
 * Human Evidence inside Evidence.
 *
 * One evidence architecture, one more source type: professional, alumni, mentor
 * and advisor interactions, each traceable back to the conversation and the
 * unknown it was aimed at. Conversations still in progress sit underneath as a
 * short list of what is outstanding, not as a pipeline to be worked.
 */
export default function HumanEvidencePanel() {
  const [state, setState] = useState({ loading: true, conversations: [], contacts: [] });

  useEffect(() => {
    let alive = true;
    Promise.all([loadConversations(), loadContacts()]).then(([conversations, contacts]) => {
      if (alive) setState({ loading: false, conversations, contacts });
    });
    return () => { alive = false; };
  }, []);

  if (state.loading) {
    return <main className="app-page"><Sk h={120} r={16} /><div className="mt-5"><Sk h={220} r={16} /></div></main>;
  }

  const recorded = state.conversations.filter(c => c.evidence_status === 'human_evidence_recorded');
  const exposure = humanExposure(state.conversations);
  const open = state.contacts.filter(c => c.outreach_status && !['conversation_completed', 'archived'].includes(c.outreach_status));

  return (
    <main className="app-page">
      <PageHeader
        title="Human Evidence"
        description="What people who do this work told you, and the questions each conversation was aimed at."
      />

      <section className="app-card p-6">
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
          <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Human exposure: {exposure.band}</h2>
        </div>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          {exposure.conversations === 0
            ? 'Nothing recorded yet. Human Reality is for the questions your own experiments cannot answer, such as hours, hierarchy and real stakes.'
            : `${exposure.label} across ${exposure.paths} ${exposure.paths === 1 ? 'path' : 'paths'}, covering ${exposure.topics} ${exposure.topics === 1 ? 'question' : 'questions'} no experiment could answer.`}
        </p>
        <Link to="/human-reality" className="app-cta-secondary tp-control mt-4 inline-flex">
          {exposure.conversations === 0 ? 'Get a human perspective' : 'Record another conversation'}
        </Link>
      </section>

      {recorded.length > 0 && (
        <section className="mt-8">
          <h2 className="tp-section mb-4" style={{ color: 'var(--text-primary)' }}>Professional conversations</h2>
          <ul className="space-y-4">
            {recorded.map(c => (
              <li key={c.id}>
                <HumanEvidenceCard
                  conversation={c}
                  changedLabel={CHANGED_EXPECTATION_OPTIONS.find(o => o.id === c.changed_expectation)?.label}
                  sourceLabel={SOURCE_LABELS.get(c.source_type)}
                  interactionLabel={INTERACTION_LABELS.get(c.interaction_type)}
                  representativeness={REPRESENTATIVENESS_LABELS.get(c.representativeness)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="tp-section mb-3" style={{ color: 'var(--text-primary)' }}>Outreach still open</h2>
          <ul className="space-y-2.5">
            {open.slice(0, 8).map(c => (
              <li key={c.id} className="app-card-flat flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="tp-control" style={{ color: 'var(--ink-900)' }}>{c.role || 'A professional'}{c.company ? ` \u00b7 ${c.company}` : ''}</p>
                  <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {c.path_name || 'No path'}{c.topic_label ? ` \u00b7 ${c.topic_label}` : ''} \u00b7 {STATUS_LABELS.get(c.outreach_status)}
                  </p>
                </div>
                <Link to={`/human-reality?contactId=${c.id}`} className="app-cta-secondary tp-control">View conversation</Link>
              </li>
            ))}
          </ul>
          <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
            Contact details you saved are private to you. Nobody else, including your university, can see them.
          </p>
        </section>
      )}
    </main>
  );
}