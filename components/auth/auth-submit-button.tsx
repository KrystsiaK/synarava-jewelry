"use client";

import { useFormStatus } from "react-dom";

import { ArtifactButton } from "@/components/ui/artifact-button";

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
    <ArtifactButton type="submit" className={className} disabled={isDisabled}>
      {pending ? pendingLabel : label}
    </ArtifactButton>
  );
}
