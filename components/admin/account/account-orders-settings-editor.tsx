"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  saveAccountOrdersSettingsAction,
  type AccountOrdersSettingsActionState,
} from "@/app/admin/actions/account-orders-settings";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminCheckboxField,
  AdminIconButton,
  AdminPanel,
} from "@/components/synarava-cms";
import {
  ACCOUNT_ORDERS_SETTINGS_FIELD_DEFS,
  type AccountOrdersSettings,
} from "@/lib/content/account-orders-settings-fields";

export function AccountOrdersSettingsEditor({
  settings,
}: {
  settings: AccountOrdersSettings;
}) {
  const [state, setState] = useState<AccountOrdersSettingsActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveAccountOrdersSettingsAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <form action={formAction}>
      <AdminAlert message={state.error} />
      <AdminPanel.Root>
        <AdminPanel.Header sticky className="adm-panel__header--ruled">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="adm-section-tag">Orders — buyer actions</p>
              <p className="mt-1 max-w-2xl text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                Toggles for the signed-in Orders tab. Status chip and button labels are edited in the
                copy sections below. Defaults keep Buy again and the headless return form off until
                post-purchase validation passes.
              </p>
            </div>
            <AdminIconButton
              type="submit"
              label={isPending ? "Saving order action settings" : "Save order action settings"}
              tooltip={
                isPending
                  ? "Saving order action settings…"
                  : "Save Orders tab buyer-action toggles."
              }
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
            {ACCOUNT_ORDERS_SETTINGS_FIELD_DEFS.map((field) => (
              <AdminCheckboxField
                key={field.key}
                name={field.key}
                label={field.label}
                defaultChecked={settings[field.key]}
                value="true"
              >
                <p className="text-sm" style={{ color: "var(--adm-muted)" }}>{field.hint}</p>
              </AdminCheckboxField>
            ))}
          </div>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </form>
  );
}
