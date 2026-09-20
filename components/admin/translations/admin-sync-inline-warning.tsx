import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { ReconcileDifferenceView } from "@/lib/shopify/reconciliation-run";

function localeLabel(locale: string) {
  if (locale.toLowerCase().startsWith("pt")) return "Portuguese";
  if (locale.toLowerCase().startsWith("en")) return "English";
  return locale;
}

export function AdminSyncInlineWarning({
  differences,
  className = "",
}: {
  differences: ReconcileDifferenceView[];
  className?: string;
}) {
  if (differences.length === 0) return null;

  const entity = differences[0];
  const locales = Array.from(new Set(differences.map((difference) => localeLabel(difference.locale))));
  const href = `/admin/translations?entityType=${entity.rootEntityType}&entityId=${entity.rootEntityId}`;

  return (
    <div
      data-component="AdminSyncInlineWarning"
      className={`grid gap-2 p-3 text-xs ${className}`}
      style={{
        border: "1px solid rgba(255, 93, 93, 0.38)",
        background: "rgba(255, 93, 93, 0.08)",
        color: "var(--adm-danger)",
        borderRadius: "8px",
      }}
    >
      <Link href={href} className="flex items-start gap-2 font-bold uppercase tracking-[0.08em]">
        <AlertTriangle size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
        <span>
          {differences.length} field{differences.length === 1 ? "" : "s"} differ from Shopify ({locales.join(", ")})
        </span>
      </Link>
    </div>
  );
}
