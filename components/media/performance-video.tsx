"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";

type PerformanceVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  src: string;
  eager?: boolean;
  rootMargin?: string;
};

/**
 * Keeps cinematic video markup and its poster in the document immediately,
 * while delaying the expensive media request until the frame approaches the
 * viewport. `eager` is reserved for an actual above-the-fold film.
 */
export const PerformanceVideo = forwardRef<HTMLVideoElement, PerformanceVideoProps>(
  function PerformanceVideo(
    { src, eager = false, rootMargin = "800px 0px", preload, autoPlay, ...props },
    forwardedRef,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [shouldLoad, setShouldLoad] = useState(eager);

    useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement, []);

    useEffect(() => {
      if (eager || shouldLoad) return;

      const node = videoRef.current;
      if (!node || !("IntersectionObserver" in window)) {
        setShouldLoad(true);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          setShouldLoad(true);
          observer.disconnect();
        },
        { rootMargin },
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [eager, rootMargin, shouldLoad]);

    return (
      <video
        {...props}
        ref={videoRef}
        src={shouldLoad ? src : undefined}
        autoPlay={shouldLoad && autoPlay}
        preload={shouldLoad ? (preload ?? "metadata") : "none"}
      />
    );
  },
);
