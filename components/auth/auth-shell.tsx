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
    <main className="artifact-shell min-h-screen pt-28">
      <div className="site-shell grid gap-8 py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,0.65fr)]">
        <section className="panel overflow-hidden">
          <div className="grid gap-10 p-8 md:p-12">
            <div className="space-y-4">
              <p className="label-caps text-accent">{eyebrow}</p>
              <h1 className="max-w-xl font-serif text-[3.4rem] leading-[0.94] md:text-[4.5rem]">
                {title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-foreground/70">{description}</p>
            </div>

            <div className="grid gap-8 border-t border-stroke pt-8 md:grid-cols-2">
              <div>
                <p className="label-caps text-muted">Access design</p>
                <p className="mt-3 text-base leading-7 text-foreground/72">
                  Internal auth screens follow the same editorial system as the storefront: serif
                  hierarchy, mono labels, and restrained panels.
                </p>
              </div>
              <div>
                <p className="label-caps text-muted">{asideTitle}</p>
                <p className="mt-3 text-base leading-7 text-foreground/72">{asideBody}</p>
              </div>
            </div>

            {footer ? (
              <div className="border-t border-stroke pt-6 text-sm text-foreground/60">{footer}</div>
            ) : null}
          </div>
        </section>

        <section className="panel p-8 md:p-10">
          {children}
          <div className="mt-8 border-t border-stroke pt-6 text-sm text-foreground/60">
            <Link href="/" className="transition-colors hover:text-accent">
              Back to storefront
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
