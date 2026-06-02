"use client";

import Image from "next/image";

import { useTheme } from "@/components/theme/theme-provider";

type BrandMarkProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: number;
};

export function BrandMark({
  alt = "Synarava",
  className,
  priority = false,
  size = 96,
}: BrandMarkProps) {
  const { resolvedTheme } = useTheme();
  const src =
    resolvedTheme === "dark"
      ? "/brand/synarava-mark-dark.svg"
      : "/brand/synarava-mark-light.svg";

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
