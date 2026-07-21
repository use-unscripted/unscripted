import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * ScrollReveal — wraps children in a fade-up reveal on scroll.
 *
 * Props:
 *   delay     – ms delay before animation (for staggering siblings)
 *   y         – initial translateY offset in px (default 22)
 *   threshold – IntersectionObserver threshold (default 0.12)
 *   className – extra classes on the wrapper
 *   as        – element tag (default 'div')
 *   stagger   – if true, adds staggered delay to direct children via CSS custom props
 */
export default function ScrollReveal({
  children,
  delay = 0,
  y = 22,
  threshold,
  className = '',
  style: extraStyle = {},
  as: Tag = 'div',
  stagger = false,
}) {
  const [ref, visible] = useScrollReveal({ threshold });

  const style = {
    ...extraStyle,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px)' : `translateY(${y}px)`,
    transition: `opacity 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    willChange: 'opacity, transform',
  };

  return (
    <Tag ref={ref} style={style} className={`${stagger ? 'scroll-stagger' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * RevealImage — clips an image upward using a clip-path reveal.
 */
export function RevealImage({ src, alt, className = '', delay = 0, style: extraStyle = {} }) {
  const [ref, visible] = useScrollReveal({ threshold: 0.1 });

  const wrapStyle = {
    clipPath: visible ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)',
    transition: `clip-path 0.75s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    willChange: 'clip-path',
    ...extraStyle,
  };

  return (
    <div ref={ref} style={wrapStyle} className={className}>
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  );
}

/**
 * StaggerGroup — automatically staggers direct-child ScrollReveal delays.
 * Wrap multiple ScrollReveal children; pass base & step in ms.
 */
export function StaggerGroup({ children, base = 0, step = 80, className = '', as: Tag = 'div' }) {
  const [ref, visible] = useScrollReveal({ threshold: 0.08 });

  return (
    <Tag ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) =>
            child
              ? <InlineReveal key={i} visible={visible} delay={base + i * step}>{child}</InlineReveal>
              : null
          )
        : children}
    </Tag>
  );
}

function InlineReveal({ children, visible, delay }) {
  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px)' : 'translateY(20px)',
    transition: `opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    willChange: 'opacity, transform',
  };
  return <div style={style}>{children}</div>;
}