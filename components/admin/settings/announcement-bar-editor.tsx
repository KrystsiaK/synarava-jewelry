"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { saveAnnouncementBarAction } from "@/app/admin/actions/announcement-bar";
import {
  AdminLocaleTabs,
  useAdminActiveLocale,
  type AdminLocaleStatus,
  type AdminLocaleTab,
} from "@/components/admin/shared/admin-locale-workspace";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { ShopThresholdConflictWorkspace } from "@/components/admin/settings/shop-conflict-adapter";
import {
  AdminAlert,
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
import {
  announcementThresholdHonestyStatus,
  formatObservationSource,
  shopifyThresholdFromSetting,
} from "@/lib/content/announcement-bar-threshold-status";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

function moneyLabel(money: FreeShippingMoney | null, locale: string): string {
  if (!money) return "—";
  return formatShopifyMoneyByLocale(money.amount, money.currencyCode, locale) || "—";
}

export function AnnouncementBarEditor({
  initialSetting,
  copy,
  defaults,
  locales,
  ptStatus,
  thresholdConflictCount = 0,
}: {
  initialSetting: AnnouncementBarSetting;
  copy: StorefrontCopy;
  defaults: StorefrontCopy;
  locales: AdminLocaleTab[];
  ptStatus?: AdminLocaleStatus;
  /** SyncResult leaf count for shop.freeShippingMinSubtotal (skipRefresh). */
  thresholdConflictCount?: number;
}) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setting, setSetting] = useState(initialSetting);
  const [enabled, setEnabled] = useState(initialSetting.enabled);
  const [conflictCount, setConflictCount] = useState(thresholdConflictCount);
  const [resolverOpen, setResolverOpen] = useState(false);
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

  const placeholder =
    defaults[activeLocale]?.[ANNOUNCEMENT_BAR_COPY_KEY]
    ?? defaults.en?.[ANNOUNCEMENT_BAR_COPY_KEY]
    ?? "Free shipping in Portugal from {amount}";

  const shopifyThreshold = shopifyThresholdFromSetting(setting);
  const shopifyLabel = moneyLabel(shopifyThreshold, activeLocale);
  const localLabel = moneyLabel(setting.threshold, activeLocale);
  const sourceLabel = formatObservationSource(setting.shopifyObservationSource);
  const honesty = announcementThresholdHonestyStatus({
    setting,
    conflictCount,
  });

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
              Banner text uses {"{amount}"} — never hardcode the number. Resolve threshold conflicts in ConflictResolver.
            </p>
          </div>

          <AdminAlert message={error} />

          <AdminCheckboxField
            label="Show announcement bar"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          >
            <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
              When off, or when no working threshold exists, the storefront renders nothing.
            </p>
          </AdminCheckboxField>

          <div className="grid gap-3" data-testid="announcement-threshold-honesty">
            <AdminReadonlyField
              label="Shopify threshold"
              owner="Shopify"
              help="Last amount observed from Shopify delivery profiles (read_shipping)."
              value={shopifyThreshold ? shopifyLabel : null}
            />
            <AdminReadonlyField
              label="Local working threshold"
              owner="Synarava"
              help="Adopted only via ConflictResolver. Storefront banner uses this value."
              value={setting.threshold ? localLabel : null}
            />
            {sourceLabel ? (
              <p className="text-sm" style={{ color: "var(--adm-muted)" }} data-testid="announcement-threshold-source">
                Rate: {sourceLabel}
              </p>
            ) : null}
            {setting.shopifyObservationWarning ? (
              <AdminAlert message={setting.shopifyObservationWarning} />
            ) : null}
            {honesty.kind === "reason" ? (
              <div data-testid="announcement-threshold-status">
                <AdminAlert message={honesty.message} />
                {conflictCount > 0 ? (
                  <p className="mt-2 text-sm" style={{ color: "var(--adm-muted)" }}>
                    Last observed amount also differs from the local working threshold.{" "}
                    <button
                      type="button"
                      className="underline"
                      style={{ color: "var(--adm-text)" }}
                      onClick={() => setResolverOpen(true)}
                    >
                      Resolve in ConflictResolver
                    </button>
                  </p>
                ) : null}
              </div>
            ) : honesty.kind === "differs" ? (
              <p className="text-sm" style={{ color: "var(--adm-muted)" }} data-testid="announcement-threshold-status">
                Threshold differs from Shopify.{" "}
                <button
                  type="button"
                  className="underline"
                  style={{ color: "var(--adm-text)" }}
                  onClick={() => setResolverOpen(true)}
                >
                  Resolve in ConflictResolver
                </button>
              </p>
            ) : honesty.kind === "matches" ? (
              <p className="text-sm" style={{ color: "var(--adm-muted)" }} data-testid="announcement-threshold-status">
                Threshold matches Shopify.
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--adm-muted)" }} data-testid="announcement-threshold-status">
                Run a catalog update from Shopify to observe the live delivery-profile amount.
              </p>
            )}
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

      <ShopThresholdConflictWorkspace
        open={resolverOpen}
        onClose={() => setResolverOpen(false)}
        conflictLeafCount={conflictCount}
        onToast={(message, tone) => pushToast({ tone, message })}
        onApplied={() => setConflictCount(0)}
      />
    </AdminPanel.Root>
  );
}
