// Four-point compass/star in maroon #8B0C21 — no container, no gradient, no shadow
export function CompassIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M50 2 L62 44 L98 50 L62 56 L50 98 L38 56 L2 50 L38 44 Z"
        fill="#8B0C21"
      />
    </svg>
  );
}

export function LogoWordmark({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <CompassIcon size={22} />
      <span
        className="font-heading text-lg font-bold tracking-tight"
        style={{ color: '#050816' }}
      >
        Unscripted
      </span>
    </div>
  );
}