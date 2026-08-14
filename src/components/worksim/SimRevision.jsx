/**
 * Step 4. The estimate changes and the sprint stops fitting.
 *
 * Split into two submits on purpose. The first is the rework: the plan and the
 * spec, with version 1 still on the screen so the student is editing against
 * what they wrote rather than from memory. The second is the answer to Priya's
 * question about Mark, which is a different kind of writing and should not share
 * a button with a spec.
 *
 * The seam between the two is where the second experience sample lands. It is
 * the reading taken after the boring part and after being told the work does not
 * fit, which is the number the whole slice exists to produce.
 */
import { BacklogPicker, totalPoints } from '@/components/worksim/SimBacklog';
import { SimTextArea, SimNext, SimNote } from '@/components/worksim/controls';

export default function SimRevision({
  sim, phase, specV1, specV2, onSpecV2,
  selected, cut, notes, onDecide, onNote,
  engineerReply, onEngineerReply,
  onSubmitRework, onSubmitAnswer, busy,
}) {
  const used = totalPoints(selected, sim, true);
  const capacity = sim.backlog.capacity;

  return (
    <div className="space-y-8">
      <SimNote from={sim.revision.from}>
        <p className="tp-body" style={{ color: 'var(--text-primary)' }}>{sim.revision.message}</p>
      </SimNote>

      {phase === 'rework' ? (
        <>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="tp-card font-semibold" style={{ color: 'var(--text-primary)' }}>The sprint, re-estimated</h2>
              <p className="tp-meta" style={{ color: used > capacity ? 'var(--brand-navy-700)' : 'var(--text-muted)' }}>
                {used} of {capacity} points{used > capacity ? `, ${used - capacity} over` : ''}
              </p>
            </div>
            <div className="mt-4">
              <BacklogPicker
                sim={sim}
                revised
                selected={selected}
                cut={cut}
                notes={notes}
                onDecide={onDecide}
                onNote={onNote}
              />
            </div>
          </div>

          <div>
            <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>Version 1</p>
            <pre
              className="tp-body app-inset mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap p-4 font-body"
              style={{ background: 'var(--background-secondary)', color: 'var(--text-secondary)' }}
            >{specV1}</pre>
          </div>

          <SimTextArea
            id="sim-spec-v2"
            label="Version 2"
            hint={sim.revision.instruction}
            rows={18}
            value={specV2}
            onChange={onSpecV2}
          />

          <SimNext onClick={onSubmitRework} disabled={!specV2.trim()} busy={busy}>
            Save the new version
          </SimNext>
        </>
      ) : (
        <>
          <SimTextArea
            id="sim-engineer-reply"
            label={sim.revision.question}
            hint="A couple of sentences."
            rows={4}
            value={engineerReply}
            onChange={onEngineerReply}
          />

          <SimNext onClick={onSubmitAnswer} disabled={!engineerReply.trim()} busy={busy}>
            Send it to Priya
          </SimNext>
        </>
      )}
    </div>
  );
}
