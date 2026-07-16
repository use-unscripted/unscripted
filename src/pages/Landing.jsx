import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import LandingSections from '@/components/landing/LandingSections';

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <LandingNav />
      <Hero />
      <LandingSections />
      <footer className="border-t border-[#E2E8F0] px-6 py-8 text-center text-sm text-[#64748B]">
        © 2026 AmbitionOS · Build a life on your terms.
      </footer>
    </div>
  );
}