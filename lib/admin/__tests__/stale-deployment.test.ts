import { describe, expect, it } from "vitest";

import { isStaleDeploymentError } from "@/lib/admin/stale-deployment";

describe("isStaleDeploymentError", () => {
  it("recognizes UnrecognizedActionError by name", () => {
    const error = new Error("Server Action was not found on the server.");
    error.name = "UnrecognizedActionError";
    expect(isStaleDeploymentError(error)).toBe(true);
  });

  it("recognizes the failed-to-find-server-action message", () => {
    expect(
      isStaleDeploymentError(new Error("Failed to find Server Action \"abc\".")),
    ).toBe(true);
  });

  it("ignores ordinary save failures", () => {
    expect(isStaleDeploymentError(new Error("Page slug and title are required."))).toBe(false);
    expect(isStaleDeploymentError(null)).toBe(false);
  });
});
