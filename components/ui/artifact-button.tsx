import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/ui";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-[#7f1424] bg-[#7f1424] text-[#fff2f3] !text-[#fff2f3] hover:border-[#68111d] hover:bg-[#68111d]",
  secondary:
    "border border-foreground/28 bg-transparent text-foreground hover:border-couture-red hover:text-couture-red",
  ghost:
    "border-b border-foreground/30 px-0 py-0 text-foreground/72 hover:border-couture-red hover:text-couture-red",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-10 px-4 py-2 text-[0.68rem]",
  md: "min-h-12 px-6 py-3 text-[0.72rem]",
  lg: "min-h-14 px-8 py-4 text-[0.76rem]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  showArrow?: boolean;
  children: ReactNode;
};

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  showArrow?: boolean;
  children: ReactNode;
};

const baseClasses =
  "group inline-flex cursor-pointer items-center justify-center gap-3 text-center font-sans font-semibold uppercase tracking-[0.18em] transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red disabled:cursor-not-allowed disabled:opacity-55";

export function artifactButtonClasses({
  variant = "primary",
  size = "lg",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(baseClasses, sizeClasses[size], variantClasses[variant], className);
}

function ButtonContent({ children, showArrow }: { children: ReactNode; showArrow?: boolean }) {
  return (
    <>
      <span className="relative z-10">{children}</span>
      {showArrow ? (
        <ArrowRight
          className="relative z-10 size-3.5 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
          strokeWidth={1.8}
        />
      ) : null}
    </>
  );
}

export function ArtifactButton({
  variant = "primary",
  size = "lg",
  showArrow,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={artifactButtonClasses({ variant, size, className })} {...props}>
      <ButtonContent showArrow={showArrow}>{children}</ButtonContent>
    </button>
  );
}

export function ArtifactLink({
  href,
  variant = "primary",
  size = "lg",
  showArrow,
  className,
  children,
  ...props
}: LinkProps) {
  return (
    <Link href={href} className={artifactButtonClasses({ variant, size, className })} {...props}>
      <ButtonContent showArrow={showArrow}>{children}</ButtonContent>
    </Link>
  );
}
