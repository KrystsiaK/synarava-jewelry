"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitShippingAction } from "@/app/checkout/actions";
import type { ShippingActionState, ShippingField } from "@/app/checkout/actions";
import { SubmitButton } from "./submit-button";

/* Common countries ordered by likelihood for a European luxury brand */
const COUNTRIES: { code: string; name: string }[] = [
  { code: "LT", name: "Lithuania" },
  { code: "LV", name: "Latvia" },
  { code: "EE", name: "Estonia" },
  { code: "PL", name: "Poland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "SK", name: "Slovakia" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  { code: "GR", name: "Greece" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
];

const inputClass =
  "storefront-field";

type ShippingFormProps = {
  defaultEmail?: string | null;
  defaultName?: string | null;
};

export function ShippingForm({ defaultEmail, defaultName }: ShippingFormProps) {
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
        <span className="storefront-field-label">Contact email</span>
        <input
          id="email"
          type="email"
          name="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="Email"
          autoComplete="email"
          spellCheck={false}
          className={inputClass}
          {...fieldA11y("email")}
        />
        {errorFor("email") ? <span id="email-error" className="text-sm text-couture-red">{errorFor("email")}</span> : null}
      </label>

      <label className="grid gap-2.5">
        <span className="storefront-field-label">Recipient</span>
        <input
          id="name"
          type="text"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder="Full name"
          autoComplete="name"
          className={inputClass}
          {...fieldA11y("name")}
        />
        {errorFor("name") ? <span id="name-error" className="text-sm text-couture-red">{errorFor("name")}</span> : null}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Address</span>
          <input id="line1" type="text" name="line1" required placeholder="Address line 1" autoComplete="address-line1" className={inputClass} {...fieldA11y("line1")} />
          {errorFor("line1") ? <span id="line1-error" className="text-sm text-couture-red">{errorFor("line1")}</span> : null}
        </label>
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Apartment or suite</span>
          <input type="text" name="line2" placeholder="Address line 2 (optional)" autoComplete="address-line2" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2.5"><span className="storefront-field-label">City</span><input id="city" type="text" name="city" required placeholder="City" autoComplete="address-level2" className={inputClass} {...fieldA11y("city")} />{errorFor("city") ? <span id="city-error" className="text-sm text-couture-red">{errorFor("city")}</span> : null}</label>
        <label className="grid gap-2.5"><span className="storefront-field-label">Region</span><input type="text" name="region" placeholder="Region / State" autoComplete="address-level1" className={inputClass} /></label>
        <label className="grid gap-2.5"><span className="storefront-field-label">Postal code</span><input id="postalCode" type="text" name="postalCode" required placeholder="Postal code" autoComplete="postal-code" className={inputClass} {...fieldA11y("postalCode")} />{errorFor("postalCode") ? <span id="postalCode-error" className="text-sm text-couture-red">{errorFor("postalCode")}</span> : null}</label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Country select — name kept as countryCode so server action needs no changes */}
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Country</span>
          <select
            id="countryCode"
            name="countryCode"
            required
            defaultValue="LT"
            autoComplete="country"
            className={`${inputClass} cursor-pointer appearance-none`}
            {...fieldA11y("countryCode")}
          >
            {COUNTRIES.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {errorFor("countryCode") ? <span id="countryCode-error" className="text-sm text-couture-red">{errorFor("countryCode")}</span> : null}
        </label>

        <label className="grid gap-2.5">
          <span className="storefront-field-label">Delivery notes</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Leave at door, gift message, etc."
            autoComplete="off"
            className={inputClass}
          />
        </label>
      </div>

      <SubmitButton
        pendingLabel="Processing…"
        className="mt-2 w-full"
      >
        Continue to payment
      </SubmitButton>
    </form>
  );
}
