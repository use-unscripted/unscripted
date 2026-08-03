/**
 * Path selection is no longer its own page — it is the first four questions of
 * the guided intake. This route survives so existing links, bookmarks and the
 * "generate my paths" empty state keep landing somewhere sensible: question one.
 */
import { Navigate } from 'react-router-dom';

export default function PathsIntake() {
  return <Navigate to="/onboarding?step=0" replace />;
}
