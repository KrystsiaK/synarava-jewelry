"use client";

import { MagneticButton } from "./magnetic-button";

const BASE_CLASS =
  "group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden bg-couture-red px-8 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white";

interface PrimaryCtaButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function PrimaryCtaButton({ href, children, className }: PrimaryCtaButtonProps) {
  return (
    <MagneticButton href={href} className={`${BASE_CLASS}${className ? ` ${className}` : ""}`}>
      <span className="relative z-10">{children}</span>
      <svg
        className="relative z-10 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 6h10M7 2l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
