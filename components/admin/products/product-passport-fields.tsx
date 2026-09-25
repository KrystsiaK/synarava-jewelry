"use client";

import {
  AdminCheckboxField,
  AdminCollapsiblePanel,
  AdminHelp,
  AdminLongTextField,
  AdminTextField,
} from "@/components/synarava-cms";
import { PRODUCT_CHARACTERISTICS, PRODUCT_CHARACTERISTIC_GROUPS } from "@/lib/products/characteristics";

type CharacteristicDraft = {
  value: string | boolean;
  certificateUrl: string;
};

function groupHasValue(
  group: string,
  characteristics: Record<string, CharacteristicDraft>,
): boolean {
  return PRODUCT_CHARACTERISTICS.some((definition) => {
    if (definition.group !== group) return false;
    const current = characteristics[definition.key];
    if (!current) return false;
    if (typeof current.value === "boolean") return current.value || Boolean(current.certificateUrl.trim());
    return Boolean(String(current.value).trim()) || Boolean(current.certificateUrl.trim());
  });
}

/**
 * Editable product passport. Values Save locally and Push to Shopify as
 * `synarava.*` metafields. Groups with data open by default; empty groups stay
 * collapsed so Pet/Maker/Age do not dominate jewelry or craft products.
 */
export function ProductPassportFields({
  characteristics,
}: {
  characteristics: Record<string, CharacteristicDraft>;
}) {
  return (
    <section
      data-component="ProductPassportFields"
      className="grid gap-4 border border-[var(--adm-border)] p-4"
    >
      <div>
        <p className="adm-label-row">
          <span className="adm-label">Product parameters</span>
          <AdminHelp>
            Fill material, color, size, care, and other specs here. Save, then Push to Shopify —
            Synarava mirrors these as product metafields. Pull brings Shopify values back into empty
            fields. Category / vendor / type stay in the form above; Product page sections stay under
            Product page.
          </AdminHelp>
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--adm-muted)]">
          Open a group to edit. Groups that already have values open automatically; unused groups
          (pet, maker, …) stay closed until you need them.
        </p>
      </div>

      {PRODUCT_CHARACTERISTIC_GROUPS.map((group) => {
        const openByDefault = groupHasValue(group, characteristics);
        return (
          <AdminCollapsiblePanel key={group} title={group} defaultOpen={openByDefault}>
            <fieldset className="min-w-0">
              <legend className="sr-only">{group}</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {PRODUCT_CHARACTERISTICS.filter((item) => item.group === group).map((definition) => {
                  const current = characteristics[definition.key] ?? {
                    value: definition.type === "BOOLEAN" ? false : "",
                    certificateUrl: "",
                  };
                  const name = `characteristic_${definition.key}`;
                  if (definition.type === "BOOLEAN") {
                    return (
                      <AdminCheckboxField
                        key={definition.key}
                        name={name}
                        label={definition.label}
                        defaultChecked={Boolean(current.value)}
                      >
                        {"certificate" in definition ? (
                          <AdminTextField
                            name={`${name}_certificate`}
                            defaultValue={current.certificateUrl}
                            placeholder="Certificate URL"
                            type="url"
                          />
                        ) : null}
                      </AdminCheckboxField>
                    );
                  }
                  if ("multiline" in definition && definition.multiline) {
                    return (
                      <AdminLongTextField
                        key={definition.key}
                        name={name}
                        label={definition.label}
                        defaultValue={String(current.value)}
                        rows={3}
                        className="col-span-full"
                      />
                    );
                  }
                  if ("unit" in definition) {
                    return (
                      <AdminTextField
                        key={definition.key}
                        label={definition.label}
                        name={name}
                        defaultValue={String(current.value)}
                        type={definition.type === "NUMBER" ? "number" : "text"}
                        step={definition.type === "NUMBER" ? "0.01" : undefined}
                        endAdornment={definition.unit}
                      />
                    );
                  }
                  return (
                    <AdminTextField
                      key={definition.key}
                      label={definition.label}
                      name={name}
                      defaultValue={String(current.value)}
                      type="text"
                    />
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
