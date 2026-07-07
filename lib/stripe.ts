import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function hasStripeSecretKey() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function hasStripePublishableKey() {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

export function isStripePaymentConfigured() {
  return hasStripeSecretKey() && hasStripePublishableKey();
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: Stripe.API_VERSION,
    });
  }

  return stripeClient;
}
