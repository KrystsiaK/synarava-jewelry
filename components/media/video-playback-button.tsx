"use client";

import { useTranslations } from "@/lib/i18n/context";

export function VideoPlaybackButton({
  isPlaying,
  onToggle,
  className,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useTranslations();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isPlaying}
      aria-label={t(isPlaying ? "media.pauseBackgroundVideo" : "media.playBackgroundVideo")}
      className={className ?? "absolute bottom-4 right-4 z-10 grid size-11 place-items-center border border-white/35 bg-black/45 text-white transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"}
    >
      {isPlaying ? (
        <span className="flex gap-1" aria-hidden="true"><span className="h-3.5 w-0.5 bg-current" /><span className="h-3.5 w-0.5 bg-current" /></span>
      ) : (
        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      )}
    </button>
  );
}
