type BrandMarkProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: number;
  tone?: "auto" | "light" | "dark";
};

type BrandWordmarkProps = {
  alt?: string;
  className?: string;
  height?: number;
  tone?: "light" | "dark";
};

export function BrandMark({
  alt = "Synarava",
  className,
  priority = false,
  size = 96,
  tone = "auto",
}: BrandMarkProps) {
  const resolvedTone = tone === "auto" ? "light" : tone;

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-tone={resolvedTone}
      data-priority={priority ? "true" : undefined}
      className={["brand-mark", className].filter(Boolean).join(" ")}
      style={{ "--brand-mark-size": `${size}px` } as CSSProperties}
    />
  );
}

export function BrandWordmark({
  alt = "Synarava",
  className,
  height = 42,
  tone = "light",
}: BrandWordmarkProps) {
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-tone={tone}
      className={["brand-wordmark", className].filter(Boolean).join(" ")}
      style={{ "--brand-wordmark-height": `${height}px` } as CSSProperties}
    />
  );
}
import type { CSSProperties } from "react";
