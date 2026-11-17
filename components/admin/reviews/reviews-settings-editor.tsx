"use client";

import Link from "next/link";
import { HardDriveUpload, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  saveProductReviewsSettingsAction,
  type AdminReviewsActionState,
} from "@/app/admin/actions/reviews";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminCheckboxField,
  AdminIconButton,
  AdminPanel,
} from "@/components/synarava-cms";
import {
  PRODUCT_REVIEWS_SETTINGS_FIELD_DEFS,
  type ProductReviewsSettings,
} from "@/lib/reviews/settings-fields";

export function ReviewsSettingsEditor({
  settings,
}: {
  settings: ProductReviewsSettings;
}) {
  const [state, setState] = useState<AdminReviewsActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveProductReviewsSettingsAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <form action={formAction} data-component="ReviewsSettingsEditor">
      <AdminAlert message={state.error} />
      <AdminPanel.Root>
        <AdminPanel.Header sticky className="adm-panel__header--ruled">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="adm-section-tag">Reviews — settings</p>
              <p className="mt-1 max-w-2xl text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                Moderation toggle for new submissions. Translatable section copy (EN/PT/RU) is edited
                under{" "}
                <Link href="/admin/settings#shared-reviews" className="underline">
                  Shared → Reviews
                </Link>
                — do not invent a second translation system here.
              </p>
            </div>
            <AdminIconButton
              type="submit"
              label={isPending ? "Saving review settings" : "Save review settings"}
              tooltip={isPending ? "Saving…" : "Save review moderation settings"}
              disabled={isPending}
            >
              {isPending ? (
                <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
              )}
            </AdminIconButton>
          </div>
        </AdminPanel.Header>
        <AdminPanel.Body>
          <div className="adm-inset-x grid gap-4 py-5">
            {PRODUCT_REVIEWS_SETTINGS_FIELD_DEFS.map((field) => (
              <AdminCheckboxField
                key={field.key}
                name={field.key}
                label={field.label}
                defaultChecked={settings[field.key]}
                value="true"
              >
                <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
                  {field.hint}
                </p>
              </AdminCheckboxField>
            ))}
          </div>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </form>
  );
}
