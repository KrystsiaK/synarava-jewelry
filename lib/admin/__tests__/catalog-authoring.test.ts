import { describe, expect, it } from "vitest";

import {
  ADMIN_PRODUCT_AUTHORING_ENABLED,
  isAdminProductAuthoringEnabled,
} from "@/lib/admin/catalog-authoring";

describe("catalog authoring gate", () => {
  it("keeps product create/edit paused while Catalog is sync-only", () => {
    expect(ADMIN_PRODUCT_AUTHORING_ENABLED).toBe(false);
    expect(isAdminProductAuthoringEnabled()).toBe(false);
  });
});
