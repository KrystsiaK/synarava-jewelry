"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  adoptAnnouncementThresholdAction,
  saveAnnouncementBarAction,
} from "@/app/admin/actions/announcement-bar";
import {
  AdminLocaleTabs,
  useAdminActiveLocale,
  type AdminLocaleStatus,
  type AdminLocaleTab,
} from "@/components/admin/shared/admin-locale-workspace";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminButton,
  AdminCheckboxField,
  AdminIconButton,
  AdminPanel,
  AdminReadonlyField,
  AdminTextField,
} from "@/components/synarava-cms";
import {
  ANNOUNCEMENT_BAR_COPY_KEY,
  type AnnouncementBarSetting,
  type FreeShippingMoney,
} from "@/lib/content/announcement-bar-fields";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

function moneyLabel(money: FreeShippingMoney | null, locale: string): string {
  if (!money) return "—";
  return formatShopifyMoneyByLocale(money.amount, money.currencyCode, locale) || "—";
}

function thresholdConflict(setting: AnnouncementBarSetting): boolean {
  const local = setting.threshold;
  const remote = setting.shopifySnapshot?.freeShippingMinSubtotal ?? null;
  if (!remote) return false;
  if (!local) return true;
  return local.amount !== remote.amount || local.currencyCode !== remote.currencyCode;
}

export function AnnouncementBarEditor({
  initialSetting,
  copy,
  defaults,
  locales,
  ptStatus,
}: {
  initialSetting: AnnouncementBarSetting;
  copy: StorefrontCopy;
  defaults: StorefrontCopy;
  locales: AdminLocaleTab[];
  ptStatus?: AdminLocaleStatus;
}) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setting, setSetting] = useState(initialSetting);
  const [enabled, setEnabled] = useState(initialSetting.enabled);
  const [activeLocale, selectLocale] = useAdminActiveLocale(
    "announcement-bar",
    locales,
    locales[0]?.code ?? "en",
  );
  const [copyByLocale, setCopyByLocale] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const locale of locales) {
      next[locale.code] =
        copy[locale.code]?.[ANNOUNCEMENT_BAR_COPY_KEY]
        ?? defaults[locale.code]?.[ANNOUNCEMENT_BAR_COPY_KEY]
        ?? defaults.en?.[ANNOUNCEMENT_BAR_COPY_KEY]
        ?? "";
    }
    return next;
  });

  const conflict = thresholdConflict(setting);
  const placeholder =
    defaults[activeLocale]?.[ANNOUNCEMENT_BAR_COPY_KEY]
    ?? defaults.en?.[ANNOUNCEMENT_BAR_COPY_KEY]
    ?? "Free shipping in Portugal from {amount}";

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveAnnouncementBarAction({ enabled, copyByLocale });
      if (!result.ok) {
        setError(result.error ?? "Save failed");
        pushToast({ tone: "error", message: result.error ?? "Save failed" });
        return;
      }
      if (result.setting) setSetting(result.setting);
      pushToast({ tone: "success", message: result.message ?? "Saved" });
    });
  }

  function adoptLiveThreshold() {
    setError(null);
    startTransition(async () => {
      const result = await adoptAnnouncementThresholdAction();
      if (!result.ok) {
        setError(result.error ?? "Adopt threshold failed");
        pushToast({ tone: "error", message: result.error ?? "Adopt threshold failed" });
        return;
      }
      if (result.setting) setSetting(result.setting);
      pushToast({ tone: "success", message: result.message ?? "Adopted live threshold" });
    });
  }

  return (
    <AdminPanel.Root id="shared-announcement-bar">
      <AdminPanel.Header sticky stickyBand="locale" className="adm-panel__header--ruled">
        <AdminLocaleTabs
          embedded
          active={activeLocale}
          onSelect={selectLocale}
          locales={locales}
          ptStatus={ptStatus}
          trailing={
            <AdminIconButton
              type="button"
              label={isPending ? "Saving announcement bar" : "Save announcement bar"}
              tooltip={isPending ? "Saving…" : "Save on/off and banner text"}
              disabled={isPending}
              onClick={save}
            >
              {isPending ? (
                <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
              )}
            </AdminIconButton>
          }
        />
      </AdminPanel.Header>
      <AdminPanel.Body>
        <div className="adm-inset-x grid gap-5 py-5">
          <div>
            <p className="adm-section-tag mb-1">[ SYN-ADM // ANNOUNCEMENT ]</p>
            <h2 className="text-base font-medium">Announcement bar</h2>
            <p className="adm-page-subtitle mt-1">
              Free-shipping strip above the header. Threshold is Shopify-owned (Portugal delivery profile).
              Banner text uses {"{amount}"} — never hardcode the number.
            </p>
          </div>

          <AdminAlert message={error} />
          {conflict ? (
            <AdminAlert message="Free shipping threshold differs from Shopify. Adopt the live delivery-profile amount, or wait for the next catalog refresh." />
          ) : null}

          <AdminCheckboxField
            label="Show announcement bar"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          >
            <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
              When off, or when no adopted threshold exists, the storefront renders nothing.
            </p>
          </AdminCheckboxField>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminReadonlyField
              label="Threshold (Synarava)"
              value={moneyLabel(setting.threshold, activeLocale)}
              owner="Shopify"
              help="Working copy after human adopt. Storefront uses this amount."
            />
            <AdminReadonlyField
              label="Threshold (Shopify)"
              value={moneyLabel(setting.shopifySnapshot?.freeShippingMinSubtotal ?? null, activeLocale)}
              owner="Shopify"
              help="Last delivery-profile observation from catalog refresh."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AdminButton
              type="button"
              variant="secondary"
              disabled={isPending || !setting.shopifySnapshot?.freeShippingMinSubtotal}
              onClick={adoptLiveThreshold}
            >
              Adopt live threshold
            </AdminButton>
            <span className="text-sm text-[color:var(--adm-muted)]">
              {conflict ? "Conflict" : setting.shopifySnapshot ? "In sync" : "Not checked yet"}
            </span>
          </div>

          <AdminTextField
            label="Banner text"
            value={copyByLocale[activeLocale] ?? ""}
            placeholder={placeholder}
            onChange={(event) => {
              const value = event.target.value;
              setCopyByLocale((prev) => ({ ...prev, [activeLocale]: value }));
            }}
            owner="Synarava"
            help="Include {amount}. Synced to Shopify storefront_copy metaobject like other Shared copy."
          />
        </div>
      </AdminPanel.Body>
    </AdminPanel.Root>
  );
}
