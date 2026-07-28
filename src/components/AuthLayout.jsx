import { LogoFull } from '@/components/UnscriptedLogo';

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--background-secondary)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <LogoFull height={56} />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-8" style={{ border: '1px solid var(--border-light)' }}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>{footer}</p>
        )}
      </div>
    </div>
  );
}