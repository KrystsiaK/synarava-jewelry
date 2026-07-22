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

function isStoredVideoUrl(value: unknown): value is string {
  return typeof value === "string" && (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("/media/uploads/videos/")
  );
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
