import { NextRequest, NextResponse } from "next/server";

import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";

const messages = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
} as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale")?.trim().toLowerCase();
  return NextResponse.json(locale === "pt" ? messages.pt : messages.en, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
