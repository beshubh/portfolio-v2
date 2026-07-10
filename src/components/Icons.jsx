function SvgIcon({ children, size = 34, viewBox = "0 0 48 48" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function AboutIcon({ size }) {
  return (
    <SvgIcon size={size}>
      <circle cx="24" cy="18" r="9" fill="#ff7a59" stroke="currentColor" strokeWidth="2.5" />
      <path d="M9 42c1.7-10 7-15 15-15s13.3 5 15 15" fill="#ffd76a" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 17c2.2 1.6 9.2 1.4 12-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function WritingIcon({ size }) {
  return (
    <SvgIcon size={size}>
      <path d="M10 5h22l7 7v31H10V5Z" fill="#fff8e7" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 5v8h7M17 21h15M17 28h15M17 35h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="5" fill="#72d5c5" stroke="currentColor" strokeWidth="2" />
    </SvgIcon>
  );
}

export function ProjectsIcon({ size }) {
  return (
    <SvgIcon size={size}>
      <path d="M5 14h16l4-6h18v31H5V14Z" fill="#ffd76a" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M5 19h38" stroke="currentColor" strokeWidth="2.5" />
      <path d="m19 31 4 4 8-10" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function MenuIcon({ size = 22 }) {
  return (
    <SvgIcon size={size}>
      <rect x="7" y="7" width="14" height="14" rx="2" fill="#ff7a59" stroke="currentColor" strokeWidth="2.5" />
      <rect x="27" y="7" width="14" height="14" rx="2" fill="#ffd76a" stroke="currentColor" strokeWidth="2.5" />
      <rect x="7" y="27" width="14" height="14" rx="2" fill="#72d5c5" stroke="currentColor" strokeWidth="2.5" />
      <rect x="27" y="27" width="14" height="14" rx="2" fill="#f7a7d3" stroke="currentColor" strokeWidth="2.5" />
    </SvgIcon>
  );
}

export function PaletteIcon({ size = 20 }) {
  return (
    <SvgIcon size={size}>
      <path d="M24 5C13.5 5 5 12.6 5 22s8.5 17 19 17h3.5a4.5 4.5 0 0 0 0-9H25a3 3 0 0 1 0-6h11c4.4 0 7-2.9 7-6.5C43 10.6 34.5 5 24 5Z" fill="#ffd76a" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="14" cy="20" r="2.5" fill="#ff7a59" />
      <circle cx="20" cy="13" r="2.5" fill="#72d5c5" />
      <circle cx="29" cy="13" r="2.5" fill="#f7a7d3" />
    </SvgIcon>
  );
}

export function ArrowIcon({ size = 18 }) {
  return (
    <SvgIcon size={size}>
      <path d="M9 24h29M29 14l10 10-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}
