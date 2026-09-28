import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui";

export type AdminAlertTone = "error" | "success";

export type AdminAlertProps = {
  /** Empty or missing copy renders nothing, so the slot can stay in the tree. */
  message?: ReactNode;
  tone?: AdminAlertTone;
  className?: string;
};

const TONE_CLASS = {
  error: "adm-alert--error",
  success: "adm-alert--success",
} as const;

/**
 * Form-level notice. Field validation stays in the absolute `.adm-field-error`
 * band — this banner is for save, load, and action failures above the form.
 *
 * Chrome is a transparent wash plus `--adm-danger-ink`, so the sentence stays
 * red and readable in both admin themes. Do not reuse `AuthMessage` here:
 * that login banner hardcodes pale pink meant for a dark page.
 */
export function AdminAlert({ message, tone = "error", className }: AdminAlertProps) {
  if (message == null || message === "") return null;

  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      data-component="AdminAlert"
      role={tone === "error" ? "alert" : "status"}
      className={cn("adm-alert", TONE_CLASS[tone], className)}
    >
      <Icon aria-hidden="true" className="adm-alert__mark" strokeWidth={1.75} />
      <p className="adm-alert__text">{message}</p>
    </div>
  );
}
