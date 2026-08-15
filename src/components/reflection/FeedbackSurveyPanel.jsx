/**
 * Loads what the survey needs — this student's existing response, and the
 * version of the experiment they ran — then renders it. Renders nothing until
 * both are settled, so the panel cannot appear and then change under the reader.
 */
import { useEffect, useState } from 'react';
import { loadFeedback, loadVersions } from '@/lib/experiment-feedback';
import ExperimentFeedbackSurvey from '@/components/reflection/ExperimentFeedbackSurvey';
import { Sk } from '@/components/PageSkeleton';

export default function FeedbackSurveyPanel({ experiment }) {
  const [state, setState] = useState(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let live = true;
    if (!experiment?.id) return undefined;
    Promise.all([loadFeedback(experiment.id), loadVersions(experiment)])
      .then(([existing, validation]) => { if (live) setState({ existing, validation }); })
      .catch(() => { if (live) setState({ existing: null, validation: null }); });
    return () => { live = false; };
  }, [experiment?.id]);

  if (!experiment?.id) return null;
  if (!state) return <Sk h={220} r={16} />;
  if (skipped) {
    return (
      <p className="tp-prose" style={{ color: 'var(--text-secondary)' }}>
        Skipped. You can send feedback on this experiment any time from your reflection.
      </p>
    );
  }

  return (
    <ExperimentFeedbackSurvey
      experiment={experiment}
      validation={state.validation}
      existing={state.existing}
      onSaved={(row, opts) => {
        if (opts?.skipped) setSkipped(true);
        else setState(s => ({ ...s, existing: row }));
      }}
    />
  );
}