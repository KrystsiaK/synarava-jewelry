import { confirmOrderAction, resetCheckoutAction } from "@/app/checkout/actions";

type PaymentConfirmPanelProps = {
  order: {
    customerName: string | null;
    customerEmail: string;
    totalCents: number;
    currency: string;
    items: Array<{
      id: string;
      title: string;
      quantity: number;
      totalCents: number;
    }>;
    shippingAddress: unknown;
  };
};

function formatMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function PaymentConfirmPanel({ order }: PaymentConfirmPanelProps) {
  const address = (order.shippingAddress ?? {}) as Record<string, string | null>;

  return (
    <div className="grid gap-6">
      <section className="panel p-6 md:p-8">
        <p className="label-caps text-accent">Acquisition recap</p>
        <div className="mt-6 space-y-5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-t border-stroke pt-4">
              <div>
                <p className="font-serif text-[1.35rem]">{item.title}</p>
                <p className="text-sm text-foreground/60">Qty {item.quantity}</p>
              </div>
              <span className="font-mono text-sm uppercase tracking-[0.14em]">
                {formatMoney(item.totalCents, order.currency)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <p className="label-caps text-accent">Shipping destination</p>
        <div className="mt-6 text-base leading-7 text-foreground/74">
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p className="mt-3">{address.line1}</p>
          {address.line2 ? <p>{address.line2}</p> : null}
          <p>
            {address.city}
            {address.region ? `, ${address.region}` : ""} {address.postalCode}
          </p>
          <p>{address.countryCode}</p>
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-stroke pb-4">
          <span className="label-caps text-muted">Order total</span>
          <span className="font-mono text-sm uppercase tracking-[0.14em]">
            {formatMoney(order.totalCents, order.currency)}
          </span>
        </div>

        <p className="mt-5 text-sm leading-6 text-foreground/60">
          Local mode currently simulates the secure acquisition step. The order is confirmed in the
          database and ready for the real Stripe handoff layer next.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <form action={confirmOrderAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
            >
              Confirm acquisition
            </button>
          </form>

          <form action={resetCheckoutAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center border border-stroke px-6 py-4 label-caps transition-colors hover:border-accent hover:text-accent"
            >
              Back to cart
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
