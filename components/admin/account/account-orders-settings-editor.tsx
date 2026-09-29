"use client";

import { useState, useTransition } from "react";

import {
  saveAccountOrdersSettingsAction,
  type AccountOrdersSettingsActionState,
} from "@/app/admin/actions/account-orders-settings";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminAlert, AdminCheckboxField, AdminPanel } from "@/components/synarava-cms";
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
    <form action={formAction} className="space-y-4">
      <AdminAlert message={state.error} />
      <AdminPanel.Root>
        <AdminPanel.Header className="adm-panel__header--ruled">
          <div className="adm-inset-x py-4">
            <p className="label-caps text-foreground/45">Orders — buyer actions</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/55">
              Toggles for the signed-in Orders tab. Status chip and button labels are edited in the
              copy sections below (обменка). Defaults keep Buy again and the headless return form off
              until post-purchase validation passes.
            </p>
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
                <p className="text-sm text-foreground/50">{field.hint}</p>
              </AdminCheckboxField>
            ))}
            <button
              type="submit"
              disabled={isPending}
              className="label-caps w-fit border border-stroke px-5 py-3 transition-colors hover:border-foreground/50 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save order action settings"}
            </button>
          </div>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </form>
  );
}
