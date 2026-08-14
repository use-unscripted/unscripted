/**
 * Step 3. One text area with five headings already in it.
 *
 * Deliberately not a form with five fields. Producing prose under a scaffold,
 * with nobody telling you whether it is right, is the work; five labelled boxes
 * would turn it into data entry and would also make the non-goals heading
 * impossible to leave out, which is the thing the third check is looking for.
 *
 * The headings are seeded into the text by the page, so the student can delete
 * one. That is allowed and it is measured.
 */
import { SimTextArea, SimNext } from '@/components/worksim/controls';

export const countWords = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * The five headings as the text area's starting content: each label on its own
 * line with a blank line under it. The non-goals check matches a heading line
 * against the label, so the seeding and the check read the same list.
 */
export const seedSpec = (sim) => sim.spec.headings.map(h => `${h.label}\n\n`).join('');

export default function SimSpec({ sim, value, onChange, onSubmit, busy }) {
  const words = countWords(value);

  return (
    <div className="space-y-7">
      <div className="app-inset p-5" style={{ background: 'var(--background-secondary)' }}>
        <ul className="space-y-2">
          {sim.spec.headings.map(h => (
            <li key={h.id} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{h.label}.</span>{' '}
              {h.hint}
            </li>
          ))}
        </ul>
        <p className="tp-meta mt-4" style={{ color: 'var(--text-muted)' }}>{sim.spec.word_target}</p>
      </div>

      <SimTextArea
        id="sim-spec"
        label="The spec"
        rows={18}
        value={value}
        onChange={onChange}
        placeholder="Write under the headings."
      />

      <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>{words} words so far</p>

      <SimNext onClick={onSubmit} disabled={!value.trim()} busy={busy}>Send it to Priya</SimNext>
    </div>
  );
}
