/**
 * The language level in force for one path, and the one way to change it.
 *
 * Reads the student's own LanguagePreference rows. Nothing here touches the
 * experiment, the guide, the missions or the progress, so a level change is a
 * display change and cannot reset anything.
 *
 * Two details that are not decoration:
 *
 * 1. A choice the student just made is never overwritten by a read that lands
 *    afterwards. The preference fetch and a student reaching for the control race
 *    on a slow connection, and when the fetch won the control snapped back to
 *    Balanced a second after they picked Plain.
 * 2. The chosen level is mirrored in localStorage per path, so a step opens at
 *    the right level immediately instead of rendering Balanced for a moment
 *    first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_LEVEL, isLevel, levelFor, loadLanguagePreferences, rowFor,
  saveLanguageLevel, shouldAskFamiliarity, trackLanguage,
} from '@/lib/language-level';

const mirrorKey = (pathId) => `ul:lang:level:${pathId || 'global'}`;

function readMirror(pathId) {
  try {
    const value = localStorage.getItem(mirrorKey(pathId));
    return isLevel(value) ? value : null;
  } catch {
    return null;
  }
}

function writeMirror(pathId, level) {
  try {
    localStorage.setItem(mirrorKey(pathId), level);
  } catch {
    // Storage being unavailable only costs the instant read, not the setting.
  }
}

export default function useLanguageLevel({ path, experiment, pathId: pathIdHint } = {}) {
  /* The hint matters: on the guided page the guide record carries `path_id`
     before the path record itself has been fetched, and without it the first
     change a student makes would be written as a site-wide preference instead of
     this path's. */
  const pathId = pathIdHint || path?.id || experiment?.path_id || null;
  const pathName = path?.path_name || experiment?.path_name || null;
  const careerName = experiment?.career_name || pathName;

  const [rows, setRows] = useState(null);
  const [level, setLevelState] = useState(() => readMirror(pathId) || DEFAULT_LEVEL);
  // Set the moment the student picks a level. From then on, the server read is
  // no longer allowed to speak for them.
  const chosen = useRef(false);

  useEffect(() => {
    let live = true;
    chosen.current = false;
    setLevelState(readMirror(pathId) || DEFAULT_LEVEL);
    loadLanguagePreferences().then(list => {
      if (!live) return;
      setRows(list);
      if (chosen.current) return;
      const stored = levelFor(list, pathId);
      setLevelState(stored);
      writeMirror(pathId, stored);
    });
    return () => { live = false; };
  }, [pathId]);

  const setLevel = useCallback(async (next, source = 'manual') => {
    if (!isLevel(next) || next === level) return;
    const previous = level;
    chosen.current = true;
    // Optimistic: the words on screen are the only thing that changes.
    setLevelState(next);
    writeMirror(pathId, next);
    trackLanguage(source === 'asked' ? 'language_level_selected' : 'language_level_changed', {
      level: next,
      previous_level: previous,
      path_id: pathId || 'none',
      source,
    });
    const saved = await saveLanguageLevel({ pathId, pathName, careerName, level: next, source }).catch(() => null);
    if (saved) setRows(list => [saved, ...(list || []).filter(r => r.id !== saved.id)]);
  }, [level, pathId, pathName, careerName]);

  return {
    ready: rows !== null,
    level,
    setLevel,
    careerName,
    pathId,
    preference: rows ? rowFor(rows, pathId) : null,
    askFamiliarity: rows ? shouldAskFamiliarity(rows, pathId) : false,
  };
}