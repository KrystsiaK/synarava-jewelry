"use client";

import Link from "next/link";
import { motion } from "motion/react";

interface PrimaryCtaButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function PrimaryCtaButton({ href, children, className = "" }: PrimaryCtaButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex cursor-pointer items-center gap-3 bg-couture-red px-7 py-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white transition-colors duration-300 hover:bg-couture-red/90 ${className}`}
      >
        {children}
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M1 6h10M7 2l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </motion.div>
  );
}
