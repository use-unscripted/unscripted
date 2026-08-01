/**
 * Mounted once inside the app shell: records signup and return-engagement
 * markers for the signed-in student. Renders nothing and never blocks the UI.
 */
import { useEffect } from 'react';
import { trackEngagementMarkers } from '@/lib/pilot-metrics';

export default function PilotTracker() {
  useEffect(() => { trackEngagementMarkers(); }, []);
  return null;
}