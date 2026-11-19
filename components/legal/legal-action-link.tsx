"use client";

import Link from "next/link";

import { LEGAL_ACTION_PATHS, type LegalActionId } from "@/lib/content/legal-actions";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";

/** Legacy `action:` markdown links → ordinary locale-prefixed storefront paths. */
export function LegalActionLink({ actionId, children }: { actionId: LegalActionId; children?: React.ReactNode }) {
  const { locale } = useTranslations();
  return (
    <Link
      href={localePath(locale, LEGAL_ACTION_PATHS[actionId])}
      data-legal-action={actionId}
    >
      {children}
    </Link>
  );
}
