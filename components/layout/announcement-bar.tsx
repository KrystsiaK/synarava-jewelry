"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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
 */
export function AnnouncementBar({
  enabled,
  threshold,
  template,
  locale,
}: AnnouncementBarProps) {
  const text = resolveAnnouncementBarText({ enabled, threshold, template, locale });
  const cycleRef = useRef<HTMLDivElement>(null);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!text) return;
    setHiddenOnScroll(window.scrollY > SCROLL_HIDE_THRESHOLD_PX);
  }, [text]);

  useEffect(() => {
    if (!text) return;

    let frame = 0;

    function updateHidden() {
      setHiddenOnScroll(window.scrollY > SCROLL_HIDE_THRESHOLD_PX);
      frame = 0;
    }

    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateHidden);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [text]);

  useLayoutEffect(() => {
    if (!text) return;
    const cycle = cycleRef.current;
    if (!cycle) return;

    function applyDuration(el: HTMLDivElement) {
      const width = el.getBoundingClientRect().width;
      const next = announcementMarqueeDurationSec(width);
      if (next > 0) setDurationSec(next);
    }

    applyDuration(cycle);
    const observer = new ResizeObserver(() => applyDuration(cycle));
    observer.observe(cycle);
    return () => observer.disconnect();
  }, [text]);

  if (!text) return null;

  const half = announcementMarqueeCopies(text);
  const style =
    durationSec != null
      ? ({
          ["--announcement-marquee-duration"]: `${durationSec}s`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className="announcement-bar"
      data-hidden={hiddenOnScroll ? "true" : "false"}
      style={style}
    >
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
