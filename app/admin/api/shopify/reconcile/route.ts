import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentAdminSession } from "@/lib/auth/admin-session";
import {
  getLatestEntityReconcileState,
  getLatestReconcileRun,
  hasSessionReconciled,
  markSessionReconciled,
  runTranslationReconciliation,
} from "@/lib/shopify/reconciliation-run";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export const runtime = "nodejs";

const requestSchema = z.object({
  trigger: z.enum(["AUTO", "MANUAL", "ENTITY", "LOCALE"]),
  scope: z.object({
    locale: z.string().trim().min(2).max(32).optional(),
    entityType: z.enum(["PRODUCT", "COLLECTION", "PAGE", "STOREFRONT_COPY"]).optional(),
    entityId: z.string().trim().min(1).max(256).optional(),
    bindingId: z.string().trim().min(1).max(256).optional(),
  }).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Admin session required." }, { status: 401 });
}

const queryScopeSchema = z.object({
  entityType: z.enum(["PRODUCT", "COLLECTION", "PAGE", "STOREFRONT_COPY"]),
  entityId: z.string().trim().min(1).max(256),
  locale: z.string().trim().min(2).max(32),
});

/**
 * Every caller of this route (EntityLocaleSyncControl) knows only the
 * registry locale code shown in its own tab (e.g. "pt", "ru") — the same
 * code every N-locale admin editor already uses. This resolves that to the
 * Shopify-side code (e.g. "pt-PT") the reconcile engine stores against,
 * so the client never needs its own copy of that mapping.
 */
async function resolveShopifyLocale(registryCode: string): Promise<string | null> {
  if (registryCode === "en") return "en";
  const locales = await getPublishedStorefrontLocales();
  return locales.find((locale) => !locale.isDefault && locale.code === registryCode)?.shopifyLocale ?? null;
}

export async function GET(request: NextRequest) {
  const session = await getCurrentAdminSession();
  if (!session) return unauthorized();

  const params = request.nextUrl.searchParams;
  if (params.has("entityType") || params.has("entityId") || params.has("locale")) {
    const scope = queryScopeSchema.safeParse({
      entityType: params.get("entityType"),
      entityId: params.get("entityId"),
      locale: params.get("locale"),
    });
    if (!scope.success) return NextResponse.json({ error: "Choose a valid item and language." }, { status: 400 });
    const shopifyLocale = await resolveShopifyLocale(scope.data.locale);
    if (!shopifyLocale) return NextResponse.json({ error: "Choose a valid item and language." }, { status: 400 });
    return NextResponse.json(await getLatestEntityReconcileState({ ...scope.data, locale: shopifyLocale }));
  }

  return NextResponse.json({ run: await getLatestReconcileRun() });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentAdminSession();
  if (!session) return unauthorized();

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid Shopify check scope." }, { status: 400 });
  }

  const scope = parsed.data.scope;
  const shopifyLocale = scope?.locale ? await resolveShopifyLocale(scope.locale) : undefined;
  if (scope?.locale && !shopifyLocale) {
    return NextResponse.json({ error: "Choose a valid language." }, { status: 400 });
  }

  if (parsed.data.trigger === "AUTO" && await hasSessionReconciled(session.sessionId)) {
    return NextResponse.json({ run: await getLatestReconcileRun(), reused: true });
  }

  let result;
  try {
    result = await runTranslationReconciliation({
      trigger: parsed.data.trigger,
      scope: shopifyLocale ? { ...scope, locale: shopifyLocale } : scope,
      requestedBy: session.username,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ run: null, error: message }, { status: 500 });
  }
  if (parsed.data.trigger === "AUTO") await markSessionReconciled(session.sessionId);

  return NextResponse.json(result);
}
