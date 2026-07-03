import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/ui";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "border border-couture-red bg-couture-red text-linen !text-linen hover:border-[#7f1424] hover:bg-[#7f1424]",
  secondary: "border border-foreground/30 text-foreground hover:border-foreground",
  ghost: "border-b border-foreground/30 px-0 py-0 text-foreground hover:border-foreground",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  children: ReactNode;
};

const baseClasses =
  "inline-flex items-center justify-center gap-3 px-8 py-4 text-center font-sans text-[0.76rem] font-semibold uppercase tracking-[0.18em] transition";

export function ArtifactButton({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ArtifactLink({ href, variant = "primary", className, children, ...props }: LinkProps) {
  return (
    <Link href={href} className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      {children}
    </Link>
  );
}
