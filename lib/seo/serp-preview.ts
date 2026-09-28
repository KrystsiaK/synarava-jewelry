/** Soft SERP limits (Google-ish guidance — not hard publish blockers). */
export const SEO_TITLE_SOFT_MAX = 60;
export const SEO_DESCRIPTION_SOFT_MAX = 160;

export function nonEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Resolved title shown in search preview (seo field, then fallbacks). */
export function resolveSerpTitle(
  seoTitle: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  const primary = nonEmpty(seoTitle);
  if (primary) return primary;
  for (const fallback of fallbacks) {
    const value = nonEmpty(fallback);
    if (value) return value;
  }
  return "Untitled";
}

/** Resolved description shown in search preview. */
export function resolveSerpDescription(
  seoDescription: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  const primary = nonEmpty(seoDescription);
  if (primary) return primary;
  for (const fallback of fallbacks) {
    const value = nonEmpty(fallback);
    if (value) return value;
  }
  return "";
}

/**
 * Green SERP URL line: `host › segment › segment`.
 * Host may be bare (`synarava.com`) or absolute (`https://synarava.com`).
 */
export function serpDisplayUrl(host: string | null | undefined, path: string): string {
  const normalizedPath = path.trim() || "/";
  const segments = normalizedPath.replace(/^\//, "").split("/").filter(Boolean);
  let cleanHost = (host ?? "").trim();
  if (cleanHost) {
    try {
      if (/^https?:\/\//i.test(cleanHost)) cleanHost = new URL(cleanHost).host;
      else cleanHost = cleanHost.replace(/\/$/, "");
    } catch {
      cleanHost = cleanHost.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    }
  }
  if (!cleanHost) {
    return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  }
  return [cleanHost, ...segments].join(" › ");
}

/** Soft field warning when length exceeds the SERP guidance max. */
export function seoLengthWarning(
  value: string | null | undefined,
  max: number,
  label: string,
): string | undefined {
  const length = nonEmpty(value).length;
  if (length <= max) return undefined;
  return `${label} is ${length} characters (soft limit ${max}). Search may truncate it.`;
}

export function seoTitleWarning(value: string | null | undefined) {
  return seoLengthWarning(value, SEO_TITLE_SOFT_MAX, "SEO title");
}

export function seoDescriptionWarning(value: string | null | undefined) {
  return seoLengthWarning(value, SEO_DESCRIPTION_SOFT_MAX, "SEO description");
}

/** Host for SERP chrome when env is available on the client. */
export function defaultSerpHost(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL;
  if (!configured) return "synarava.com";
  try {
    return new URL(configured).host;
  } catch {
    return configured.replace(/^https?:\/\//i, "").replace(/\/$/, "") || "synarava.com";
  }
}
