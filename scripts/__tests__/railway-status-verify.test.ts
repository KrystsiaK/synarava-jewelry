import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  readRailwayEnvironmentName,
  readRailwayProjectId,
  verifyRailwayStagingLink,
  verifyRailwayStagingLinkFromJson,
} from "../lib/railway-status-verify.mjs";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/railway-status-staging.json",
);

describe("railway status --json staging shape", () => {
  it("reads project id and stage from GraphQL edges connection", () => {
    const raw = readFileSync(fixturePath, "utf8");
    const status = JSON.parse(raw);
    expect(readRailwayProjectId(status)).toBe(
      "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    );
    expect(readRailwayEnvironmentName(status)).toBe("staging");
    expect(
      verifyRailwayStagingLink(status, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      }),
    ).toEqual({
      ok: true,
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "staging",
    });
    expect(
      verifyRailwayStagingLinkFromJson(raw, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      }).ok,
    ).toBe(true);
  });

  it("fails closed when edges are missing", () => {
    const result = verifyRailwayStagingLink(
      { id: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b" },
      {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects production stage name", () => {
    const status = {
      id: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    };
    status["environments"] = { edges: [{ node: { name: "production" } }] };
    const result = verifyRailwayStagingLink(status, {
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "staging",
    });
    expect(result.ok).toBe(false);
  });
});
