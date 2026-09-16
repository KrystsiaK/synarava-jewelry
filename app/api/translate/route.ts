import { NextRequest, NextResponse } from "next/server";

import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";

const messages = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
} as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale")?.trim().toLowerCase();
  const copy = await getStorefrontCopy();
  const selectedLocale = locale === "pt" ? "pt" : "en";
  return NextResponse.json({ ...messages[selectedLocale], ...copy[selectedLocale] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
