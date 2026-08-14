/**
 * Step 5. The message to sales.
 *
 * The word limit is shown and never enforced. Going over it is a thing worth
 * knowing about how somebody delivers bad news, and blocking the button would
 * throw that away and cost a completion at the last screen of a 30 minute task.
 */
import { countWords } from '@/components/worksim/SimSpec';
import { SimTextArea, SimNext } from '@/components/worksim/controls';

export default function SimReply({ sim, value, onChange, onSubmit, busy }) {
  const words = countWords(value);
  const limit = sim.reply.word_limit;

  return (
    <div className="space-y-6">
      <SimTextArea
        id="sim-sales-reply"
        label={`To: ${sim.reply.to}`}
        hint={`${sim.reply.prompt} Under ${limit} words.`}
        rows={8}
        value={value}
        onChange={onChange}
      />

      <p className="tp-meta" style={{ color: words > limit ? 'var(--brand-navy-700)' : 'var(--text-muted)' }}>
        {words} of {limit} words
      </p>

      <SimNext onClick={onSubmit} disabled={!value.trim()} busy={busy}>Send it</SimNext>
    </div>
  );
}
