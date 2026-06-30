"use client";

export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="relative z-0">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "shiny-sweep 4s infinite linear",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
        }}
      >
        {children}
      </span>
    </span>
  );
}
