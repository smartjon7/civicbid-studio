/**
 * Small inline SVG glyphs drawn here, with no third-party marks. Every status
 * badge pairs one of these with text so colour is never the only signal.
 */
export type GlyphKind =
  | 'check'
  | 'double-check'
  | 'cross'
  | 'warning'
  | 'arrow'
  | 'dot'
  | 'agent'
  | 'human'
  | 'system'
  | 'read'
  | 'write'
  | 'star'
  | 'lock'
  | 'info';

function paths(kind: GlyphKind) {
  switch (kind) {
    case 'check':
      return <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    case 'double-check':
      return (
        <>
          <path d="M1.5 8.5l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 8.5l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'cross':
      return <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />;
    case 'warning':
      return (
        <>
          <path d="M8 2l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 6.5v3.5M8 12v.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case 'arrow':
      return <path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />;
    case 'dot':
      return <circle cx="8" cy="8" r="3.5" fill="currentColor" />;
    case 'agent':
      return (
        <>
          <path d="M8 1.5l5.6 3.25v6.5L8 14.5 2.4 11.25v-6.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </>
      );
    case 'human':
      return (
        <>
          <circle cx="8" cy="5" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case 'system':
      return (
        <>
          <circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5M3.4 3.4l1.8 1.8M10.8 10.8l1.8 1.8M12.6 3.4l-1.8 1.8M5.2 10.8l-1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case 'read':
      return (
        <>
          <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </>
      );
    case 'write':
      return <path d="M3 11.2l-.6 2.4 2.4-.6L12.6 5.2l-1.8-1.8zM10 4.2l1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />;
    case 'star':
      return <path d="M8 1.8l1.9 4 4.4.5-3.2 3 .9 4.4L8 11.5l-3.9 2.2.9-4.4-3.3-3 4.4-.5z" fill="currentColor" />;
    case 'lock':
      return (
        <>
          <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case 'info':
      return (
        <>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7v4.2M8 4.8v.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
  }
}

export function Glyph({ kind, className = '' }: { kind: GlyphKind; className?: string }) {
  return (
    <svg className={`glyph ${className}`.trim()} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      {paths(kind)}
    </svg>
  );
}
