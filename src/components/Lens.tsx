/* =============================================================================
 * Lens — a segmented control whose selection is a moving lens, not a toggled
 * background.
 *
 * The real buttons render in their resting colours. Above them sits an
 * aria-hidden copy of the same row, filled with the accent and set in the
 * on-accent colour, clipped to the active button's box. Moving the selection
 * animates only that clip-path, so the label colour inverts exactly where the
 * pill's edge is at every frame — no colour cross-fade, no layout property
 * animated, and the geometry is guaranteed identical because both rows are laid
 * out by the same CSS.
 * ========================================================================== */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface LensOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface LensProps<T extends string> {
  options: LensOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** How the active item is announced: tabs are the current page, toggles are pressed. */
  announce: 'current' | 'pressed';
  itemClassName: string;
}

export function Lens<T extends string>({ options, value, onChange, announce, itemClassName }: LensProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [clip, setClip] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const active = Math.max(0, options.findIndex((option) => option.value === value));

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const measure = () => {
      const item = itemRefs.current[active];
      if (!item || group.clientWidth === 0) return;
      const top = item.offsetTop;
      const left = item.offsetLeft;
      const right = group.clientWidth - (left + item.offsetWidth);
      const bottom = group.clientHeight - (top + item.offsetHeight);
      setClip(`inset(${top}px ${right}px ${bottom}px ${left}px round 999px)`);
    };

    measure();
    // Labels collapse to icons on narrow screens, so the boxes move without
    // the selection changing. Re-measure whenever the group reflows.
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [active, options.length]);

  // Enable the transition only after the first measured frame, so the lens
  // starts on its item instead of sliding in from the corner on page load.
  useLayoutEffect(() => {
    if (clip && !ready) {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [clip, ready]);

  return (
    <div className="lens-group" ref={groupRef} data-ready={ready || undefined} data-measured={clip ? true : undefined}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => { itemRefs.current[index] = node; }}
          type="button"
          className={itemClassName}
          title={option.title}
          onClick={() => onChange(option.value)}
          {...(announce === 'current'
            ? { 'aria-current': index === active ? ('page' as const) : undefined }
            : { 'aria-pressed': index === active })}
        >
          {option.label}
        </button>
      ))}

      <div className="lens" aria-hidden="true" style={clip ? { clipPath: clip } : undefined}>
        {options.map((option) => (
          <span key={option.value} className={itemClassName}>{option.label}</span>
        ))}
      </div>
    </div>
  );
}
