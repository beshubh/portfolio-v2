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
      <circle cx="24" cy="18" r="9" fill="#9ef01a" stroke="currentColor" strokeWidth="2.5" />
      <path d="M9 42c1.7-10 7-15 15-15s13.3 5 15 15" fill="#dfe6df" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 17c2.2 1.6 9.2 1.4 12-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function WritingIcon({ size }) {
  return (
    <SvgIcon size={size}>
      <path d="M10 5h22l7 7v31H10V5Z" fill="#edf1eb" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 5v8h7M17 21h15M17 28h15M17 35h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="7" y="3" width="10" height="10" fill="#00c2d1" stroke="currentColor" strokeWidth="2" />
    </SvgIcon>
  );
}

export function ProjectsIcon({ size }) {
  return (
    <SvgIcon size={size}>
      <path d="M5 14h16l4-6h18v31H5V14Z" fill="#ffb000" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M5 19h38" stroke="currentColor" strokeWidth="2.5" />
      <path d="m19 31 4 4 8-10" stroke="#1f1c18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function MenuIcon({ size = 22 }) {
  return (
    <SvgIcon size={size}>
      <rect x="7" y="7" width="14" height="14" rx="1" fill="#9ef01a" stroke="currentColor" strokeWidth="2.5" />
      <rect x="27" y="7" width="14" height="14" rx="1" fill="#00c2d1" stroke="currentColor" strokeWidth="2.5" />
      <rect x="7" y="27" width="14" height="14" rx="1" fill="#ffb000" stroke="currentColor" strokeWidth="2.5" />
      <rect x="27" y="27" width="14" height="14" rx="1" fill="#ff5c35" stroke="currentColor" strokeWidth="2.5" />
    </SvgIcon>
  );
}

export function PaletteIcon({ size = 20 }) {
  return (
    <SvgIcon size={size}>
      <path d="m17 12-9 12 9 12M31 12l9 12-9 12M27 7l-6 34" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
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
