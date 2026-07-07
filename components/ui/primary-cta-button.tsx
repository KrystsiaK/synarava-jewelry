"use client";

import { ArrowRight } from "lucide-react";

import { artifactButtonClasses } from "./artifact-button";
import { MagneticButton } from "./magnetic-button";

interface PrimaryCtaButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function PrimaryCtaButton({ href, children, className }: PrimaryCtaButtonProps) {
  return (
    <MagneticButton
      href={href}
      className={artifactButtonClasses({
        variant: "primary",
        size: "lg",
        className: `relative overflow-hidden ${className ?? ""}`,
      })}
    >
      <span className="relative z-10">{children}</span>
      <ArrowRight
        className="relative z-10 size-3.5 transition-transform duration-300 group-hover:translate-x-1"
        aria-hidden="true"
        strokeWidth={1.8}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)",
          animation: "shiny-sweep 2.5s infinite linear",
          willChange: "transform",
        }}
      />
    </MagneticButton>
  );
}
