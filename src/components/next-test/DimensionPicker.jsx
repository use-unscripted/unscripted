import FieldSelect from '@/components/ui/FieldSelect';

/**
 * What the student wants this test to answer, chosen before it starts.
 *
 * The recommended dimension is preselected and labelled as such, so the default
 * is still Unscripted's answer. Every option here is an open question on the
 * SAME career hypothesis, so changing it never changes the path being tested.
 */
export default function DimensionPicker({ options = [], value, onChange, question }) {
  if (options.length < 2) return null;

  return (
    <div className="mt-5">
      <p className="tp-label" style={{ color: 'var(--ink-500)' }}>
        What do you want this test to tell you?
      </p>
      <FieldSelect
        value={value}
        onChange={onChange}
        ariaLabel="What do you want this test to tell you?"
        className="mt-2 w-full sm:max-w-md"
        options={options.map(o => ({
          value: o.variable,
          label: `${o.label}${o.recommended ? ' (recommended)' : ''}`,
        }))}
      />
      {question && (
        <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>{question}</p>
      )}
    </div>
  );
}