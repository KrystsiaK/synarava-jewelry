import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeCustomerReturnPath } from "@/lib/shopify/customer-account/config";

export const metadata: Metadata = {
  title: "Login | Synarava",
  description: "Identify yourself to access your Synarava account.",
};

type Props = {
  searchParams?: Promise<{
    redirectTo?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const returnTo = safeCustomerReturnPath(params.redirectTo);
  const shopifyAuthHref = `/api/auth/shopify?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell
      eyebrow="Customer account"
      title="Return to your collection."
      description="Sign in securely with a one-time code sent to your email. No password required."
      asideTitle="Your pieces, remembered."
      asideBody="Account details are used only to support your orders and make future acquisitions easier."
    >
      <div className="space-y-6">
        <div>
          <p className="label-caps text-couture-red">Secure access</p>
          <h2 className="mt-3 font-serif text-[2.4rem] leading-none">
            Access your account
          </h2>
        </div>
        {params.error === "shopify" ? (
          <p role="alert" className="border border-couture-red/40 p-4 text-sm text-couture-red">
            We could not complete the sign-in. Please try again.
          </p>
        ) : null}
        <a
          href={shopifyAuthHref}
          className="label-caps inline-flex w-full items-center justify-center bg-couture-red px-6 py-4 text-linen transition-opacity hover:opacity-90"
        >
          Sign in or create account
        </a>
        <p className="text-sm leading-6 text-foreground/45">
          New customers are created automatically after email verification.
        </p>
      </div>
    </AuthShell>
  );
}
