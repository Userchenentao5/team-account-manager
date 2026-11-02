"use client";

import { useEffect } from "react";

/** Start the arrival cue after scrolling; user input always takes precedence. */
export function RiskRecordArrival({ targetId }: { targetId: string }) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let cancelled = false;
    let scrolling = true;
    let previousTop = target.getBoundingClientRect().top;
    let stableFrames = 0;
    const startedAt = performance.now();

    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (scrolling) {
        window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: "instant" });
        scrolling = false;
      }
      target.removeAttribute("data-risk-arrival");
    };
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, cancel, { passive: true }));

    target.scrollIntoView({
      behavior: reducedMotion.matches ? "instant" : "smooth",
      block: "start",
      inline: "nearest",
    });

    const waitForScroll = () => {
      if (cancelled) return;
      const rect = target.getBoundingClientRect();
      stableFrames = Math.abs(rect.top - previousTop) < 0.5 ? stableFrames + 1 : 0;
      previousTop = rect.top;
      if (stableFrames >= 4 || performance.now() - startedAt > 1500) {
        scrolling = false;
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          target.focus({ preventScroll: true });
          if (!reducedMotion.matches) target.setAttribute("data-risk-arrival", "true");
        }
        return;
      }
      frame = requestAnimationFrame(waitForScroll);
    };
    frame = requestAnimationFrame(waitForScroll);

    return () => {
      cancel();
      events.forEach((event) => window.removeEventListener(event, cancel));
    };
  }, [targetId]);

  return null;
}
