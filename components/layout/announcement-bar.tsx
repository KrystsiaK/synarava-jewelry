"use client";

import { useEffect, useRef } from "react";

import {
  announcementMarqueeCopies,
  announcementMarqueeDurationSec,
  resolveAnnouncementBarText,
} from "@/lib/content/announcement-bar-display";
import type { FreeShippingMoney } from "@/lib/content/announcement-bar-fields";

type AnnouncementBarProps = {
  enabled: boolean;
  threshold: FreeShippingMoney | null;
  template: string | null | undefined;
  locale: string;
};

const SCROLL_HIDE_THRESHOLD_PX = 8;

/**
 * Site-wide free-shipping strip above the header.
 * Fixed height + SSR text → no CLS. Marquee pauses on hover/focus;
 * prefers-reduced-motion keeps a static centered line.
 * Hides on scroll so the strip never paints under the transparent sticky nav.
 *
 * Scroll hide + marquee duration are applied as DOM attributes/CSS vars from
 * the scroll/ResizeObserver subscription (not React setState in effects) to
 * satisfy react-hooks/set-state-in-effect.
 */
export function AnnouncementBar({
  enabled,
  threshold,
  template,
  locale,
}: AnnouncementBarProps) {
  const text = resolveAnnouncementBarText({ enabled, threshold, template, locale });
  const barRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text) return;
    if (!barRef.current || !cycleRef.current) return;
    const barEl = barRef.current;
    const cycleEl = cycleRef.current;

    let scheduled = false;
    let frame = 0;

    function syncHiddenFromScroll() {
      barEl.dataset.hidden =
        window.scrollY > SCROLL_HIDE_THRESHOLD_PX ? "true" : "false";
    }

    function handleScroll() {
      if (scheduled) return;
      scheduled = true;
      frame = window.requestAnimationFrame(() => {
        scheduled = false;
        frame = 0;
        syncHiddenFromScroll();
      });
    }

    function applyDuration() {
      const width = cycleEl.getBoundingClientRect().width;
      const next = announcementMarqueeDurationSec(width);
      if (next > 0) {
        barEl.style.setProperty("--announcement-marquee-duration", `${next}s`);
      }
    }

    // Same sync path as the scroll callback (DOM attr, not setState).
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    applyDuration();
    const observer = new ResizeObserver(applyDuration);
    observer.observe(cycleEl);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [text]);

  if (!text) return null;

  const half = announcementMarqueeCopies(text);

  return (
    <div ref={barRef} className="announcement-bar" data-hidden="false">
      <div className="announcement-bar__track" tabIndex={0}>
        {/* Visually hidden while marquee animates; SR reads this content (no aria-label). */}
        <p className="announcement-bar__static">{text}</p>
        <div className="announcement-bar__marquee" aria-hidden="true">
          <div ref={cycleRef} className="announcement-bar__cycle">
            {half.map((copy, index) => (
              <span key={`a-${index}`}>{copy}</span>
            ))}
            {half.map((copy, index) => (
              <span key={`b-${index}`}>{copy}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
