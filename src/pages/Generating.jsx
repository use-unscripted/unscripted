import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateAmbitionPlan } from '@/lib/ambition-generator';
import { CompassIcon } from '@/components/UnscriptedLogo';

export default function Generating() {
  const nav = useNavigate();
  const [label, setLabel] = useState('Reading between the lines of your goals...');

  useEffect(() => {
    let active = true;
    const run = async () => {
      setTimeout(() => active && setLabel('Turning your goals into specific weekly moves...'), 2500);
      await generateAmbitionPlan();
      if (active) nav('/profile');
    };
    run();
    return () => { active = false; };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-white" style={{ background: '#081225' }}>
      <div>
        <div className="mx-auto flex items-center justify-center h-16 w-16 animate-pulse">
          <CompassIcon size={56} />
        </div>
        <h1 className="font-heading mt-8 text-3xl font-bold">Building your Unscripted profile.</h1>
        <p className="mt-3 text-slate-400">{label}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full w-2/3 animate-pulse rounded-full"
            style={{ background: '#8B0C21' }}
          />
        </div>
      </div>
    </main>
  );
}