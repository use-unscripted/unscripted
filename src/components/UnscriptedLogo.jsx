// Unscripted brand logo components — navy/gold compass from uploaded brand assets

// Full horizontal logo: wordmark + compass (for headers, auth, landing)
export function LogoFull({ className = '', height = 36 }) {
  return (
    <img
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/3542e4101_image.png"
      alt="Unscripted"
      height={height}
      style={{ height: `${height}px`, width: 'auto', display: 'block' }}
      className={className}
    />
  );
}

// Compass-only icon (for sidebar, mobile nav, favicon placeholders)
export function CompassIcon({ size = 24, className = '' }) {
  return (
    <img
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/eb1f9cbfe_image.png"
      alt="Unscripted compass"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', display: 'block' }}
      className={className}
    />
  );
}

// Alias — used by components that still import LogoWordmark
export function LogoWordmark({ className = '', height = 32 }) {
  return <LogoFull className={className} height={height} />;
}