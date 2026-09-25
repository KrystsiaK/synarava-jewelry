import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearPageEditorDraftSnapshot,
  takePageEditorDraftSnapshot,
  writePageEditorDraftSnapshot,
} from "@/lib/admin/page-editor-draft-snapshot";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("page editor draft snapshot", () => {
  it("round-trips a draft and clears it on take", () => {
    expect(
      writePageEditorDraftSnapshot("page-1", {
        draftByLocale: {
          en: { title: "FAQ", serviceSections: { maker: { title: "Q", body: "A" } } },
          pt: { title: "Perguntas", serviceSections: { maker: { title: "P", body: "R" } } },
        },
        handleByLocale: {},
        editProductIds: ["", "", "", ""],
        finalCtaProductIds: ["", "", "", ""],
        archiveCollectionIds: [""],
        contactEnabled: false,
      }),
    ).toBe(true);

    const taken = takePageEditorDraftSnapshot("page-1");
    expect(taken?.draftByLocale.pt).toEqual({
      title: "Perguntas",
      serviceSections: { maker: { title: "P", body: "R" } },
    });
    expect(takePageEditorDraftSnapshot("page-1")).toBeNull();
  });

  it("ignores expired snapshots", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
    writePageEditorDraftSnapshot("page-1", {
      draftByLocale: { en: { title: "Old" } },
      handleByLocale: {},
      editProductIds: [],
      finalCtaProductIds: [],
      archiveCollectionIds: [],
      contactEnabled: false,
    });
    vi.setSystemTime(new Date("2026-09-25T19:00:00Z"));
    expect(takePageEditorDraftSnapshot("page-1")).toBeNull();
  });

  it("clear removes a pending snapshot", () => {
    writePageEditorDraftSnapshot("page-1", {
      draftByLocale: { en: { title: "X" } },
      handleByLocale: {},
      editProductIds: [],
      finalCtaProductIds: [],
      archiveCollectionIds: [],
      contactEnabled: false,
    });
    clearPageEditorDraftSnapshot("page-1");
    expect(takePageEditorDraftSnapshot("page-1")).toBeNull();
  });
});
