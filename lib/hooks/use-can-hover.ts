"use client";

import { useEffect, useState } from "react";

/**
 * True when the primary pointer can hover (desktop mouse/trackpad).
 * Touch phones/tablets report false — use to skip hover-only grayscale.
 */
export function useCanHover(): boolean {
  // Desktop-first: avoid a one-frame full-color flash on pointer devices.
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return canHover;
}
