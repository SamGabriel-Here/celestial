// The mark is a star wheel in miniature: the rim, the window, the sun, the pointer. Its sun orbits the
// window by --mark-turn (the tour sets it as its wheel turns) and steps a notch when the link is pointed at.
export function Mark({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <circle cx="15" cy="15.5" r="13" fill="none" stroke="#f3f5fb" strokeWidth="1.3" />
      <circle cx="15" cy="15.5" r="8.5" fill="none" stroke="#f3f5fb" strokeWidth=".9" strokeDasharray="1 2" />
      <circle className="mark-sun" cx="19.6" cy="11" r="2.5" fill="#ffc92e" />
      <path d="M15 0.5v4.5" stroke="#ffc92e" strokeWidth="1.6" />
    </svg>
  );
}
