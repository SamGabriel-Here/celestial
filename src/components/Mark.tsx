// The mark is a section in miniature: a framed slice of sky, the freezing-level line, the sun.
export function Mark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="1" y="1" width="26" height="26" fill="none" stroke="#11141b" strokeWidth="1.6" />
      <path d="M1 18.5 C6 14.5 9.5 17.5 14 16 S22 12.5 27 14.5" fill="none" stroke="#0091c2" strokeWidth="1.8" />
      <circle cx="19.5" cy="7.5" r="3" fill="#11141b" />
      <path d="M5 23.5h18" stroke="#11141b" strokeWidth="1" />
    </svg>
  );
}
