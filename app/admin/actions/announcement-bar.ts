"use server";

import { revalidatePath } from "next/cache";

import {
  readAnnouncementBarSetting,
  setAnnouncementBarEnabled,
  type AnnouncementBarSetting,
} from "@/lib/content/announcement-bar";
import { ANNOUNCEMENT_BAR_COPY_KEY } from "@/lib/content/announcement-bar-fields";
import { getStorefrontCopy, setStorefrontCopy, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { requireAdminSession } from "@/lib/auth/admin-session";

export type AnnouncementBarActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  setting?: AnnouncementBarSetting;
};

export async function loadAnnouncementBarEditorPayload(): Promise<{
  setting: AnnouncementBarSetting;
  copy: StorefrontCopy;
}> {
  await requireAdminSession();
  const [setting, copy] = await Promise.all([
    readAnnouncementBarSetting(),
    getStorefrontCopy(),
  ]);
  return { setting, copy };
}

export async function saveAnnouncementBarAction(input: {
  enabled: boolean;
  copyByLocale: Record<string, string>;
}): Promise<AnnouncementBarActionState> {
  try {
    await requireAdminSession();
    const locales = await getStorefrontLocales();
    const allowed = new Set(locales.map((locale) => locale.code));
    const updates: StorefrontCopy = {};
    for (const [locale, value] of Object.entries(input.copyByLocale)) {
      if (!allowed.has(locale)) continue;
      updates[locale] = { [ANNOUNCEMENT_BAR_COPY_KEY]: value };
    }
    const [setting] = await Promise.all([
      setAnnouncementBarEnabled(input.enabled),
      Object.keys(updates).length > 0 ? setStorefrontCopy(updates) : Promise.resolve(null),
    ]);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true, message: "Announcement bar saved", setting };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Save failed",
    };
  }
}
