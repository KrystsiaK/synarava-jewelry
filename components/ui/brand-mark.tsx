"use client";

import Image from "next/image";

import { useTheme } from "@/components/theme/theme-provider";

type BrandMarkProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: number;
  tone?: "auto" | "light" | "dark";
};

export function BrandMark({
  alt = "Synarava",
  className,
  priority = false,
  size = 96,
  tone = "auto",
}: BrandMarkProps) {
  const { resolvedTheme } = useTheme();
  const useLightMark = tone === "light" || (tone === "auto" && resolvedTheme === "dark");
  const src = useLightMark ? "/brand/synarava-mark-light.svg" : "/brand/synarava-mark-dark.svg";

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      preload={priority}
      className={className}
    />
  );
}
