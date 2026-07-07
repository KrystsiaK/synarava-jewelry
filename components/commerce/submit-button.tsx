"use client";

import { useFormStatus } from "react-dom";

import { artifactButtonClasses } from "@/components/ui";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={artifactButtonClasses({ className })}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
