/* =============================================================================
 * SkyCanvas — draws the sky the selected city is actually under.
 *
 * One canvas, one animation loop, fixed behind all content. When the sky
 * changes (new city, new conditions) the palette tweens rather than cutting.
 * Honours prefers-reduced-motion by painting a single static frame, and idles
 * completely while the tab is hidden.
 * ========================================================================== */

import { useEffect, useRef } from 'react';
import { mixHex, type Sky } from '../lib/sky';

interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Cloud { x: number; y: number; scale: number; speed: number; alpha: number }
/** `depth` runs 0 (far) to 1 (near) and drives speed, opacity and weight together. */
interface Drop { x: number; y: number; speed: number; drift: number; depth: number }
interface Flake { x: number; y: number; r: number; speed: number; sway: number; phase: number }

const MAX_DPR = 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function SkyCanvas({ sky }: { sky: Sky }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The live target, read by the loop without re-subscribing.
  const target = useRef(sky);
  target.current = sky;
  // Set by the render effect; lets a stopped canvas jump straight to the target.
  const snapTo = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let clouds: Cloud[] = [];
    let drops: Drop[] = [];
    let flakes: Flake[] = [];

    // What is painted right now, eased toward `target` so changes feel like weather.
    let shown = { ...sky };
    let flash = 0;
    let nextBolt = performance.now() + rand(2500, 7000);
    // Set whenever the loop resumes after being stopped: the target may have
    // moved on while we were idle, and easing from a stale sky would leave the
    // chrome (which switches instantly) sitting on the wrong background.
    let snapNext = false;

    const resize = () => {
      // Measure the canvas's own box, not the window. A hidden or zero-laid-out
      // window reports 0x0, and sizing to that leaves a zero-pixel bitmap that
      // nothing can be drawn into — the canvas then stays black until some later
      // window event happens to fire, which is not guaranteed. The ResizeObserver
      // below re-runs this the moment the box becomes real.
      const box = canvas.getBoundingClientRect();
      const w = Math.round(box.width) || window.innerWidth;
      const h = Math.round(box.height) || window.innerHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = w;
      height = h;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    /** Particle fields are sized to the viewport, so reseed on resize. */
    const seed = () => {
      const area = (width * height) / (1280 * 800);
      stars = Array.from({ length: Math.round(240 * Math.max(area, 0.4)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.75,
        r: rand(0.4, 1.5),
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.4, 1.6),
      }));
      clouds = Array.from({ length: 10 }, (_, i) => ({
        x: rand(-0.2, 1.2) * width,
        y: rand(0.02, 0.5) * height,
        scale: rand(0.5, 1.5),
        speed: rand(3, 11) * (i % 2 ? 1 : 0.6),
        alpha: rand(0.35, 0.85),
      }));
      drops = Array.from({ length: Math.round(240 * Math.max(area, 0.4)) }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          depth,
          speed: 230 + depth * 300,
          drift: 12 + depth * 38,
        };
      });
      flakes = Array.from({ length: Math.round(220 * Math.max(area, 0.4)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rand(1, 3.1),
        speed: rand(28, 90),
        sway: rand(10, 42),
        phase: Math.random() * Math.PI * 2,
      }));
    };

    /** Ease every visual quantity toward the target so transitions read as weather. */
    const approach = (dt: number) => {
      const t = target.current;
      const k = reduced || snapNext ? 1 : Math.min(1, dt * 2.6);
      snapNext = false;
      shown = {
        ...t,
        gradient: [0, 1, 2].map((i) =>
          mixHex(shown.gradient[i]!, t.gradient[i]!, k)
        ) as Sky['gradient'],
        glow: mixHex(shown.glow, t.glow, k),
        cloudTone: mixHex(shown.cloudTone, t.cloudTone, k),
        glowAt: [
          shown.glowAt[0] + (t.glowAt[0] - shown.glowAt[0]) * k,
          shown.glowAt[1] + (t.glowAt[1] - shown.glowAt[1]) * k,
        ],
        stars: shown.stars + (t.stars - shown.stars) * k,
        clouds: shown.clouds + (t.clouds - shown.clouds) * k,
        precipRate: shown.precipRate + (t.precipRate - shown.precipRate) * k,
        fog: shown.fog + (t.fog - shown.fog) * k,
      };
    };

    const paint = (time: number, dt: number) => {
      const s = shown;

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, s.gradient[0]);
      bg.addColorStop(0.55, s.gradient[1]);
      bg.addColorStop(1, s.gradient[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Sun or moon, as a soft bloom rather than a disc.
      const gx = s.glowAt[0] * width;
      const gy = s.glowAt[1] * height;
      const radius = Math.max(width, height) * 0.42;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      glow.addColorStop(0, `${s.glow}${toHexAlpha(s.isNight ? 0.8 : 0.62)}`);
      glow.addColorStop(0.18, `${s.glow}3d`);
      glow.addColorStop(1, `${s.glow}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (s.stars > 1) {
        const density = Math.min(1, s.stars / 220);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < stars.length * density; i++) {
          const star = stars[i]!;
          const twinkle = reduced ? 0.7 : 0.45 + 0.55 * Math.sin(time * star.speed + star.phase);
          ctx.globalAlpha = Math.max(0, twinkle) * 0.9 * density;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (s.clouds > 0.2) {
        const visible = Math.min(clouds.length, Math.round(s.clouds));
        for (let i = 0; i < visible; i++) {
          const cloud = clouds[i]!;
          if (!reduced) {
            cloud.x += cloud.speed * dt;
            if (cloud.x - 420 * cloud.scale > width) cloud.x = -420 * cloud.scale;
          }
          const r = 200 * cloud.scale;
          const puff = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, r);
          puff.addColorStop(0, `${s.cloudTone}${toHexAlpha(cloud.alpha * 0.55)}`);
          puff.addColorStop(1, `${s.cloudTone}00`);
          ctx.fillStyle = puff;
          ctx.fillRect(cloud.x - r, cloud.y - r, r * 2, r * 2);
        }
      }

      if (s.fog > 0.02) {
        for (let i = 0; i < 5; i++) {
          const y = height * (0.35 + i * 0.14);
          const offset = reduced ? 0 : Math.sin(time * 0.12 + i) * 90;
          const band = ctx.createLinearGradient(0, y - 70, 0, y + 70);
          band.addColorStop(0, '#c9d2dd00');
          band.addColorStop(0.5, `#c9d2dd${toHexAlpha(s.fog * 0.42)}`);
          band.addColorStop(1, '#c9d2dd00');
          ctx.fillStyle = band;
          ctx.fillRect(offset - 100, y - 70, width + 200, 140);
        }
      }

      if (s.precip !== 'none' && s.precipRate > 0.02) {
        if (s.precip === 'snow') paintSnow(s.precipRate, dt, time);
        else paintRain(s.precipRate, dt, s.precip === 'drizzle');
      }

      if (s.lightning && !reduced) {
        if (time * 1000 > nextBolt) {
          flash = 1;
          nextBolt = time * 1000 + rand(2600, 9000);
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(226,236,255,${flash * 0.5})`;
          ctx.fillRect(0, 0, width, height);
          flash = Math.max(0, flash - dt * 3.4);
        }
      }

      // Bottom scrim: guarantees contrast whatever the sky is doing. It pushes
      // *away* from the chrome's text colour — darker under light text, lighter
      // under dark text — so it never fights the panels sitting on top.
      const dark = s.scheme === 'dark';
      const scrim = ctx.createLinearGradient(0, height * 0.3, 0, height);
      scrim.addColorStop(0, dark ? 'rgba(4,8,18,0)' : 'rgba(236,244,255,0)');
      scrim.addColorStop(1, dark ? 'rgba(4,8,18,0.52)' : 'rgba(236,244,255,0.46)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, height);
    };

    /**
     * Rain is drawn as three depth bands rather than one flat sheet: far drops are
     * thin, slow and nearly transparent, near ones slightly heavier. Each band is
     * a single stroke, so the whole effect costs three draw calls.
     *
     * Streak length is derived from how far a drop travels in one frame rather
     * than being a fixed random value. If a streak is shorter than its per-frame
     * step the drop lands in a visibly different place each frame and reads as
     * strobing; keeping it a little longer than the step makes successive frames
     * overlap, which is what actually looks like falling water.
     */
    const RAIN_BANDS = 3;
    const FRAME = 1 / 60;

    const paintRain = (rate: number, dt: number, light: boolean) => {
      const count = Math.round(drops.length * rate);

      if (!reduced) {
        for (let i = 0; i < count; i++) {
          const drop = drops[i]!;
          drop.y += drop.speed * dt;
          drop.x += drop.drift * dt;
          if (drop.y > height + 24) {
            drop.y = -24;
            drop.x = Math.random() * width;
          }
          if (drop.x > width) drop.x -= width;
          else if (drop.x < 0) drop.x += width;
        }
      }

      ctx.lineCap = 'round';
      for (let band = 0; band < RAIN_BANDS; band++) {
        const lo = band / RAIN_BANDS;
        const hi = (band + 1) / RAIN_BANDS;
        const mid = (lo + hi) / 2;

        ctx.strokeStyle = `rgba(216,232,252,${(
          (light ? 0.045 : 0.07) + mid * (light ? 0.085 : 0.15)
        ).toFixed(3)})`;
        ctx.lineWidth = (light ? 0.45 : 0.55) + mid * (light ? 0.45 : 0.7);
        ctx.beginPath();

        for (let i = 0; i < count; i++) {
          const drop = drops[i]!;
          if (drop.depth < lo || drop.depth >= hi) continue;
          const len = Math.min(20, Math.max(6, drop.speed * FRAME * 1.45));
          const tilt = drop.drift / drop.speed;
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - len * tilt, drop.y - len);
        }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    };

    const paintSnow = (rate: number, dt: number, time: number) => {
      const count = Math.round(flakes.length * rate * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < Math.min(count, flakes.length); i++) {
        const flake = flakes[i]!;
        if (!reduced) {
          flake.y += flake.speed * dt;
          if (flake.y > height) { flake.y = -6; flake.x = Math.random() * width; }
        }
        const x = flake.x + Math.sin(time * 0.6 + flake.phase) * flake.sway;
        ctx.beginPath();
        ctx.arc(x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      approach(dt);
      paint(now / 1000, dt);
      frame = requestAnimationFrame(tick);
    };

    /** One synchronous snapped frame. Safe while hidden, when rAF never fires. */
    const paintNow = () => {
      snapNext = true;
      approach(0);
      paint(performance.now() / 1000, 0);
    };

    const start = (snap = false) => {
      // A frame id is assigned even while hidden, where the callback never runs,
      // so it is not on its own proof that anything is being painted.
      if (frame && !document.hidden) return;
      if (document.hidden) { paintNow(); return; }
      if (snap) snapNext = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); return; }
      // Dimensions may have been unavailable while hidden, so re-measure first.
      resize();
      start(true);
    };

    // While the loop is stopped the canvas would otherwise keep showing the old
    // city's sky. The chrome's light/dark switch is instant, so a stale sky means
    // dark text on a dark background until the tab is looked at again. Painting a
    // single snapped frame on demand keeps the two in agreement at all times.
    snapTo.current = () => {
      if (frame && !document.hidden) return;
      paintNow();
    };

    resize();
    // Always leave a real frame on the canvas before anything else: a tab opened
    // in the background gets no rAF callbacks and would otherwise show black.
    paintNow();
    if (!reduced) start();

    // Observing the element covers every way the box can change — window resize,
    // layout shifts, and the first moment it gains a size after mounting hidden.
    const observer = new ResizeObserver(() => {
      const before = `${width}x${height}`;
      resize();
      if (`${width}x${height}` !== before) paintNow();
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Deliberately mounts once: updates arrive through the `target` ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    snapTo.current?.();
  }, [sky]);

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />;
}

const toHexAlpha = (alpha: number) =>
  Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
