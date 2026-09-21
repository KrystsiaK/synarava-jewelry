import { describe, expect, it } from "vitest";

import {
  collectionActionCopy,
  collectionStatusLabel,
  collectionToDraft,
  emptyCollectionDraft,
  fieldClass,
  generateCollectionCode,
  normalizeCollections,
  submitLabel,
  workflowStateFromCollection,
} from "@/components/admin/collections/collection-helpers";
import type { AdminCollection } from "@/components/admin/collections/collection-types";

function makeCollection(overrides: Partial<AdminCollection> = {}): AdminCollection {
  return {
    id: "collection-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    name: "Wanderlust",
    slug: "wanderlust",
    code: null,
    subtitle: null,
    description: null,
    manifesto: null,
    searchSummary: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    heroImageUrl: null,
    sortOrder: 0,
    status: "DRAFT",
    visibility: "PRIVATE",
    translations: [],
    ...overrides,
  };
}

describe("emptyCollectionDraft", () => {
  it("defaults to a blank draft in DRAFT state", () => {
    expect(emptyCollectionDraft()).toMatchObject({ name: "", slug: "", workflowState: "DRAFT" });
  });

  it("gives the PT locale draft blank fields and NOT_APPLICABLE sync status", () => {
    expect(emptyCollectionDraft(["pt"]).translations.pt).toEqual({
      localizedHandle: "", name: "", subtitle: "", description: "", manifesto: "", searchSummary: "",
      symbolismLabel: "", symbolismTitle: "", symbolismBody: "", symbolismBody2: "",
      reviewed: false, syncStatus: "NOT_APPLICABLE", syncError: "",
    });
  });
});

describe("generateCollectionCode", () => {
  it("returns an empty string for input with no letters or digits", () => {
    expect(generateCollectionCode("   ---   ")).toBe("");
  });

  it("builds a deterministic prefix+checksum code from two or more words", () => {
    const code = generateCollectionCode("Lava Heritage");
    expect(code).toBe(generateCollectionCode("Lava Heritage"));
    expect(code).toMatch(/^[A-Z0-9]{3,4}-\d{2}$/);
  });

  it("builds a code from a single word", () => {
    const code = generateCollectionCode("Wanderlust");
    expect(code).toMatch(/^[A-Z0-9]{3,4}-\d{2}$/);
  });
});

describe("normalizeCollections", () => {
  it("sorts by sortOrder, falling back to name", () => {
    const collections = [
      makeCollection({ name: "Beta", sortOrder: 2 }),
      makeCollection({ name: "Alpha", sortOrder: 1 }),
      makeCollection({ name: "Zeta", sortOrder: 1 }),
    ];
    expect(normalizeCollections(collections).map((item) => item.name)).toEqual(["Alpha", "Zeta", "Beta"]);
  });
});

describe("workflowStateFromCollection / collectionStatusLabel", () => {
  it("treats ACTIVE+PUBLIC as PUBLISHED and everything else as DRAFT", () => {
    expect(workflowStateFromCollection(makeCollection({ status: "ACTIVE", visibility: "PUBLIC" }))).toBe("PUBLISHED");
    expect(workflowStateFromCollection(makeCollection({ status: "ACTIVE", visibility: "PRIVATE" }))).toBe("DRAFT");
  });

  it("labels archived collections as ARCHIVED regardless of visibility", () => {
    expect(collectionStatusLabel(makeCollection({ status: "ARCHIVED", visibility: "PUBLIC" }))).toBe("ARCHIVED");
  });
});

describe("collectionToDraft", () => {
  it("maps null content fields to empty strings", () => {
    const draft = collectionToDraft(makeCollection({ code: null, description: null }));
    expect(draft.code).toBe("");
    expect(draft.description).toBe("");
  });

  it("maps the Portuguese translation into an independent locale draft", () => {
    const draft = collectionToDraft(makeCollection({
      translations: [{
        id: "translation-pt",
        locale: "pt",
        name: "Rituais da Terra",
        description: "Peças fundamentadas.",
        manifesto: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        searchSummary: null,
        reviewStatus: "REVIEWED",
        syncStatus: "PENDING",
        syncError: null,
      }],
    }));

    expect(draft.translations.pt.name).toBe("Rituais da Terra");
    expect(draft.translations.pt.description).toBe("Peças fundamentadas.");
    expect(draft.translations.pt.reviewed).toBe(true);
    expect(draft.translations.pt.syncStatus).toBe("PENDING");
  });

  it("defaults the PT locale draft when no translation exists yet", () => {
    expect(collectionToDraft(makeCollection()).translations.pt).toMatchObject({ name: "", reviewed: false, syncStatus: "NOT_APPLICABLE" });
  });
});

describe("fieldClass / submitLabel", () => {
  it("adds the error modifier only when a message is present", () => {
    expect(fieldClass()).toBe("adm-field");
    expect(fieldClass("Required")).toBe("adm-field adm-field--error");
  });

  it("swaps in the pending label while pending", () => {
    expect(submitLabel("Save", false, "Saving...")).toBe("Save");
    expect(submitLabel("Save", true, "Saving...")).toBe("Saving...");
  });
});

describe("collectionActionCopy", () => {
  it("returns danger tone for archive and delete", () => {
    const collection = makeCollection({ name: "Wanderlust" });
    expect(collectionActionCopy({ collection, action: "archive" }).tone).toBe("danger");
    expect(collectionActionCopy({ collection, action: "delete" }).tone).toBe("danger");
    expect(collectionActionCopy({ collection, action: "publish" }).title).toContain("Wanderlust");
  });
});
