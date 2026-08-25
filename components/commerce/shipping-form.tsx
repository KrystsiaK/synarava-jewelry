"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";

import { submitShippingAction } from "@/app/checkout/actions";
import type { ShippingActionState, ShippingField } from "@/app/checkout/actions";
import { SubmitButton } from "./submit-button";
import { useTranslations } from "@/lib/i18n/context";
import { localeTag } from "@/lib/i18n/format";

/* Common countries ordered by likelihood for a European luxury brand */
const COUNTRY_CODES = [
  "LT", "LV", "EE", "PL", "DE", "FR", "GB", "NL", "BE", "AT", "CH",
  "SE", "NO", "DK", "FI", "CZ", "SK", "HU", "RO", "IT", "ES", "PT",
  "IE", "GR", "US", "CA", "AU", "JP", "SG", "AE",
] as const;

const inputClass =
  "storefront-field";

type ShippingFormProps = {
  defaultEmail?: string | null;
  defaultName?: string | null;
};

export function ShippingForm({ defaultEmail, defaultName }: ShippingFormProps) {
  const { locale, t } = useTranslations();
  const countryNames = useMemo(
    () => new Intl.DisplayNames([localeTag(locale)], { type: "region" }),
    [locale],
  );
  const [state, formAction] = useActionState<ShippingActionState, FormData>(
    submitShippingAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.formError && !state.fieldErrors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const errorFor = (field: ShippingField) => state.fieldErrors?.[field];
  const fieldA11y = (field: ShippingField) => ({
    "aria-describedby": errorFor(field) ? `${field}-error` : undefined,
    "aria-invalid": Boolean(errorFor(field)),
  });

  return (
    <form ref={formRef} action={formAction} className="checkout-form-surface grid gap-5 p-6 md:p-8" noValidate>
      {state.formError ? (
        <p role="alert" className="border border-couture-red/40 p-4 text-sm leading-6 text-couture-red">
          {state.formError}
        </p>
      ) : null}

      <label className="grid gap-2.5">
        <span className="storefront-field-label">{t("checkout.shipping.contactEmail")}</span>
        <input
          id="email"
          type="email"
          name="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder={t("checkout.shipping.email")}
          autoComplete="email"
          spellCheck={false}
          className={inputClass}
          {...fieldA11y("email")}
        />
        {errorFor("email") ? <span id="email-error" className="text-sm text-couture-red">{errorFor("email")}</span> : null}
      </label>

      <label className="grid gap-2.5">
        <span className="storefront-field-label">{t("checkout.shipping.recipient")}</span>
        <input
          id="name"
          type="text"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder={t("checkout.shipping.fullName")}
          autoComplete="name"
          className={inputClass}
          {...fieldA11y("name")}
        />
        {errorFor("name") ? <span id="name-error" className="text-sm text-couture-red">{errorFor("name")}</span> : null}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2.5">
          <span className="storefront-field-label">{t("checkout.shipping.address")}</span>
          <input id="line1" type="text" name="line1" required placeholder={t("checkout.shipping.address1")} autoComplete="address-line1" className={inputClass} {...fieldA11y("line1")} />
          {errorFor("line1") ? <span id="line1-error" className="text-sm text-couture-red">{errorFor("line1")}</span> : null}
        </label>
        <label className="grid gap-2.5">
          <span className="storefront-field-label">{t("checkout.shipping.apartment")}</span>
          <input type="text" name="line2" placeholder={t("checkout.shipping.address2")} autoComplete="address-line2" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2.5"><span className="storefront-field-label">{t("checkout.shipping.city")}</span><input id="city" type="text" name="city" required placeholder={t("checkout.shipping.city")} autoComplete="address-level2" className={inputClass} {...fieldA11y("city")} />{errorFor("city") ? <span id="city-error" className="text-sm text-couture-red">{errorFor("city")}</span> : null}</label>
        <label className="grid gap-2.5"><span className="storefront-field-label">{t("checkout.shipping.region")}</span><input type="text" name="region" placeholder={t("checkout.shipping.regionPlaceholder")} autoComplete="address-level1" className={inputClass} /></label>
        <label className="grid gap-2.5"><span className="storefront-field-label">{t("checkout.shipping.postalCode")}</span><input id="postalCode" type="text" name="postalCode" required placeholder={t("checkout.shipping.postalCode")} autoComplete="postal-code" className={inputClass} {...fieldA11y("postalCode")} />{errorFor("postalCode") ? <span id="postalCode-error" className="text-sm text-couture-red">{errorFor("postalCode")}</span> : null}</label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Country select — name kept as countryCode so server action needs no changes */}
        <label className="grid gap-2.5">
          <span className="storefront-field-label">{t("checkout.shipping.country")}</span>
          <select
            id="countryCode"
            name="countryCode"
            required
            defaultValue="LT"
            autoComplete="country"
            className={`${inputClass} cursor-pointer appearance-none`}
            {...fieldA11y("countryCode")}
          >
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {countryNames.of(code) ?? code}
              </option>
            ))}
          </select>
          {errorFor("countryCode") ? <span id="countryCode-error" className="text-sm text-couture-red">{errorFor("countryCode")}</span> : null}
        </label>

        <label className="grid gap-2.5">
          <span className="storefront-field-label">{t("checkout.shipping.notes")}</span>
          <textarea
            name="notes"
            rows={3}
            placeholder={t("checkout.shipping.notesPlaceholder")}
            autoComplete="off"
            className={inputClass}
          />
        </label>
      </div>

      <SubmitButton
        pendingLabel={t("checkout.shipping.processing")}
        className="mt-2 w-full"
      >
        {t("checkout.shipping.continue")}
      </SubmitButton>
    </form>
  );
}
