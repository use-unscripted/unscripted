/**
 * Loads what the survey needs — this student's existing response, the version of
 * the experiment they ran, the cycle it belonged to, and whether they actually
 * spoke to a professional — then renders it. Renders nothing until all of it is
 * settled, so the panel cannot appear and then change under the reader.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { loadFeedback, loadVersions, loadHumanReality, feedbackContext } from '@/lib/experiment-feedback';
import ExperimentFeedbackSurvey from '@/components/reflection/ExperimentFeedbackSurvey';
import { Sk } from '@/components/PageSkeleton';

/** The cycle this experiment ran in, read only to pin the response to it. */
async function loadCycle(experiment) {
  const id = experiment?.career_cycle_id || experiment?.cycle_id;
  if (!id) return null;
  return base44.entities.CareerCycle.get(id).catch(() => null);
}

export default function FeedbackSurveyPanel({ experiment }) {
  const [state, setState] = useState(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let live = true;
    if (!experiment?.id) return undefined;
    Promise.all([
      loadFeedback(experiment.id),
      loadVersions(experiment),
      loadHumanReality(experiment),
      loadCycle(experiment),
    ])
      .then(([existing, validation, humanReality, cycle]) => {
        if (live) setState({ existing, validation, humanReality, cycle });
      })
      .catch(() => { if (live) setState({ existing: null, validation: null, humanReality: false, cycle: null }); });
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
      humanReality={state.humanReality}
      /* Pinned at submission: the version, path, cycle, unknown and validation
         level AS RUN. A later rewrite or re-scoring of the same experiment must
         not rewrite what this response describes. */
      context={feedbackContext({
        experiment,
        validation: state.validation,
        cycle: state.cycle,
        humanReality: state.humanReality,
      })}
      onSaved={(row, opts) => {
        if (opts?.skipped) setSkipped(true);
        else setState(s => ({ ...s, existing: row }));
      }}
    />
  );
}