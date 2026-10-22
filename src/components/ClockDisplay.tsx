import { AnimatePresence, motion } from "motion/react";
import { usePageVisible } from "../hooks/use-page-visible";
import { useMediaQuery } from "../hooks/use-media-query";
import type { AppearanceSettings } from "../data";

export function ClockDisplay({ time, appearance }: { time: string; appearance: AppearanceSettings }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const visible = usePageVisible();
  const animated = visible && !reducedMotion && (appearance.clockStyle === "flip" || appearance.clockStyle === "ticker");
  const speed = Math.min(3, Math.max(1, Number.isFinite(appearance.clockSpeed) ? appearance.clockSpeed : 1));
  const duration = 0.3 / speed;
  if (!animated) return <strong>{time}</strong>;

  const flip = appearance.clockStyle === "flip";
  return (
    <strong className="clock-digits" aria-label={time} data-duration={duration}>
      {[...time].map((digit, index) => (
        <span className={/\d/.test(digit) ? "clock-cell" : digit === ":" ? "clock-separator" : "clock-period"} key={index} aria-hidden="true">
          <AnimatePresence initial={false}>
            <motion.span
              key={digit}
              className="clock-number"
              initial={{ opacity: 0, transform: flip ? "perspective(120px) rotateX(-70deg)" : "translateY(100%)" }}
              animate={{ opacity: 1, transform: flip ? "perspective(120px) rotateX(0deg)" : "translateY(0%)" }}
              exit={{ opacity: 0, transform: flip ? "perspective(120px) rotateX(70deg)" : "translateY(-100%)" }}
              transition={{ duration, ease: [0.23, 1, 0.32, 1] }}
            >{digit}</motion.span>
          </AnimatePresence>
        </span>
      ))}
    </strong>
  );
}
