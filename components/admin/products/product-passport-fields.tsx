"use client";

import {
  AdminCheckboxField,
  AdminCollapsiblePanel,
  AdminHelp,
  AdminLongTextField,
  AdminReadonlyField,
  AdminTextField,
} from "@/components/synarava-cms";
import { SOURCE_LOCALE } from "@/components/admin/products/product-editor-scope";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { Locale } from "@/lib/i18n/locales";
import {
  PRODUCT_CHARACTERISTICS,
  PRODUCT_CHARACTERISTIC_GROUPS,
  characteristicFormKey,
  characteristicGroupLabel,
  characteristicLabel,
  characteristicUnit,
} from "@/lib/products/characteristics";

type CharacteristicDraft = {
  value: string | boolean;
  certificateUrl: string;
};

function groupHasValue(
  group: string,
  characteristics: Record<string, CharacteristicDraft>,
  textOverlay: Record<string, string>,
  showOverlay: boolean,
): boolean {
  return PRODUCT_CHARACTERISTICS.some((definition) => {
    if (definition.group !== group) return false;
    if (showOverlay && definition.type === "TEXT") {
      return Boolean(textOverlay[definition.key]?.trim())
        || Boolean(String(characteristics[definition.key]?.value ?? "").trim());
    }
    const current = characteristics[definition.key];
    if (!current) return false;
    if (typeof current.value === "boolean") return current.value || Boolean(current.certificateUrl.trim());
    return Boolean(String(current.value).trim()) || Boolean(current.certificateUrl.trim());
  });
}

/**
 * Editable product passport.
 * EN named fields (`characteristic_*`) always stay in the DOM (visible or aria-hidden)
 * so locale switches and scoped saves keep ProductCharacteristic values.
 * PT/RU TEXT overlays are controlled + submitted via HiddenPassportTextOverlayFields.
 */
