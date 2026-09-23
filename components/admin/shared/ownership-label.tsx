import type { ReactNode } from "react";

export type AdminFieldOwner = "Shopify" | "Synarava" | "Shopify push";

/** Label with optional help icon beside the name and an ownership badge on the right. */
export function OwnershipLabel({
  children,
  owner,
  help,
}: {
  children: ReactNode;
  owner: AdminFieldOwner;
  help?: ReactNode;
}) {
  return (
    <span data-component="OwnershipLabel" className="adm-label flex min-h-6 items-center justify-between gap-2">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span>{children}</span>
        {help}
      </span>
      <span className={owner === "Shopify" ? "text-[var(--adm-accent)]" : "text-[var(--adm-subtle)]"}>
        {owner}
      </span>
    </span>
  );
}
