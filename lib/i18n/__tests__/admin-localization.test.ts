import {
  determineSyncDirection,
  diffFieldConflicts,
  entityLocaleReadiness,
  missingRequiredForPublish,
  resolveEntityLocale,
} from "@/lib/i18n/admin-localization";
import { PRODUCT_FIELD_REGISTRY } from "@/lib/i18n/admin-field-registry";
import type { EntityFieldRegistry } from "@/lib/i18n/admin-field-registry";

const WIDGET_REGISTRY: EntityFieldRegistry = {
  entity: "widget",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "title" } },
    { key: "caption", label: "Caption", mode: "localized", required: "optional", kind: "short-text", shopifyTarget: { kind: "native", resource: "X", key: "caption" } },
    { key: "sku", label: "SKU", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
  ],
};

describe("resolveEntityLocale", () => {
  const english = { title: "Ring", caption: "Handmade", sku: "SKU-1" };

  it("falls back to source for a blank optional field", () => {
    expect(resolveEntityLocale(WIDGET_REGISTRY, english, { title: "Anel", caption: "" }))
      .toEqual({ title: "Anel", caption: "Handmade", sku: "SKU-1" });
  });

  it("keeps a required field blank instead of silently falling back", () => {
    expect(resolveEntityLocale(WIDGET_REGISTRY, english, { title: "", caption: "Feito à mão" }).title).toBe("");
  });

  it("returns the source untouched when there is no translation", () => {
    expect(resolveEntityLocale(WIDGET_REGISTRY, english, null)).toEqual(english);
  });
});

describe("entityLocaleReadiness", () => {
  it("is incomplete when a required field is blank", () => {
    const readiness = entityLocaleReadiness(WIDGET_REGISTRY, { title: "", caption: "x", sku: "SKU-1" }, { published: false });
    expect(readiness.complete).toBe(false);
    expect(readiness.missing).toEqual(["title"]);
  });

  it("is complete once required fields are filled", () => {
    const readiness = entityLocaleReadiness(WIDGET_REGISTRY, { title: "Anel", caption: "", sku: "SKU-1" }, { published: false });
    expect(readiness.complete).toBe(true);
  });
});

describe("missingRequiredForPublish", () => {
  const complete = { title: "Ring", caption: "x", sku: "SKU-1" };

  it("is empty once already public", () => {
    expect(missingRequiredForPublish(WIDGET_REGISTRY, {}, {}, { portugueseReviewed: false, isAlreadyPublic: true })).toEqual([]);
  });

  it("flags missing English, Portuguese, and review before first publish", () => {
    const missing = missingRequiredForPublish(WIDGET_REGISTRY, { title: "" }, { title: "" }, { portugueseReviewed: false, isAlreadyPublic: false });
    expect(missing).toEqual(["English Title", "Portuguese Title", "Portuguese review"]);
  });

  it("passes when both locales are filled and PT is reviewed", () => {
    expect(missingRequiredForPublish(WIDGET_REGISTRY, complete, complete, { portugueseReviewed: true, isAlreadyPublic: false })).toEqual([]);
  });
});

describe("diffFieldConflicts + determineSyncDirection", () => {
  const base = { title: "Ring", caption: "Handmade", sku: "SKU-1" };

  it("is noop when nothing changed", () => {
    expect(determineSyncDirection(WIDGET_REGISTRY, base, base, base)).toBe("noop");
  });

  it("pushes when only local changed", () => {
    const local = { ...base, title: "New Ring" };
    expect(determineSyncDirection(WIDGET_REGISTRY, base, local, base)).toBe("push");
  });

  it("pulls when only remote changed", () => {
    const remote = { ...base, title: "Remote Ring" };
    expect(determineSyncDirection(WIDGET_REGISTRY, base, base, remote)).toBe("pull");
  });

  it("flags a field-level conflict when both sides changed the same field differently", () => {
    const local = { ...base, title: "Local Ring" };
    const remote = { ...base, title: "Remote Ring" };
    expect(determineSyncDirection(WIDGET_REGISTRY, base, local, remote)).toBe("conflict");
    expect(diffFieldConflicts(WIDGET_REGISTRY, base, local, remote)).toEqual([
      { field: "title", local: "Local Ring", remote: "Remote Ring" },
    ]);
  });

  it("ignores shared fields even when they differ from the base", () => {
    const local = { ...base, sku: "SKU-2" };
    expect(determineSyncDirection(WIDGET_REGISTRY, base, local, base)).toBe("noop");
  });
});

describe("integration with the real product registry", () => {
  it("computes readiness for a Product-shaped EN/PT payload", () => {
    const english = { title: "Lava Ring", shortDescription: "Bold.", description: "Full copy.", seoTitle: "", seoDescription: "" };
    const readiness = entityLocaleReadiness(PRODUCT_FIELD_REGISTRY, english, { published: false });
    expect(readiness.complete).toBe(true); // seoTitle/seoDescription are when-published, not required in draft
  });
});
