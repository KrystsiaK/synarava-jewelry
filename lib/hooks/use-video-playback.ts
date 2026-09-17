"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Imperative play/pause for a background/hero video that autoplays (or is
 * paused up front for reduced motion) — a continuous auto-playing video
 * needs its own accessible pause control regardless of the OS-level
 * reduced-motion preference (REV-26), not just a poster shown instead of
 * autoplay.
 */
export function useVideoPlayback(reduceMotion = false): {
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  toggle: () => void;
} {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (reduceMotion) videoRef.current?.pause();
  }, [reduceMotion]);

  async function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
    }
  }

  return {
    videoRef,
    isPlaying,
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    toggle,
  };
}
