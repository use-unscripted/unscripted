// Unscripted brand logo components — navy/gold compass from uploaded brand assets

// The hosted wordmark asset is 1024×512, i.e. exactly 2:1. Both intrinsic
// attributes have to be on the <img> or the browser has no aspect ratio to
// reserve space with while it downloads, and the nav (and every auth screen)
// reflows the moment it arrives. Rendered size is still driven by the inline
// height + width:auto below, so this changes layout stability, not looks.
const LOGO_ASPECT = 1024 / 512;

// Full horizontal logo: wordmark + compass (for headers, auth, landing)
export function LogoFull({ className = '', height = 36, style: extraStyle = {}, invert = false }) {
  return (
    <img
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/3542e4101_image.png"
      alt="Unscripted"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      style={{
        height: `${height}px`,
        width: 'auto',
        display: 'block',
        mixBlendMode: 'multiply',
        ...(invert ? { filter: 'invert(1) brightness(2)', mixBlendMode: 'normal' } : {}),
        ...extraStyle,
      }}
      className={className}
    />
  );
}

// Compass-only icon (for sidebar, mobile nav, favicon placeholders)
export function CompassIcon({ size = 24, className = '' }) {
  return (
    <img
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/0dfc2fe8f_image.png"
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