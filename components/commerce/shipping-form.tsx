import { submitShippingAction } from "@/app/checkout/actions";
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
  return (
    <form action={submitShippingAction} className="checkout-form-surface grid gap-5 p-6 md:p-8">
      <label className="grid gap-2.5">
        <span className="storefront-field-label">Contact email</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="Email"
          autoComplete="email"
          className={inputClass}
        />
      </label>

      <label className="grid gap-2.5">
        <span className="storefront-field-label">Recipient</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder="Full name"
          autoComplete="name"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Address</span>
          <input type="text" name="line1" required placeholder="Address line 1" autoComplete="address-line1" className={inputClass} />
        </label>
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Apartment or suite</span>
          <input type="text" name="line2" placeholder="Address line 2 (optional)" autoComplete="address-line2" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2.5"><span className="storefront-field-label">City</span><input type="text" name="city" required placeholder="City" autoComplete="address-level2" className={inputClass} /></label>
        <label className="grid gap-2.5"><span className="storefront-field-label">Region</span><input type="text" name="region" placeholder="Region / State" autoComplete="address-level1" className={inputClass} /></label>
        <label className="grid gap-2.5"><span className="storefront-field-label">Postal code</span><input type="text" name="postalCode" required placeholder="Postal code" autoComplete="postal-code" className={inputClass} /></label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Country select — name kept as countryCode so server action needs no changes */}
        <label className="grid gap-2.5">
          <span className="storefront-field-label">Country</span>
          <select
            name="countryCode"
            required
            defaultValue="LT"
            autoComplete="country"
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            {COUNTRIES.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2.5">
          <span className="storefront-field-label">Delivery notes</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Leave at door, gift message, etc."
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
