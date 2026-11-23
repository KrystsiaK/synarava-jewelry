import { describe, expect, it } from "vitest";

import { MARKETING_IDEAS_RESPONSE_SCHEMA } from "@/lib/marketing/ideas/schema";

describe("MARKETING_IDEAS_RESPONSE_SCHEMA", () => {
  it("requires at least 10 ideas", () => {
    expect(MARKETING_IDEAS_RESPONSE_SCHEMA.properties.ideas.minItems).toBe(10);
  });
});
