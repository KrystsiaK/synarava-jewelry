import { db } from "@/lib/db";

export const SITE_VIDEO_SETTING_KEY = "site-videos";

export const siteVideoSlots = {
  homeBeads: "",
  homeModel: "",
  braceletFilm: "",
  materialsFilm: "",
} as const;

export type SiteVideoSlot = keyof typeof siteVideoSlots;
export type SiteVideos = Record<SiteVideoSlot, string>;

const SITE_VIDEO_FILE = /^[a-z0-9][a-z0-9.-]*\.(?:mp4|webm)$/;

function isStoredVideoUrl(value: unknown): value is string {
  return typeof value === "string" && (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("/media/uploads/videos/")
  );
}

function storedVideoPath(storedUrl: string) {
  const raw = storedUrl.split(/[?#]/, 1)[0] ?? "";
  if (raw.startsWith("/media/")) return raw.slice("/media/".length);
  if (raw.startsWith("uploads/videos/")) return raw;

  try {
    const pathname = new URL(raw).pathname.replace(/^\/+/, "");
    const marker = "uploads/videos/";
    const index = pathname.indexOf(marker);
    return index === -1 ? null : pathname.slice(index);
  } catch {
    return null;
  }
}

/** Bucket key for a site-video URL. Rejects anything outside `uploads/videos/<slot>/`. */
export function siteVideoObjectKey(storedUrl: string) {
  const path = storedVideoPath(storedUrl);
  if (!path) return null;

  let key: string;
  try {
    key = path.split("/").map((part) => decodeURIComponent(part)).join("/");
  } catch {
    return null;
  }

  const [root, group, slot, filename, ...extra] = key.split("/");
  if (extra.length > 0 || root !== "uploads" || group !== "videos") return null;
  if (!isVideoSlotName(slot) || !filename || filename.includes("..") || !SITE_VIDEO_FILE.test(filename)) {
    return null;
  }
  return key;
}

function isVideoSlotName(value: string | undefined): value is SiteVideoSlot {
  return typeof value === "string" && value in siteVideoSlots;
}

function collectSiteVideoKeys(value: unknown) {
  if (!value || typeof value !== "object") return new Set<string>();
  const keys = new Set<string>();
  for (const entry of Object.values(value)) {
    if (typeof entry !== "string") continue;
    const key = siteVideoObjectKey(entry);
    if (key) keys.add(key);
  }
  return keys;
}

/** Keys that the saved setting dropped and that no remaining slot still uses. */
export function releasedSiteVideoKeys(previous: unknown, next: unknown) {
  const stillUsed = collectSiteVideoKeys(next);
  return [...collectSiteVideoKeys(previous)].filter((key) => !stillUsed.has(key)).toSorted();
}

export function parseSiteVideos(value: unknown): SiteVideos {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return Object.fromEntries(
    Object.entries(siteVideoSlots).map(([slot, fallback]) => [
      slot,
      isStoredVideoUrl(saved[slot]) ? saved[slot] : fallback,
    ]),
  ) as SiteVideos;
}

export async function getSiteVideos(): Promise<SiteVideos> {
  const setting = await db.siteSetting.findUnique({
    where: { key: SITE_VIDEO_SETTING_KEY },
    select: { value: true },
  });

  return parseSiteVideos(setting?.value);
}
