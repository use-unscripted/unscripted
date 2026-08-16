import { UserPlus, Search, NotebookPen } from 'lucide-react';

/**
 * The three ways in. Deliberately not "find a contact": most students already
 * know somebody one step away, and many have already had the conversation and
 * simply never recorded what it told them.
 */
const ACTIONS = [
  { id: 'know', label: 'I already know someone', note: 'A family friend, a former manager, anyone one step away.', Icon: UserPlus },
  { id: 'find', label: 'Find someone', note: 'Alumni, a mentor, or your careers service. We help you write the message.', Icon: Search },
  { id: 'log', label: 'Log a conversation I already had', note: 'It still counts as evidence.', Icon: NotebookPen },
];

export default function HumanPerspectiveActions({ onChoose }) {
  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Who could help</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Somebody currently in the role, somebody recently in it, an alumnus, a mentor, a professor with industry
        experience, or a careers advisor with direct knowledge. Any of them answers this equally well.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ id, label, note, Icon }) => (
          <button key={id} type="button" onClick={() => onChoose(id)}
            className="ui-press ui-lift app-card-flat touch-target flex flex-col items-start gap-2 p-4 text-left">
            <Icon size={18} style={{ color: 'var(--brand-navy-700)' }} aria-hidden="true" />
            <span className="tp-control" style={{ color: 'var(--ink-900)' }}>{label}</span>
            <span className="tp-meta" style={{ color: 'var(--text-secondary)' }}>{note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}