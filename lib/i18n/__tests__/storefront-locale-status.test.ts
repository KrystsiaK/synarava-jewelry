import { describe, expect, it } from "vitest";

import {
  isPublishedFromStatus,
  localeLifecycleState,
  LOCALE_DELETE_RETENTION_DAYS,
  retentionDaysElapsed,
} from "@/lib/i18n/storefront-locale-status";

describe("storefront locale status helpers", () => {
  it("maps PUBLISHED to isPublished", () => {
    expect(isPublishedFromStatus("PUBLISHED")).toBe(true);
    expect(isPublishedFromStatus("DRAFT")).toBe(false);
    expect(isPublishedFromStatus("RETIRED")).toBe(false);
  });

  it("treats deletedAt as deleted even when status is RETIRED", () => {
    expect(localeLifecycleState({ status: "RETIRED", deletedAt: new Date() })).toBe("deleted");
    expect(localeLifecycleState({ status: "RETIRED", deletedAt: null })).toBe("retired");
    expect(localeLifecycleState({ status: "PUBLISHED" })).toBe("published");
    expect(localeLifecycleState({ status: "DRAFT" })).toBe("draft");
  });

  it("enforces the default retention window before delete", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const tooRecent = new Date("2026-10-01T00:00:00.000Z");
    const ready = new Date("2026-09-01T00:00:00.000Z");
    expect(LOCALE_DELETE_RETENTION_DAYS).toBe(30);
    expect(retentionDaysElapsed(tooRecent, now)).toBe(false);
    expect(retentionDaysElapsed(ready, now)).toBe(true);
    expect(retentionDaysElapsed(null, now)).toBe(false);
  });
});
