// Unscripted brand logo components — navy/gold compass from uploaded brand assets
//
// Both assets carry a real alpha channel. The originals were flattened onto a
// #FDFDFD card, which read as a pale rectangle pasted over the page — most
// obviously as a band across the top of the landing nav, where the logo's
// backdrop sat a shade off the page surface behind it. That was previously
// masked with mix-blend-mode: multiply, which only ever worked while whatever
// sat behind the logo was itself near-white. Transparent art needs no blend
// mode and stays correct on navy, on the warm surfaces, and over imagery.

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
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/5b5919d9f_unscripted-wordmark-transparent.png"
      alt="Unscripted"
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      style={{
        height: `${height}px`,
        width: 'auto',
        display: 'block',
        ...(invert ? { filter: 'brightness(0) invert(1)' } : {}),
        ...extraStyle,
      }}
      className={className}
    />
  );
}

// Compass-only icon (for sidebar, mobile nav, favicon placeholders).
// This used to point at a cropped screenshot of a browser tab — the strip of
// chrome reading "Unscripted | Build Your Own Path" — which is what actually
// rendered on the loading screens, the generating screen and post-auth. It now
// points at the compass mark itself, the same art the browser tab uses.
export function CompassIcon({ size = 24, className = '' }) {
  return (
    <img
      src="https://media.base44.com/images/public/6a591b5064fe15dff1df6a81/8c5548e66_unscripted-compass-mark-transparent.png"
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