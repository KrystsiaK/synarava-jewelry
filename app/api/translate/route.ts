import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import en from "@/messages/en.json";
import { flattenMessages } from "@/lib/i18n/utils";

const enFlat = flattenMessages(en as Record<string, unknown>);
const allKeys = Object.keys(enFlat);
const allValues = allKeys.map((k) => enFlat[k]);

// Static translations bundled with the app — no API key needed
const STATIC_LOCALES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  ru: () => import("@/messages/ru.json"),
  de: () => import("@/messages/de.json"),
  fr: () => import("@/messages/fr.json"),
  pl: () => import("@/messages/pl.json"),
};

async function getStaticMessages(locale: string): Promise<Record<string, string> | null> {
  const loader = STATIC_LOCALES[locale];
  if (!loader) return null;
  try {
    const mod = await loader();
    return flattenMessages(mod.default as Record<string, unknown>);
  } catch {
    return null;
  }
}

const DEEPL_URL = "https://api-free.deepl.com/v2/translate";
const BATCH_SIZE = 50;

async function translateWithDeepL(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("DEEPL_API_KEY is not configured");

  const results: string[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(DEEPL_URL, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: batch, target_lang: targetLang }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepL API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    results.push(...data.translations.map((t: { text: string }) => t.text));
  }
  return results;
}

// Explicit allowlist — prevents arbitrary locales from hitting DeepL or poisoning the cache.
const ALLOWED_LOCALES = new Set(["en", "ru", "de", "fr", "pl"]);

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale")?.trim().toLowerCase();

  if (!locale || locale === "en") {
    return NextResponse.json(enFlat);
  }

  if (!ALLOWED_LOCALES.has(locale)) {
    return NextResponse.json(enFlat);
  }

  // 1. Static bundled file (no API key needed)
  const staticMessages = await getStaticMessages(locale);
  if (staticMessages) {
    return NextResponse.json(staticMessages);
  }

  // 2. DB cache
  try {
    const cached = await db.translationCache.findUnique({ where: { locale } });
    if (cached) {
      return NextResponse.json(cached.messages);
    }
  } catch {
    // DB unavailable — continue
  }

  // 3. DeepL API
  try {
    const translated = await translateWithDeepL(allValues, locale.toUpperCase());
    const messages: Record<string, string> = {};
    allKeys.forEach((key, i) => { messages[key] = translated[i]; });

    try {
      await db.translationCache.upsert({
        where: { locale },
        update: { messages },
        create: { locale, messages },
      });
    } catch {}

    return NextResponse.json(messages);
  } catch (err) {
    console.error("[translate]", err);
    // Fallback to English rather than a broken UI
    return NextResponse.json(enFlat, { status: 200 });
  }
}
