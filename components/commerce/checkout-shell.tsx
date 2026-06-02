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
    <main className="artifact-shell min-h-screen pt-28">
      <div className="site-shell grid gap-8 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.7fr)]">
        <section className="space-y-8">
          <header className="space-y-4">
            <p className="label-caps text-accent">{eyebrow}</p>
            <h1 className="max-w-3xl font-serif text-[3.2rem] leading-[0.94] md:text-[4.6rem]">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-foreground/70">{description}</p>
          </header>

          <div className="flex flex-wrap gap-3 border-b border-stroke pb-5">
            {steps.map((entry) => {
              const active = entry.key === step;
              const done =
                (step === "payment" && entry.key === "shipping") ||
                (step === "confirmed" && (entry.key === "shipping" || entry.key === "payment"));

              return (
                <span
                  key={entry.key}
                  className={`border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
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

        {aside ? <div>{aside}</div> : null}
      </div>
    </main>
  );
}
