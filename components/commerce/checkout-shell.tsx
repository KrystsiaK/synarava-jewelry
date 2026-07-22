import type { ReactNode } from "react";

type CheckoutShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  step: "shipping" | "payment" | "confirmed" | "error";
  children: ReactNode;
  aside?: ReactNode;
};

const steps: { key: CheckoutShellProps["step"]; label: string }[] = [
  { key: "shipping", label: "Acquisition Details" },
  { key: "payment", label: "Secure Acquisition" },
  { key: "confirmed", label: "Acquisition Confirmed" },
];

export function CheckoutShell({
  eyebrow,
  title,
  description,
  step,
  children,
  aside,
}: CheckoutShellProps) {
  return (
    <main className="checkout-experience artifact-shell min-h-screen pt-24">
      <div className="site-shell grid gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.42fr)] lg:gap-16">
        <section className="space-y-8">
          <header className="space-y-4">
            <p className="label-caps text-accent">{eyebrow}</p>
            <h1 className="max-w-3xl text-balance font-serif text-[clamp(3rem,6vw,5.4rem)] leading-[0.92] tracking-[-0.035em]">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-foreground/70">{description}</p>
          </header>

          <div className="flex items-center gap-2 border-y border-white/10 py-4" aria-label="Checkout progress">
            {steps.map((entry) => {
              const active = entry.key === step;
              const done =
                (step === "payment" && entry.key === "shipping") ||
                (step === "confirmed" && (entry.key === "shipping" || entry.key === "payment"));

              return (
                <span
                  key={entry.key}
                  className={`inline-flex min-h-9 items-center border-b border-transparent px-2 text-[0.66rem] uppercase tracking-[0.14em] ${
                    active
                      ? "border-foreground text-foreground"
                      : done
                        ? "border-[color:rgba(166,25,46,0.3)] text-accent"
                        : "border-stroke text-foreground/50"
                  }`}
                >
                  {entry.label}
                </span>
              );
            })}
          </div>

          {children}
        </section>

        {aside ? <div className="lg:sticky lg:top-32 lg:h-fit">{aside}</div> : null}
      </div>
    </main>
  );
}
