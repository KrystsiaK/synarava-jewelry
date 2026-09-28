"use client";

import type { ReactNode } from "react";

import { LabelText, labelHelp } from "@/components/admin/shared/field-label";

export type AdminFieldOwner = "Shopify" | "Synarava" | "Shopify push";

/** Label with the info mark beside the name and an ownership badge on the right. */
export function OwnershipLabel({
  children,
  owner,
  help,
  required,
}: {
  children: ReactNode;
  owner: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
}) {
  return (
    <span data-component="OwnershipLabel" className="adm-label adm-label--owner min-h-6">
      <span className="adm-label__lead">
        <LabelText>{children}</LabelText>
        {required ? <span className="adm-label__required">*</span> : null}
        {labelHelp(help)}
      </span>
      <span className={owner === "Shopify" ? "adm-label__owner text-[var(--adm-accent)]" : "adm-label__owner text-[var(--adm-subtle)]"}>
        {owner}
      </span>
    </span>
  );
}
