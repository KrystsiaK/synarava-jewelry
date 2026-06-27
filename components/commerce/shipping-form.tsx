import { submitShippingAction } from "@/app/checkout/actions";

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
  "border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent";

type ShippingFormProps = {
  defaultEmail?: string | null;
  defaultName?: string | null;
};

export function ShippingForm({ defaultEmail, defaultName }: ShippingFormProps) {
  return (
    <form action={submitShippingAction} className="panel grid gap-5 p-6 md:p-8">
      <div className="grid gap-2">
        <span className="label-caps text-muted">Contact</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="Email"
          className={inputClass}
        />
      </div>

      <div className="grid gap-2">
        <span className="label-caps text-muted">Recipient</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder="Full name"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          type="text"
          name="line1"
          required
          placeholder="Address line 1"
          className={inputClass}
        />
        <input
          type="text"
          name="line2"
          placeholder="Address line 2 (optional)"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="text"
          name="city"
          required
          placeholder="City"
          className={inputClass}
        />
        <input
          type="text"
          name="region"
          placeholder="Region / State"
          className={inputClass}
        />
        <input
          type="text"
          name="postalCode"
          required
          placeholder="Postal code"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Country select — name kept as countryCode so server action needs no changes */}
        <div className="grid gap-2">
          <span className="label-caps text-muted">Country</span>
          <select
            name="countryCode"
            required
            defaultValue="LT"
            className={`${inputClass} appearance-none cursor-pointer`}
          >
            {COUNTRIES.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <span className="label-caps text-muted">Delivery notes</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Leave at door, gift message, etc."
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        className="mt-2 inline-flex w-full items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
      >
        Continue to payment
      </button>
    </form>
  );
}