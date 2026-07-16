import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateAmbitionPlan } from '@/lib/ambition-generator';

export default function Generating() {
  const nav = useNavigate();
  const [label, setLabel] = useState('Reading between the lines of your goals...');

  useEffect(() => {
    let active = true;
    const run = async () => {
      setTimeout(() => active && setLabel('Turning ambition into specific weekly moves...'), 2500);
      await generateAmbitionPlan();
      if (active) nav('/profile');
    };
    run();
    return () => { active = false; };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-white" style={{ background: '#061226' }}>
      <div>
        {/* Animated logo */}
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 20px 60px rgba(37,99,235,0.45)' }}
        >
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" className="animate-pulse">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none" />
            <path d="M8 4L11 5.75V9.25L8 11L5 9.25V5.75L8 4Z" fill="white" />
          </svg>
        </div>
        <h1 className="font-heading mt-8 text-3xl font-bold">Building your operating system.</h1>
        <p className="mt-3 text-[#64748B]">{label}</p>
        <div className="mx-auto mt-8 h-1.5 w-64 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full w-2/3 animate-pulse rounded-full"
            style={{ background: 'linear-gradient(90deg, #2563EB, #22D3EE)' }}
          />
        </div>
      </div>
    </main>
  );
}