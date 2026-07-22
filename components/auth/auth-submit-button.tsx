"use client";

import { useFormStatus } from "react-dom";

import { PrimaryCtaButton } from "@/components/ui/primary-cta-button";

type AuthSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function AuthSubmitButton({
  label,
  pendingLabel = "Working…",
  className,
  disabled = false,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <PrimaryCtaButton type="submit" className={className} disabled={isDisabled}>
      {pending ? pendingLabel : label}
    </PrimaryCtaButton>
  );
}
