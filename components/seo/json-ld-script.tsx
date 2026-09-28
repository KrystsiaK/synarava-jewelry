import { headers } from "next/headers";

import { safeJsonLd } from "@/lib/seo/json-ld";

/**
 * Emits a JSON-LD script with the request CSP nonce from `proxy.ts`.
 * Pass `nonce` when the caller already read `headers()` (e.g. root layout).
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
export async function JsonLdScript({
  id,
  data,
  nonce: nonceProp,
}: {
  id?: string;
  data: unknown;
  nonce?: string;
}) {
  const nonce = nonceProp ?? (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      id={id}
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