export function ProductPassportFields({
  characteristics,
  activeLocale = SOURCE_LOCALE,
  textOverlay = {},
  onTextOverlayChange,
}: {
  characteristics: Record<string, CharacteristicDraft>;
  activeLocale?: string;
  textOverlay?: Record<string, string>;
  onTextOverlayChange?: (key: string, value: string) => void;
}) {
  const locale = (activeLocale === "pt" || activeLocale === "ru" ? activeLocale : "en") as Locale;
  const isSource = activeLocale === SOURCE_LOCALE;
  const showOverlay = !isSource;

  return (
    <section
      data-component="ProductPassportFields"
      className="grid gap-4 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Product parameters</span>
          <AdminHelp>
            Jewelry core specs (material, size, care, compliance). English Save + Push mirrors
            synarava metafields. Other languages translate TEXT values only (blank → English on the
            site). Numbers and yes/no stay shared.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
          {showOverlay
            ? "Translate text fields for this language. Numbers and compliance flags are edited in English."
            : "Open a group to edit. Groups that already have values open automatically."}
        </p>
      </div>

      {PRODUCT_CHARACTERISTIC_GROUPS.map((group) => {
        const openByDefault = groupHasValue(group, characteristics, textOverlay, showOverlay);
        const groupTitle = characteristicGroupLabel(group, locale);
        return (
          <AdminCollapsiblePanel key={group} title={groupTitle} defaultOpen={openByDefault}>
            <fieldset className="min-w-0">
              <legend className="sr-only">{groupTitle}</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {PRODUCT_CHARACTERISTICS.filter((item) => item.group === group).map((definition) => {
                  const current = characteristics[definition.key] ?? {
                    value: definition.type === "BOOLEAN" ? false : "",
                    certificateUrl: "",
                  };
                  const enName = characteristicFormKey(definition.key);
                  const enLabel = characteristicLabel(definition.key, definition.label, "en");
                  const label = characteristicLabel(definition.key, definition.label, locale);
                  const unit = "unit" in definition
                    ? characteristicUnit(definition.unit, locale)
                    : "";
                  const enUnit = "unit" in definition
                    ? characteristicUnit(definition.unit, "en")
                    : "";

                  if (definition.type === "BOOLEAN") {
                    return (
                      <div key={definition.key} className={showOverlay ? "contents" : undefined}>
                        <div hidden={showOverlay}>
                          <AdminCheckboxField
                            name={enName}
                            label={enLabel}
                            defaultChecked={Boolean(current.value)}
                          >
                            {"certificate" in definition ? (
                              <AdminTextField
                                name={`${enName}_certificate`}
                                defaultValue={current.certificateUrl}
                                placeholder="Certificate URL"
                                type="url"
                              />
                            ) : null}
                          </AdminCheckboxField>
                        </div>
                        {showOverlay ? (
                          <AdminReadonlyField
                            label={label}
                            value={current.value ? "Yes" : "No"}
                          />
                        ) : null}
                      </div>
                    );
                  }

                  if (definition.type === "NUMBER") {
                    return (
                      <div key={definition.key} className={showOverlay ? "contents" : undefined}>
                        <div hidden={showOverlay}>
                          <AdminTextField
                            label={enLabel}
                            name={enName}
                            defaultValue={String(current.value)}
                            type="number"
                            step="0.01"
                            endAdornment={enUnit || undefined}
                          />
                        </div>
                        {showOverlay ? (
                          <AdminReadonlyField
                            label={label}
                            value={(() => {
                              const display = String(current.value).trim();
                              return display ? `${display}${unit ? ` ${unit}` : ""}` : "—";
                            })()}
                          />
                        ) : null}
                      </div>
                    );
                  }

                  // TEXT — EN field always mounted; overlay UI when translating
                  const overlayValue = textOverlay[definition.key] ?? "";
                  return (
                    <div key={definition.key} className={showOverlay ? "contents" : undefined}>
                      <div hidden={showOverlay}>
                        {"multiline" in definition && definition.multiline ? (
                          <AdminLongTextField
                            name={enName}
                            label={enLabel}
                            defaultValue={String(current.value)}
                            rows={3}
                            className="col-span-full"
                          />
                        ) : (
                          <AdminTextField
                            label={enLabel}
                            name={enName}
                            defaultValue={String(current.value)}
                            type="text"
                          />
                        )}
                      </div>
                      {showOverlay ? (
                        "multiline" in definition && definition.multiline ? (
                          <AdminLongTextField
                            label={label}
                            value={overlayValue}
                            onChange={(value) => onTextOverlayChange?.(definition.key, value)}
                            rows={3}
                            className="col-span-full"
                            placeholder={String(current.value) || undefined}
                          />
                        ) : (
                          <AdminTextField
                            label={label}
                            value={overlayValue}
                            onChange={(event) => onTextOverlayChange?.(definition.key, event.target.value)}
                            type="text"
                            placeholder={String(current.value) || undefined}
                          />
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </AdminCollapsiblePanel>
        );
      })}
    </section>
  );
}

/** Locale TEXT overlays for every non-EN language (mirrors HiddenDetailsLocaleFields). */
export function HiddenPassportTextOverlayFields({
  overlaysByLocale,
}: {
  overlaysByLocale: Record<string, Record<string, string>>;
}) {
  return (
    <div hidden data-component="HiddenPassportTextOverlayFields">
      {Object.entries(overlaysByLocale).flatMap(([locale, overlay]) => {
        if (locale === SOURCE_LOCALE) return [];
        return PRODUCT_CHARACTERISTICS.filter((item) => item.type === "TEXT").map((definition) => {
          const name = adminLocaleFieldName(locale, characteristicFormKey(definition.key), SOURCE_LOCALE);
          return (
            <input
              key={name}
              type="hidden"
              name={name}
              value={overlay[definition.key] ?? ""}
              readOnly
            />
          );
        });
      })}
    </div>
  );
}
