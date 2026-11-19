import "server-only";

import { cache } from "react";

import { getAnnouncementBarSetting } from "@/lib/content/announcement-bar";
import {
  ANNOUNCEMENT_BAR_COPY_KEY,
  resolveAnnouncementBarText,
} from "@/lib/content/announcement-bar-display";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { getServerTranslations } from "@/lib/i18n/server";

/**
 * One per-request resolution for storefront marquee copy.
 * Setting + copy reads are already `cache()`-wrapped; this helper dedupes
 * the compose step so home and locale layout never double-fetch.
 */
export const resolveStorefrontAnnouncementMessage = cache(
  async (): Promise<string | null> => {
    const [{ locale, t }, setting, storefrontCopy] = await Promise.all([
      getServerTranslations(),
      getAnnouncementBarSetting(),
      getStorefrontCopy(),
    ]);

    const template =
      storefrontCopy[locale]?.[ANNOUNCEMENT_BAR_COPY_KEY]
      ?? storefrontCopy.en?.[ANNOUNCEMENT_BAR_COPY_KEY]
      ?? t("announcement.bar");

    return resolveAnnouncementBarText({
      enabled: setting.enabled,
      threshold: setting.threshold,
      template,
      locale,
    });
  },
);
