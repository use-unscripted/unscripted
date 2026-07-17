import { LogoWordmark } from '@/components/UnscriptedLogo';

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#FAFAF9' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <LogoWordmark />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#050816]">{title}</h1>
          {subtitle && <p className="text-[#64748B] mt-2 text-sm">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-[#64748B] mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}