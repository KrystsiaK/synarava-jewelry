"use client";

import { useFormStatus } from "react-dom";

import { artifactButtonClasses, PrimaryCtaButton } from "@/components/ui";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary";
};

export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  if (variant === "secondary") {
    return (
      <button
        type="submit"
        disabled={pending}
        className={artifactButtonClasses({ variant: "secondary", size: "md", className })}
      >
        {pending && pendingLabel ? pendingLabel : children}
      </button>
    );
  }

  return (
    <PrimaryCtaButton
      type="submit"
      disabled={pending}
      className={className}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </PrimaryCtaButton>
  );
}
