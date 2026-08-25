import type { ReactNode } from "react";
import Link from "next/link";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  asideTitle: string;
  asideBody: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  asideTitle,
  asideBody,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="auth-experience artifact-shell min-h-[100svh] pt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="auth-art-direction absolute inset-0" />
      </div>

      <div className="site-shell relative z-10 grid min-h-[calc(100svh-6rem)] items-center gap-10 py-8 md:py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.58fr)] lg:gap-16">
        <section className="max-w-3xl self-center">
          <p className="label-caps text-accent">{eyebrow}</p>
          <h1 className="mt-5 max-w-[12ch] text-balance font-serif text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.035em]">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-foreground/72 md:text-lg md:leading-8">
            {description}
          </p>

          <div className="mt-8 max-w-lg border-t border-stroke pt-5">
            <p className="font-serif text-xl italic text-foreground/90">{asideTitle}</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-foreground/62">{asideBody}</p>
          </div>

          {footer ? <div className="mt-6 text-sm text-foreground/62">{footer}</div> : null}
        </section>

        <section className="auth-form-surface self-center p-6 sm:p-8 md:p-10">
          {children}
          <div className="mt-7 border-t border-stroke pt-5 text-sm text-foreground/62">
            <Link href="/" className="transition-colors hover:text-accent">
              Back to storefront
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
