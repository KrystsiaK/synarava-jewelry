import { submitShippingAction } from "@/app/checkout/actions";

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
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
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
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          type="text"
          name="line1"
          required
          placeholder="Address line 1"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
        <input
          type="text"
          name="line2"
          placeholder="Address line 2"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="text"
          name="city"
          required
          placeholder="City"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
        <input
          type="text"
          name="region"
          placeholder="Region"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
        <input
          type="text"
          name="postalCode"
          required
          placeholder="Postal code"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        <input
          type="text"
          name="countryCode"
          required
          defaultValue="LT"
          placeholder="Country code"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
        <textarea
          name="notes"
          rows={4}
          placeholder="Delivery notes"
          className="border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent"
        />
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
