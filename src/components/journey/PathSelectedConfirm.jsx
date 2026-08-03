import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Shown immediately after a path is selected and its experiment is connected.
 * Confirms the exact wording the student needs to see, then hands them the
 * single next action.
 */
export default function PathSelectedConfirm({ pathName, experiment, onDismiss }) {
  return (
    <section
      className="rounded-[20px] p-6"
      style={{ background: 'var(--success-50)', border: '1px solid #BBF7D0' }}
      role="status"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--success-700)' }} />
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold" style={{ color: '#14532D' }}>
            You are now testing {pathName}. Your first experiment is ready.
          </h2>
          {experiment?.title && (
            <p className="mt-1 text-sm" style={{ color: '#166534' }}>{experiment.title}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to={experiment?.id ? `/experiment?experimentId=${experiment.id}` : '/experiment'}
              className="ui-press inline-flex items-center gap-2 rounded-[10px] px-5 font-heading font-bold text-white"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              Open my experiment <ArrowRight size={16} />
            </Link>
            <button type="button" onClick={onDismiss} className="text-sm font-semibold" style={{ color: '#166534' }}>
              Stay on My Journey
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}