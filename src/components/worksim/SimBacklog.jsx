/**
 * Step 2. Seven things people want, 19 points of work, 6 points of capacity.
 *
 * Choosing is the easy half and it is not the half that tests anything. The
 * second half is the line the student writes to the person whose request they
 * just cut, which is why a cut reveals a text field and an item put in does not.
 *
 * Every item is decided one way or the other before the step will move on. A
 * default of "out" would let somebody pass this step by scrolling past it, and
 * the cut is the thing being asked for.
 */
import { pointsFor } from '@/lib/work-sim-checks';
import { SimTextArea, SimNext } from '@/components/worksim/controls';

/** Points as they stand at this stage: the first estimate, or Priya's revision. */
export const pointsAt = (item, sim, revised) => (revised ? pointsFor(item.id, sim) : item.points);

export const totalPoints = (ids, sim, revised) =>
  sim.backlog.items
    .filter(i => ids.includes(i.id))
    .reduce((sum, i) => sum + pointsAt(i, sim, revised), 0);

/**
 * The in / cut list, shared with the revision step so the second pass at the
 * sprint looks like the first one with new numbers rather than a new screen.
 */
export function BacklogPicker({ sim, revised, selected, cut, notes, onDecide, onNote }) {
  return (
    <ul className="space-y-3">
      {sim.backlog.items.map(item => {
        const isIn = selected.includes(item.id);
        const isCut = cut.includes(item.id);
        return (
          <li
            key={item.id}
            className="app-card-flat p-4 sm:p-5"
            style={isIn ? { borderColor: 'var(--brand-navy-900)' } : undefined}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div style={{ maxWidth: '38rem' }}>
                <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {pointsAt(item, sim, revised)} {pointsAt(item, sim, revised) === 1 ? 'point' : 'points'} · {item.requested_by}
                </p>
                <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{item.note}</p>
              </div>
              <div className="flex gap-2">
                {[['in', 'In'], ['cut', 'Cut']].map(([key, label]) => {
                  const on = key === 'in' ? isIn : isCut;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${item.title}: ${label}`}
                      onClick={() => onDecide(item.id, key)}
                      className="tp-control rounded-[var(--r-control)] border px-4 font-bold transition-colors"
                      style={on
                        ? { minHeight: '44px', borderColor: 'var(--brand-navy-900)', background: 'var(--brand-navy-900)', color: '#fff' }
                        : { minHeight: '44px', borderColor: 'var(--border-light)', background: 'var(--background-primary)', color: 'var(--text-secondary)' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {isCut && (
              <div className="mt-4">
                <SimTextArea
                  id={`cut-note-${item.id}`}
                  label={sim.backlog.cut_note_prompt}
                  rows={2}
                  value={notes[item.id] || ''}
                  onChange={(v) => onNote(item.id, v)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function SimBacklog({
  sim, problem, onProblem, selected, cut, notes, onDecide, onNote, onSubmit, busy,
}) {
  const used = totalPoints(selected, sim, false);
  const capacity = sim.backlog.capacity;
  const decided = sim.backlog.items.every(i => selected.includes(i.id) || cut.includes(i.id));
  const ready = decided && problem.trim().length > 0;

  return (
    <div className="space-y-8">
      <SimTextArea
        id="sim-problem"
        label="In one line, what is the problem?"
        hint="One sentence, before you choose anything."
        rows={2}
        value={problem}
        onChange={onProblem}
      />

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="tp-card font-semibold" style={{ color: 'var(--text-primary)' }}>What goes in the sprint</h2>
          <p className="tp-meta" style={{ color: used > capacity ? 'var(--brand-navy-700)' : 'var(--text-muted)' }}>
            {used} of {capacity} points{used > capacity ? `, ${used - capacity} over` : ''}
          </p>
        </div>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{sim.backlog.capacity_note}</p>

        <div className="mt-4">
          <BacklogPicker
            sim={sim}
            revised={false}
            selected={selected}
            cut={cut}
            notes={notes}
            onDecide={onDecide}
            onNote={onNote}
          />
        </div>
      </div>

      <div>
        <SimNext onClick={onSubmit} disabled={!ready} busy={busy}>That is my sprint</SimNext>
        {!ready && (
          <p className="tp-meta mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            Write the problem in one line, and put every item either in or out.
          </p>
        )}
      </div>
    </div>
  );
}
