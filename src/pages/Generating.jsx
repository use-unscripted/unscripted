import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePathTest } from '@/lib/path-generator';
import { CompassIcon } from '@/components/UnscriptedLogo';

const LABELS = [
  'Analyzing your priorities and available time...',
  'Mapping your selected path against your profile...',
  'Building honest tradeoff assessments...',
  'Generating your 30-day experiment plan...',
];

export default function Generating() {
  const nav = useNavigate();
  const [labelIdx, setLabelIdx] = useState(0);

  useEffect(() => {
    let active = true;
    const interval = setInterval(() => {
      if (active) setLabelIdx(i => Math.min(i + 1, LABELS.length - 1));
    }, 2500);
    const run = async () => {
      await generatePathTest();
      if (active) nav('/path-results');
    };
    run();
    return () => { active = false; clearInterval(interval); };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-white" style={{ background: '#081225' }}>
      <div>
        <div className="mx-auto flex items-center justify-center h-16 w-16 animate-pulse">
          <CompassIcon size={56} />
        </div>
        <h1 className="font-heading mt-8 text-3xl font-bold">Building your 30-day path test.</h1>
        <p className="mt-3 text-slate-400">{LABELS[labelIdx]}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full animate-pulse rounded-full" style={{ width: `${Math.round((labelIdx + 1) / LABELS.length * 100)}%`, background: '#8B0C21', transition: 'width 0.5s ease' }} />
        </div>
        <p className="mt-6 text-xs text-slate-500">This usually takes 20–30 seconds.</p>
      </div>
    </main>
  );
}