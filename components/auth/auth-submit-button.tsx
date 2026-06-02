"use client";

import { useFormStatus } from "react-dom";

import { ArtifactButton } from "@/components/ui/artifact-button";

type AuthSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
};

export function AuthSubmitButton({
  label,
  pendingLabel = "Working…",
  className,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <ArtifactButton type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : label}
    </ArtifactButton>
  );
}
