"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  saveTaxonomyLabelsAction,
  type TaxonomyLabelsActionState,
  type TaxonomyLabelsEditorPayload,
} from "@/app/admin/actions/taxonomy-labels";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminLocaleTabs,
  useAdminActiveLocale,
  type AdminLocaleTab,
} from "@/components/admin/shared/admin-locale-workspace";
import {
  AdminAlert,
  AdminIconButton,
  AdminPanel,
  AdminReadonlyField,
  AdminSectionTabs,
  AdminTextField,
} from "@/components/synarava-cms";
import type { TaxonomyKind } from "@/lib/catalog/taxonomy-value-kinds";

const SECTIONS = [
  { id: "category", label: "Category", detail: "Shopify SPT leaf labels", kind: "CATEGORY_LEAF" as const },
  { id: "product-type", label: "Product type", detail: "Shopify productType labels", kind: "PRODUCT_TYPE" as const },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function TaxonomyLabelsEditor({
  initial,
  locales,
}: {
  initial: TaxonomyLabelsEditorPayload;
  locales: AdminLocaleTab[];
}) {
  const [state, setState] = useState<TaxonomyLabelsActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const nonEn = locales.find((locale) => locale.code !== "en")?.code ?? locales[0]?.code ?? "en";
  const [activeLocale, selectLocale] = useAdminActiveLocale("taxonomy-labels", locales, nonEn);
  const [section, setSection] = useState<SectionId>("category");
  const [draft, setDraft] = useState(initial.labels);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#shared-taxonomy") {
        /* keep editor mounted; parent hash already selected this area */
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const activeKind: TaxonomyKind = SECTIONS.find((item) => item.id === section)?.kind ?? "CATEGORY_LEAF";
  const enValues = activeKind === "CATEGORY_LEAF" ? initial.categoryLeaves : initial.productTypes;

  const localeDraft = useMemo(
    () => draft[activeLocale]?.[activeKind] ?? {},
    [activeLocale, activeKind, draft],
  );

  function setLabel(enValue: string, label: string) {
    setDraft((prev) => {
      const next = { ...prev };
      const localeMap = { ...(next[activeLocale] ?? { CATEGORY_LEAF: {}, PRODUCT_TYPE: {} }) };
      localeMap[activeKind] = { ...localeMap[activeKind], [enValue]: label };
      next[activeLocale] = localeMap;
      return next;
    });
  }

  function save() {
    const updates: Array<{ kind: TaxonomyKind; enValue: string; locale: string; label: string }> = [];
    for (const [locale, byKind] of Object.entries(draft)) {
      if (locale === "en") continue;
      for (const kind of ["CATEGORY_LEAF", "PRODUCT_TYPE"] as TaxonomyKind[]) {
        const values = kind === "CATEGORY_LEAF" ? initial.categoryLeaves : initial.productTypes;
        for (const enValue of values) {
          updates.push({
            kind,
            enValue,
            locale,
            label: byKind?.[kind]?.[enValue] ?? "",
          });
        }
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("updates", JSON.stringify(updates));
      const result = await saveTaxonomyLabelsAction({}, formData);
      setState(result);
      if (result.success) pushToast({ message: result.success, tone: "success" });
      if (result.error) pushToast({ message: result.error, tone: "error" });
    });
  }

  const isEn = activeLocale === "en";

  return (
    <div id="shared-taxonomy" className="space-y-4">
      <AdminAlert message={state.error} />
      <AdminAlert message={state.success} tone="success" />
      <AdminPanel.Root>
        <AdminPanel.Header sticky stickyBand="locale" className="adm-panel__header--ruled">
          <AdminLocaleTabs
            embedded
            active={activeLocale}
            onSelect={selectLocale}
            locales={locales}
            trailing={
              <AdminIconButton
                type="button"
                label={isPending ? "Saving taxonomy" : "Save taxonomy"}
                tooltip={
                  isEn
                    ? "Switch to PT/RU to edit display labels."
                    : isPending
                      ? "Saving taxonomy…"
                      : "Save category and product-type display overlays for every locale."
                }
                disabled={isPending || isEn}
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
          <AdminSectionTabs
            embedded
            aria-label="Taxonomy kinds"
            active={section}
            onChange={(id) => setSection(id as SectionId)}
            items={SECTIONS.map((item) => ({ id: item.id, label: item.label, detail: item.detail }))}
          >
            <div className="adm-inset-x grid gap-4 py-5">
              <p className="text-sm text-adm-muted">
                Shopify keeps the English taxonomy identity. Category leaves have no Translations API —
                fill Synarava overlays here. Product type pulls Shopify `product_type` when present;
                otherwise edit the Synarava overlay.
              </p>
              {enValues.length === 0 ? (
                <p className="text-sm text-adm-muted">
                  No {section === "category" ? "category leaves" : "product types"} in the catalog yet.
                  Assign them on products (Shopify EN), then return here to translate.
                </p>
              ) : null}
              {enValues.map((enValue) => {
                const source = initial.sources[activeLocale]?.[activeKind]?.[enValue];
                if (isEn) {
                  return (
                    <AdminReadonlyField
                      key={enValue}
                      label={enValue}
                      value={enValue}
                      owner="Shopify"
                      help="English taxonomy identity from Shopify. Translate on PT/RU tabs."
                    />
                  );
                }
                return (
                  <AdminTextField
                    key={enValue}
                    label={enValue}
                    value={localeDraft[enValue] ?? ""}
                    onChange={(event) => setLabel(enValue, event.target.value)}
                    clearable
                    onClear={() => setLabel(enValue, "")}
                    owner={source === "SHOPIFY" ? "Shopify" : "Synarava"}
                    help={
                      source === "SHOPIFY"
                        ? "Pulled from Shopify product_type translation. Edit becomes a Synarava overlay until the next pull."
                        : "Synarava display overlay when Shopify has no translation for this value."
                    }
                  />
                );
              })}
            </div>
          </AdminSectionTabs>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </div>
  );
}
