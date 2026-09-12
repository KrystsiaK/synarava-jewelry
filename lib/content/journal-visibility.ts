import "server-only";

import { db } from "@/lib/db";

const JOURNAL_NAV_VISIBLE_KEY = "nav.journal_visible";

export async function isJournalNavVisible() {
  const setting = await db.siteSetting.findUnique({ where: { key: JOURNAL_NAV_VISIBLE_KEY } });
  const value = setting?.value;
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && (value as { visible?: unknown }).visible === true,
  );
}

export async function setJournalNavVisible(visible: boolean) {
  await db.siteSetting.upsert({
    where: { key: JOURNAL_NAV_VISIBLE_KEY },
    update: { value: { visible } },
    create: { key: JOURNAL_NAV_VISIBLE_KEY, value: { visible } },
  });
}
