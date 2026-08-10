import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import PreExperimentCheckIn from '@/components/measurement/PreExperimentCheckIn';
import PostExperimentCheckIn from '@/components/measurement/PostExperimentCheckIn';

/**
 * The measurement step, wherever the loop actually passes through.
 *
 * The pre and post check-ins used to be reachable only from the status buttons
 * on the experiments list, so a student who ran the intended flow (My Journey →
 * mission guide → missions → reflect) was never measured, and every later stage
 * that depends on measurement — ability, enjoyment, recalculation, the next
 * recommendation — had nothing to read. This puts the same two check-ins in the
 * workspace and in the reflection, so the chain cannot be walked around.
 *
 * `phase` is 'pre' or 'post'. Renders nothing once that half is recorded.
 */
export default function MeasurementGate({ phase, exp, measurement, onSaved, autoOpen = false }) {
  const done = phase === 'pre' ? !!measurement?.pre_completed_at : !!measurement?.post_completed_at;
  const [open, setOpen] = useState(false);

  // Offered once per experiment per session. A student who closes it keeps the
  // card below and can open it again; nobody is trapped behind a modal.
  useEffect(() => {
    if (done || !autoOpen || !exp?.id) return;
    const key = `unscripted_measure_${phase}_${exp.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private mode */ }
    setOpen(true);
  }, [done, autoOpen, exp?.id, phase]);

  if (done) return null;

  const copy = phase === 'pre'
    ? {
        title: 'Record what you expect before you start',
        body: 'Five quick taps on how enjoyable, hard and energising you think this will be. Without them there is nothing to compare the result against, and this experiment cannot tell us much.',
        cta: 'Answer the five',
      }
    : {
        title: 'Record how that actually went',
        body: 'Seven quick taps on the work itself. This is what turns a finished experiment into evidence about what fits you, and it is read before your careers are recalculated.',
        cta: 'Record the outcome',
      };

  return (
    <>
      {open && phase === 'pre' && (
        <PreExperimentCheckIn
          exp={exp}
          onClose={() => setOpen(false)}
          onSaved={(row) => { setOpen(false); onSaved(row); }}
        />
      )}
      {open && phase === 'post' && (
        <PostExperimentCheckIn
          exp={exp}
          measurement={measurement}
          onClose={() => setOpen(false)}
          onSaved={(row) => { setOpen(false); onSaved(row); }}
        />
      )}

      <section
        className="rounded-[20px] bg-white p-5 sm:p-6"
        style={{ border: '1px solid var(--brand-gold-500)' }}
      >
        <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-gold-700)' }}>
          <Gauge size={12} /> Measurement
        </p>
        <h2 className="tp-section mt-2" style={{ color: 'var(--text-primary)' }}>{copy.title}</h2>
        <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>{copy.body}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ui-press tp-body mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-6 font-bold text-white sm:w-auto"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
        >
          {copy.cta}
        </button>
      </section>
    </>
  );
}